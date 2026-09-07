import { describe, it, expect } from 'vitest';
import {
  detectBackgroundColor,
  colorDistance,
  parseHexColor,
  removeBackground,
  rgbToHex,
} from '../src/engine/bg-removal';
import { compressRLE } from '../src/engine/rle';
import { generateSvg } from '../src/engine/svg';

describe('Background Removal Unit Tests', () => {
  it('detectBackgroundColor averages 4 corners with noisy values', () => {
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4).fill(0);

    // Fill all pixels with black initially
    for (let i = 0; i < width * height; i++) {
      data[i * 4 + 3] = 255;
    }

    // Set corner 2x2 patches to near-white off-white JPEG variations (e.g. #F5FEFD, #F4FDFC)
    const setPixel = (x: number, y: number, r: number, g: number, b: number) => {
      const idx = (y * width + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    };

    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        setPixel(dx, dy, 245, 254, 253);
        setPixel(width - 1 - dx, dy, 244, 253, 252);
        setPixel(dx, height - 1 - dy, 243, 253, 252);
        setPixel(width - 1 - dx, height - 1 - dy, 246, 254, 253);
      }
    }

    const detected = detectBackgroundColor(data, width, height);
    expect(detected.r).toBeGreaterThan(240);
    expect(detected.g).toBeGreaterThan(250);
    expect(detected.b).toBeGreaterThan(250);
    expect(detected.hex.startsWith('#F')).toBe(true);
  });

  it('colorDistance computes accurate Euclidean distance', () => {
    expect(colorDistance(255, 255, 255, 255, 255, 255)).toBe(0);
    const maxDist = colorDistance(0, 0, 0, 255, 255, 255);
    expect(Math.round(maxDist)).toBe(442);
  });

  it('parseHexColor and rgbToHex handle standard formats', () => {
    expect(rgbToHex(255, 0, 127)).toBe('#FF007F');
    expect(parseHexColor('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHexColor('#000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseHexColor('invalid')).toBeNull();
  });

  it('flood mode removes outer border while preserving enclosed inner cavities', () => {
    // Construct a 10x10 image:
    // Outer border: White (255, 255, 255)
    // Box ring (x=2..7, y=2..7): Black (0, 0, 0)
    // Enclosed cavity (x=4..5, y=4..5): White (255, 255, 255)
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const isRing =
          (x >= 2 && x <= 7 && (y === 2 || y === 7)) ||
          (y >= 2 && y <= 7 && (x === 2 || x === 7));

        if (isRing) {
          data[idx] = 0; // Black ring
          data[idx + 1] = 0;
          data[idx + 2] = 0;
        } else {
          data[idx] = 255; // White background and white inner cavity
          data[idx + 1] = 255;
          data[idx + 2] = 255;
        }
        data[idx + 3] = 255; // Fully opaque
      }
    }

    const result = removeBackground(data, width, height, {
      enabled: true,
      mode: 'flood',
      tolerance: 20,
    });

    expect(result.removedCount).toBeGreaterThan(0);

    // 1. Top-left corner (0,0) must be transparent (A = 0)
    expect(data[0 * 4 + 3]).toBe(0);

    // 2. Black ring at (2,2) must remain opaque (A = 255)
    const ringIdx = (2 * width + 2) * 4;
    expect(data[ringIdx + 3]).toBe(255);
    expect(data[ringIdx]).toBe(0);

    // 3. Inner cavity at (4,4) was enclosed, so in flood mode it MUST remain opaque (A = 255)
    const cavityIdx = (4 * width + 4) * 4;
    expect(data[cavityIdx + 3]).toBe(255);
    expect(data[cavityIdx]).toBe(255);
  });

  it('global mode removes both outer background and inner enclosed cavities', () => {
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const isRing =
          (x >= 2 && x <= 7 && (y === 2 || y === 7)) ||
          (y >= 2 && y <= 7 && (x === 2 || x === 7));

        if (isRing) {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
        } else {
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
        }
        data[idx + 3] = 255;
      }
    }

    removeBackground(data, width, height, {
      enabled: true,
      mode: 'global',
      tolerance: 20,
    });

    // In global mode, both outer corner and inner cavity must be cleared (A = 0)
    expect(data[0 * 4 + 3]).toBe(0);
    const ringIdx = (2 * width + 2) * 4;
    expect(data[ringIdx + 3]).toBe(255);
    const cavityIdx = (4 * width + 4) * 4;
    expect(data[cavityIdx + 3]).toBe(0);
  });

  it('tolerance absorbs JPEG off-white noise without removing darker graphics', () => {
    const width = 4;
    const height = 4;
    const data = new Uint8ClampedArray(width * height * 4);

    // Fill with slight off-white JPEG artifact: (248, 252, 251)
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = 248;
      data[i * 4 + 1] = 252;
      data[i * 4 + 2] = 251;
      data[i * 4 + 3] = 255;
    }

    // Place one blue logo pixel at (2,2)
    const logoIdx = (2 * width + 2) * 4;
    data[logoIdx] = 10;
    data[logoIdx + 1] = 80;
    data[logoIdx + 2] = 200;

    removeBackground(data, width, height, {
      enabled: true,
      mode: 'flood',
      tolerance: 20,
    });

    // Off-white background is cleared
    expect(data[0 * 4 + 3]).toBe(0);
    // Blue logo pixel remains strictly preserved
    expect(data[logoIdx + 3]).toBe(255);
    expect(data[logoIdx]).toBe(10);
    expect(data[logoIdx + 1]).toBe(80);
    expect(data[logoIdx + 2]).toBe(200);
  });

  it('RLE engine skips pixels cleared by removeBackground, emitting 0 background paths in SVG', () => {
    const width = 8;
    const height = 8;
    const data = new Uint8ClampedArray(width * height * 4).fill(255); // Solid white

    // Place a single red 2x2 square in center
    for (let y = 3; y <= 4; y++) {
      for (let x = 3; x <= 4; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = 255;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
      }
    }

    // Before removal: RLE should produce runs for both white background and red square
    const before = compressRLE(data.slice(0), width, height, { merge2D: true });
    expect(before.runs.length).toBeGreaterThan(1);

    // After removal: Background cleared
    removeBackground(data, width, height, { enabled: true, tolerance: 10 });
    const after = compressRLE(data, width, height, { merge2D: true });

    // ONLY the red square runs should remain!
    expect(after.runs.length).toBe(1);
    expect(after.runs[0].r).toBe(255);
    expect(after.runs[0].g).toBe(0);
    expect(after.runs[0].b).toBe(0);
    expect(after.transparentSkipped).toBe(60); // 64 total - 4 red square = 60 skipped

    // Generate SVG and assert zero white background paths exist
    const { svgText } = generateSvg(after.runs, width, height, after.transparentSkipped, 100, 10);
    expect(svgText).toContain('fill="#FF0000"');
    expect(svgText).not.toContain('fill="#FFFFFF"');
  });

  it('custom island seeds flood-fill enclosed cavities when clicked/selected', () => {
    // 10x10 with enclosed white cavity at (4,4)
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4).fill(255);

    // Black ring at x=2..7, y=2..7
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const isRing =
          (x >= 2 && x <= 7 && (y === 2 || y === 7)) ||
          (y >= 2 && y <= 7 && (x === 2 || x === 7));
        if (isRing) {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
        }
      }
    }

    // Pass seed pointing directly at the cavity at (4, 4)
    removeBackground(data, width, height, {
      enabled: true,
      mode: 'flood',
      tolerance: 20,
      seeds: [{ x: 4, y: 4 }],
    });

    // Both outer background AND enclosed cavity are cleared!
    expect(data[0 * 4 + 3]).toBe(0); // outer
    const cavityIdx = (4 * width + 4) * 4;
    expect(data[cavityIdx + 3]).toBe(0); // inner cavity
    // Black ring preserved
    const ringIdx = (2 * width + 2) * 4;
    expect(data[ringIdx + 3]).toBe(255);
    expect(data[ringIdx]).toBe(0);
  });

  it('clearCenterIslands automatically clears central background while preserving outer white icons', () => {
    const width = 20;
    const height = 20;
    const data = new Uint8ClampedArray(width * height * 4);

    // Background: White
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = 255;
      data[i * 4 + 1] = 255;
      data[i * 4 + 2] = 255;
      data[i * 4 + 3] = 255;
    }

    // Top-left quadrant has a dark blue circle (x: 2..7, y: 2..7)
    // Inside that dark circle is a white microscope icon at (4, 4)
    for (let y = 2; y <= 7; y++) {
      for (let x = 2; x <= 7; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = 20; // dark blue
        data[idx + 1] = 40;
        data[idx + 2] = 70;
      }
    }
    // White microscope pixel at (4, 4)
    const iconIdx = (4 * width + 4) * 4;
    data[iconIdx] = 255;
    data[iconIdx + 1] = 255;
    data[iconIdx + 2] = 255;

    // Center has dark ring at x: 8..12, y: 8..12, with enclosed white island inside at (10, 10)
    for (let y = 8; y <= 12; y++) {
      for (let x = 8; x <= 12; x++) {
        if (x === 8 || x === 12 || y === 8 || y === 12) {
          const idx = (y * width + x) * 4;
          data[idx] = 40;
          data[idx + 1] = 40;
          data[idx + 2] = 40;
        }
      }
    }
    // Center island at (10, 10) is white (255, 255, 255)

    removeBackground(data, width, height, {
      enabled: true,
      mode: 'flood',
      tolerance: 20,
      clearCenterIslands: true,
    });

    // 1. Outer background is cleared
    expect(data[0 * 4 + 3]).toBe(0);

    // 2. White microscope icon inside top-left circle MUST REMAIN OPAQUE (A = 255)!
    expect(data[iconIdx + 3]).toBe(255);
    expect(data[iconIdx]).toBe(255);

    // 3. Center island at (10, 10) is cleared (A = 0)!
    const centerIslandIdx = (10 * width + 10) * 4;
    expect(data[centerIslandIdx + 3]).toBe(0);
  });

  it('defringe chokes transparent boundary, removing light transition halos', () => {
    const width = 6;
    const height = 1;
    const data = new Uint8ClampedArray(width * height * 4);

    // Pixels 0, 1: Pure white background (255, 255, 255)
    // Pixel 2: Transition halo (215, 215, 215)
    // Pixels 3, 4, 5: Dark subject (20, 20, 20)
    data[0] = 255; data[1] = 255; data[2] = 255; data[3] = 255;
    data[4] = 255; data[5] = 255; data[6] = 255; data[7] = 255;
    data[8] = 215; data[9] = 215; data[10] = 215; data[11] = 255; // halo
    data[12] = 20; data[13] = 20; data[14] = 20; data[15] = 255;
    data[16] = 20; data[17] = 20; data[18] = 20; data[19] = 255;
    data[20] = 20; data[21] = 20; data[22] = 20; data[23] = 255;

    removeBackground(data, width, height, {
      enabled: true,
      mode: 'flood',
      tolerance: 5, // Exact tolerance doesn't catch 215
      defringe: 1,  // Defringe removes the adjacent halo pixel
      targetColor: '#FFFFFF',
    });

    // Pixels 0, 1 cleared by base flood
    expect(data[3]).toBe(0);
    expect(data[7]).toBe(0);
    // Pixel 2 (halo) cleared by defringe!
    expect(data[11]).toBe(0);
    // Dark subject preserved
    expect(data[15]).toBe(255);
    expect(data[12]).toBe(20);
  });
});
