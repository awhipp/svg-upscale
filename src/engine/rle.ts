import { RLERun } from './types';

export interface RLEOptions {
  merge2D?: boolean; // Consolidate vertically adjacent runs into multi-height rects (default: false)
}

export interface RLECompressionResult {
  runs: RLERun[];
  transparentSkipped: number;
}

/**
 * 2D Greedy Meshing:
 * Decomposes a 2D pixel grid into maximal rectangular tiles.
 * Merges vertically and horizontally adjacent identical pixels into solid 2D rectangles,
 * eliminating 1-pixel horizontal scanline fragmentation and interlacing artifacts.
 */
export function meshGreedy2D(
  u32: Uint32Array,
  width: number,
  height: number
): { runs: RLERun[]; transparentSkipped: number } {
  const visited = new Uint8Array(width * height);
  const runs: RLERun[] = [];
  let transparentSkipped = 0;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    let x = 0;

    while (x < width) {
      const idx = rowOffset + x;
      if (visited[idx]) {
        x++;
        continue;
      }

      const pixel = u32[idx];
      const a = (pixel >>> 24) & 0xff;

      if (a === 0) {
        // Skip horizontal run of transparent pixels
        let w = 1;
        while (
          x + w < width &&
          !visited[idx + w] &&
          ((u32[idx + w] >>> 24) & 0xff) === 0
        ) {
          w++;
        }
        transparentSkipped += w;
        visited.fill(1, idx, idx + w);
        x += w;
        continue;
      }

      // Find maximal horizontal span of identical pixel on this row
      let w = 1;
      while (x + w < width && !visited[idx + w] && u32[idx + w] === pixel) {
        w++;
      }

      // Find maximal vertical span sharing this exact horizontal slice
      let h = 1;
      while (y + h < height) {
        const nextRowOffset = (y + h) * width + x;
        let match = true;
        for (let k = 0; k < w; k++) {
          if (visited[nextRowOffset + k] || u32[nextRowOffset + k] !== pixel) {
            match = false;
            break;
          }
        }
        if (!match) break;
        h++;
      }

      // Mark all cells in this rectangle as visited
      for (let dy = 0; dy < h; dy++) {
        const markOffset = (y + dy) * width + x;
        visited.fill(1, markOffset, markOffset + w);
      }

      runs.push({
        x,
        y,
        width: w,
        height: h > 1 ? h : undefined,
        r: pixel & 0xff,
        g: (pixel >>> 8) & 0xff,
        b: (pixel >>> 16) & 0xff,
        a,
      });

      x += w;
    }
  }

  return { runs, transparentSkipped };
}

/**
 * Performs run-length compression on a 4-channel RGBA byte array.
 * Strict 32-bit fast path guarantees bit-for-bit lossless parity (Delta E = 0).
 * Optionally consolidates vertical scanlines into 2D rectangles when merge2D is enabled.
 */
export function compressRLE(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options?: RLEOptions
): RLECompressionResult {
  const merge2D = options?.merge2D ?? false;

  // Utilize 32-bit integer array view for single-cycle CPU comparisons
  let u32: Uint32Array;
  if (
    data.byteOffset % 4 === 0 &&
    data.buffer.byteLength >= data.byteOffset + width * height * 4
  ) {
    u32 = new Uint32Array(data.buffer, data.byteOffset, width * height);
  } else {
    const aligned = new Uint8ClampedArray(data);
    u32 = new Uint32Array(aligned.buffer, aligned.byteOffset, width * height);
  }

  if (merge2D) {
    return meshGreedy2D(u32, width, height);
  }

  // 1D scanline compression (height undefined)
  let transparentSkipped = 0;
  const flatRuns: RLERun[] = [];

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    let x = 0;

    while (x < width) {
      const pixel = u32[rowOffset + x];
      let runLen = 1;
      const a = (pixel >>> 24) & 0xff;

      if (a === 0) {
        while (
          x + runLen < width &&
          ((u32[rowOffset + x + runLen] >>> 24) & 0xff) === 0
        ) {
          runLen++;
        }
        transparentSkipped += runLen;
      } else {
        while (x + runLen < width && u32[rowOffset + x + runLen] === pixel) {
          runLen++;
        }

        const r = pixel & 0xff;
        const g = (pixel >>> 8) & 0xff;
        const b = (pixel >>> 16) & 0xff;
        flatRuns.push({
          x,
          y,
          width: runLen,
          r,
          g,
          b,
          a,
        });
      }

      x += runLen;
    }
  }

  return { runs: flatRuns, transparentSkipped };
}
