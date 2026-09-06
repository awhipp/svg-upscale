import { describe, it, expect } from 'vitest';
import { compressRLE } from '../src/engine/rle';
import { generateSvg } from '../src/engine/svg';

describe('Test Suite 2: Spatial and Geometry Bounds', () => {
  it('generates root width, height, and viewBox matching non-square input dimensions', () => {
    const width = 17;
    const height = 43;
    const data = new Uint8ClampedArray(width * height * 4);

    // Fill with an arbitrary solid color
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 120;
      data[i + 1] = 200;
      data[i + 2] = 250;
      data[i + 3] = 255;
    }

    const { runs } = compressRLE(data, width, height);
    const { svgText, stats } = generateSvg(runs, width, height, 0, data.byteLength, 1);

    expect(stats.width).toBe(17);
    expect(stats.height).toBe(43);
    expect(stats.originalPixels).toBe(17 * 43);

    // Root tag validation
    expect(svgText).toContain('viewBox="0 0 17 43"');
    expect(svgText).toContain('width="17"');
    expect(svgText).toContain('height="43"');
    expect(svgText).toContain('shape-rendering="crispEdges"');
  });

  it('correctly maps boundary edge pixels to exact coordinate limits', () => {
    const width = 5;
    const height = 7;
    const data = new Uint8ClampedArray(width * height * 4); // All zeros (transparent)

    // Set 4 corners to distinct colors
    // Top-left (0, 0): Red
    const tl = (0 * width + 0) * 4;
    data[tl] = 255; data[tl + 1] = 0; data[tl + 2] = 0; data[tl + 3] = 255;

    // Top-right (4, 0): Green
    const tr = (0 * width + 4) * 4;
    data[tr] = 0; data[tr + 1] = 255; data[tr + 2] = 0; data[tr + 3] = 255;

    // Bottom-left (0, 6): Blue
    const bl = (6 * width + 0) * 4;
    data[bl] = 0; data[bl + 1] = 0; data[bl + 2] = 255; data[bl + 3] = 255;

    // Bottom-right (4, 6): Yellow
    const br = (6 * width + 4) * 4;
    data[br] = 255; data[br + 1] = 255; data[br + 2] = 0; data[br + 3] = 255;

    const { runs } = compressRLE(data, width, height);
    const { svgText } = generateSvg(runs, width, height, 0, data.byteLength, 1);

    expect(runs).toHaveLength(4);

    // Assert top-left at (0, 0)
    expect(svgText).toContain('<rect x="0" y="0" width="1" height="1" fill="#FF0000"/>');
    // Assert top-right at (4, 0)
    expect(svgText).toContain('<rect x="4" y="0" width="1" height="1" fill="#00FF00"/>');
    // Assert bottom-left at (0, 6)
    expect(svgText).toContain('<rect x="0" y="6" width="1" height="1" fill="#0000FF"/>');
    // Assert bottom-right at (4, 6)
    expect(svgText).toContain('<rect x="4" y="6" width="1" height="1" fill="#FFFF00"/>');
  });
});
