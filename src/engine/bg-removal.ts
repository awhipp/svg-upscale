import { BackgroundRemovalOptions } from './types';
import { rgbToHex } from './svg';
export { rgbToHex } from './svg';

export interface BgRemovalResult {
  removedCount: number;
  detectedColor: { r: number; g: number; b: number; hex: string };
  maskData?: Uint8ClampedArray;
}

/**
 * Parses #RRGGBB or #RGB hex string into numeric RGB components.
 */
export function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace(/^#/, '').trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
  return null;
}

/**
 * Auto-detects the dominant background color by sampling the 4 outer corner regions.
 * Averages a 3x3 pixel patch around each corner to resist single-pixel JPEG noise.
 */
export function detectBackgroundColor(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): { r: number; g: number; b: number; hex: string } {
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let count = 0;

  const samplePoints: Array<[number, number]> = [
    [0, 0],
    [Math.max(0, width - 1), 0],
    [0, Math.max(0, height - 1)],
    [Math.max(0, width - 1), Math.max(0, height - 1)],
  ];

  for (const [cx, cy] of samplePoints) {
    for (let dy = -1; dy <= 1; dy++) {
      const sy = cy + dy;
      if (sy < 0 || sy >= height) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const sx = cx + dx;
        if (sx < 0 || sx >= width) continue;

        const idx = (sy * width + sx) * 4;
        totalR += data[idx];
        totalG += data[idx + 1];
        totalB += data[idx + 2];
        count++;
      }
    }
  }

  const r = count > 0 ? Math.round(totalR / count) : 255;
  const g = count > 0 ? Math.round(totalG / count) : 255;
  const b = count > 0 ? Math.round(totalB / count) : 255;

  return { r, g, b, hex: rgbToHex(r, g, b) };
}

/**
 * Computes Euclidean color distance between two RGB triples.
 * Maximum distance (between black and white) is sqrt(255^2 * 3) ≈ 441.67.
 */
export function colorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Fast client-side background removal pre-processor.
 *
 * Marks matching background pixels as transparent (A = 0) in-place so downstream
 * vector and raster engines skip them entirely.
 *
 * @param data Decoded image RGBA buffer (Uint8ClampedArray | Uint8Array)
 * @param width Pixel width
 * @param height Pixel height
 * @param options Removal options (tolerance, mode: 'flood' | 'global', targetColor)
 * @param generateMask If true, emits a high-contrast visual mask buffer for UI preview
 */
