import { describe, it, expect } from 'vitest';
import { compressRLE } from '../src/engine/rle';
import { generateSvg } from '../src/engine/svg';

describe('Test Suite 3: Run-Length Compression Efficiency', () => {
  it('compresses a horizontal run of N identical pixels into exactly 1 vector rectangle with width=N', () => {
    const N = 64;
    const height = 1;
    const data = new Uint8ClampedArray(N * 4);

    // All pixels are cyan: RGBA(0, 255, 255, 255)
    for (let i = 0; i < N * 4; i += 4) {
      data[i] = 0;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 255;
    }

    const { runs, transparentSkipped } = compressRLE(data, N, height);
    const { svgText } = generateSvg(runs, N, height, transparentSkipped, data.byteLength, 1);

    expect(runs).toHaveLength(1);
    expect(runs[0].width).toBe(N);
    expect(runs[0].x).toBe(0);
    expect(runs[0].y).toBe(0);
    expect(transparentSkipped).toBe(0);

    expect(svgText).toContain(`<rect x="0" y="0" width="${N}" height="1" fill="#00FFFF"/>`);
  });

  it('generates zero vector nodes for fully transparent regions (A = 0)', () => {
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4); // All zeros (transparent)

    // Put a single 1x1 pixel in the center (x=5, y=5)
    const centerIdx = (5 * width + 5) * 4;
    data[centerIdx] = 255;
    data[centerIdx + 1] = 128;
    data[centerIdx + 2] = 0;
    data[centerIdx + 3] = 255;

    const { runs, transparentSkipped } = compressRLE(data, width, height);
    const { svgText, stats } = generateSvg(
      runs,
      width,
      height,
      transparentSkipped,
      data.byteLength,
      1
    );

    // Only 1 vector rectangle generated out of 100 pixels
    expect(runs).toHaveLength(1);
    expect(stats.vectorRuns).toBe(1);
    expect(stats.transparentSkipped).toBe(99);
    expect(svgText).toContain('<rect x="5" y="5" width="1" height="1" fill="#FF8000"/>');
  });

  it('correctly handles alternating patterns and multiple runs per scanline', () => {
    // 6x1 alternating: [Red, Red, Blue, Blue, Blue, Red]
    const colors = [
      [255, 0, 0, 255],
      [255, 0, 0, 255],
      [0, 0, 255, 255],
      [0, 0, 255, 255],
      [0, 0, 255, 255],
      [255, 0, 0, 255],
    ];

    const data = new Uint8ClampedArray(colors.flat());
    const { runs } = compressRLE(data, 6, 1);

    expect(runs).toHaveLength(3);
    expect(runs[0]).toEqual({ x: 0, y: 0, width: 2, r: 255, g: 0, b: 0, a: 255 });
    expect(runs[1]).toEqual({ x: 2, y: 0, width: 3, r: 0, g: 0, b: 255, a: 255 });
    expect(runs[2]).toEqual({ x: 5, y: 0, width: 1, r: 255, g: 0, b: 0, a: 255 });
  });
});