export function removeBackground(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options: BackgroundRemovalOptions,
  generateMask = true
): BgRemovalResult {
  const detected = detectBackgroundColor(data, width, height);

  let targetR = detected.r;
  let targetG = detected.g;
  let targetB = detected.b;

  if (options.targetColor) {
    const parsed = parseHexColor(options.targetColor);
    if (parsed) {
      targetR = parsed.r;
      targetG = parsed.g;
      targetB = parsed.b;
    }
  }

  // Tolerance 0..100 mapped to Euclidean distance threshold (max ≈ 441.67)
  const tol = typeof options.tolerance === 'number' ? Math.max(0, Math.min(100, options.tolerance)) : 20;
  const threshold = (tol / 100) * 441.67;

  const mode = options.mode || 'flood';
  const totalPixels = width * height;
  const isRemoved = new Uint8Array(totalPixels);

  if (mode === 'global') {
    // Mode: Global Color Match (Every matching pixel across entire canvas)
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (a > 0 && colorDistance(r, g, b, targetR, targetG, targetB) <= threshold) {
        isRemoved[i] = 1;
      }
    }
  } else {
    // Mode: Contiguous Flood Fill from image borders
    // Uses a flat 1D queue with Uint32Array for zero heap garbage on multi-megapixel buffers
    const queue = new Int32Array(totalPixels);
    let head = 0;
    let tail = 0;

    const matchesBg = (x: number, y: number): boolean => {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] === 0) return false;
      return colorDistance(data[idx], data[idx + 1], data[idx + 2], targetR, targetG, targetB) <= threshold;
    };

    // Seed outer border pixels
    for (let x = 0; x < width; x++) {
      // Top row
      if (!isRemoved[x] && matchesBg(x, 0)) {
        isRemoved[x] = 1;
        queue[tail++] = x; // y = 0
      }
      // Bottom row
      const bottomIdx = (height - 1) * width + x;
      if (!isRemoved[bottomIdx] && matchesBg(x, height - 1)) {
        isRemoved[bottomIdx] = 1;
        queue[tail++] = bottomIdx;
      }
    }

    for (let y = 1; y < height - 1; y++) {
      // Left edge
      const leftIdx = y * width;
      if (!isRemoved[leftIdx] && matchesBg(0, y)) {
        isRemoved[leftIdx] = 1;
        queue[tail++] = leftIdx;
      }
      // Right edge
      const rightIdx = y * width + (width - 1);
      if (!isRemoved[rightIdx] && matchesBg(width - 1, y)) {
        isRemoved[rightIdx] = 1;
        queue[tail++] = rightIdx;
      }
    }

    // Seed any custom island coordinates requested by the user
    if (options.seeds && options.seeds.length > 0) {
      for (const s of options.seeds) {
        // Support normalized coordinates (0..1) or absolute pixel coordinates
        const px = s.x <= 1.0 && s.x >= 0 ? Math.round(s.x * (width - 1)) : Math.round(s.x);
        const py = s.y <= 1.0 && s.y >= 0 ? Math.round(s.y * (height - 1)) : Math.round(s.y);

        if (px >= 0 && px < width && py >= 0 && py < height) {
          // Search 5x5 window around clicked seed point to find nearest matching background pixel
          let bestIdx = -1;
          let minD = Infinity;

          for (let dy = -2; dy <= 2; dy++) {
            const sy = py + dy;
            if (sy < 0 || sy >= height) continue;
            for (let dx = -2; dx <= 2; dx++) {
              const sx = px + dx;
              if (sx < 0 || sx >= width) continue;

              const idx = (sy * width + sx) * 4;
              const d = colorDistance(data[idx], data[idx + 1], data[idx + 2], targetR, targetG, targetB);
              if (d <= threshold && d < minD) {
                minD = d;
                bestIdx = sy * width + sx;
              }
            }
          }

          if (bestIdx !== -1 && !isRemoved[bestIdx]) {
            isRemoved[bestIdx] = 1;
            queue[tail++] = bestIdx;
          }
        }
      }
    }

    // Seed center background islands and enclosed letter cavities if enabled
    if (options.clearCenterIslands) {
      const minX = Math.round(width * 0.35);
      const maxX = Math.round(width * 0.65);
      const minY = Math.round(height * 0.30);
      const maxY = Math.round(height * 0.70);

      for (let y = minY; y <= maxY; y++) {
        const row = y * width;
        for (let x = minX; x <= maxX; x++) {
          const idx = row + x;
          if (!isRemoved[idx] && matchesBg(x, y)) {
            isRemoved[idx] = 1;
            queue[tail++] = idx;
          }
        }
      }
    }

    // BFS Queue execution
    while (head < tail) {
      const curr = queue[head++];
      const cy = Math.floor(curr / width);
      const cx = curr % width;

      // Check 4 neighbors
      // Up
      if (cy > 0) {
        const up = curr - width;
        if (!isRemoved[up] && matchesBg(cx, cy - 1)) {
          isRemoved[up] = 1;
          queue[tail++] = up;
        }
      }
      // Down
      if (cy < height - 1) {
        const down = curr + width;
        if (!isRemoved[down] && matchesBg(cx, cy + 1)) {
          isRemoved[down] = 1;
          queue[tail++] = down;
        }
      }
      // Left
      if (cx > 0) {
        const left = curr - 1;
        if (!isRemoved[left] && matchesBg(cx - 1, cy)) {
          isRemoved[left] = 1;
          queue[tail++] = left;
        }
      }
      // Right
      if (cx < width - 1) {
        const right = curr + 1;
        if (!isRemoved[right] && matchesBg(cx + 1, cy)) {
          isRemoved[right] = 1;
          queue[tail++] = right;
        }
      }
    }
  }

  // Edge Defringing (Matte Choke):
  // Eliminates white anti-aliasing halos and JPEG DCT ringing around outer curved boundaries
  const defringePixels = options.defringe !== undefined ? Math.max(0, Math.min(5, options.defringe)) : 2;
  if (defringePixels > 0) {
    const defringeThreshold = threshold * 1.5;
    const targetLum = 0.299 * targetR + 0.587 * targetG + 0.114 * targetB;

    for (let pass = 0; pass < defringePixels; pass++) {
      const candidates: number[] = [];

      for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
          const idx = row + x;
          if (isRemoved[idx]) continue;

          // Check if it neighbors an already-removed pixel
          const hasRemovedNeighbor =
            (x > 0 && isRemoved[idx - 1]) ||
            (x < width - 1 && isRemoved[idx + 1]) ||
            (y > 0 && isRemoved[idx - width]) ||
            (y < height - 1 && isRemoved[idx + width]);

          if (hasRemovedNeighbor) {
            const pIdx = idx * 4;
            const r = data[pIdx];
            const g = data[pIdx + 1];
            const b = data[pIdx + 2];
            const d = colorDistance(r, g, b, targetR, targetG, targetB);
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;

            // Only remove if it's a fringe pixel (close to background color or high-luminance halo)
            if (d <= defringeThreshold || (targetLum > 200 && lum > 165)) {
              candidates.push(idx);
            }
          }
        }
      }

      for (let i = 0; i < candidates.length; i++) {
        isRemoved[candidates[i]] = 1;
      }
    }
  }

  // Apply transparency to input data buffer & optionally generate visual mask
  let removedCount = 0;
  let maskData: Uint8ClampedArray | undefined;
  if (generateMask) {
    maskData = new Uint8ClampedArray(totalPixels * 4);
  }

  for (let i = 0; i < totalPixels; i++) {
    if (isRemoved[i]) {
      const idx = i * 4;
      data[idx + 3] = 0; // Set Alpha to 0 (100% transparent)
      removedCount++;

      if (maskData) {
        // High-contrast translucent neon magenta overlay (#FF007F at 65% alpha)
        maskData[idx] = 255;
        maskData[idx + 1] = 0;
        maskData[idx + 2] = 127;
        maskData[idx + 3] = 175;
      }
    }
  }

  return {
    removedCount,
    detectedColor: {
      r: targetR,
      g: targetG,
      b: targetB,
      hex: rgbToHex(targetR, targetG, targetB),
    },
    maskData,
  };
}
