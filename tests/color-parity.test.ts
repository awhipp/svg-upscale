import { describe, it, expect } from 'vitest';
import { compressRLE } from '../src/engine/rle';
import { generateSvg, rgbToHex } from '../src/engine/svg';

describe('Test Suite 1: Color Parity Verification (Delta E = 0)', () => {
  it('encodes exact hex values for full-gamut primaries and limits', () => {
    expect(rgbToHex(255, 255, 255)).toBe('#FFFFFF');
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
    expect(rgbToHex(255, 0, 0)).toBe('#FF0000');
    expect(rgbToHex(0, 255, 0)).toBe('#00FF00');
    expect(rgbToHex(0, 0, 255)).toBe('#0000FF');
    expect(rgbToHex(255, 255, 0)).toBe('#FFFF00');
    expect(rgbToHex(0, 255, 255)).toBe('#00FFFF');
    expect(rgbToHex(255, 0, 255)).toBe('#FF00FF');
  });

  it('preserves discrete 8-bit RGBA color definitions without drift or rounding errors', () => {
    // 5x1 test buffer: White, Black, Red, Green, Blue
    const pixels = [
      [255, 255, 255, 255],
      [0, 0, 0, 255],
      [255, 0, 0, 255],
      [0, 255, 0, 255],
      [0, 0, 255, 255],
    ];

    const data = new Uint8ClampedArray(pixels.flat());
    const { runs } = compressRLE(data, 5, 1);
    const { svgText } = generateSvg(runs, 5, 1, 0, data.byteLength, 1);

    expect(runs).toHaveLength(5);
    expect(svgText).toContain('<rect x="0" y="0" width="1" height="1" fill="#FFFFFF"/>');
    expect(svgText).toContain('<rect x="1" y="0" width="1" height="1" fill="#000000"/>');
    expect(svgText).toContain('<rect x="2" y="0" width="1" height="1" fill="#FF0000"/>');
    expect(svgText).toContain('<rect x="3" y="0" width="1" height="1" fill="#00FF00"/>');
    expect(svgText).toContain('<rect x="4" y="0" width="1" height="1" fill="#0000FF"/>');
  });

  it('accurately maps semi-transparent alpha variants to fill-opacity', () => {
    // 3x1 buffer: 50% alpha red (128/255), 25% alpha green (64/255), 75% alpha blue (191/255)
    const pixels = [
      [255, 0, 0, 128],
      [0, 255, 0, 64],
      [0, 0, 255, 191],
    ];

    const data = new Uint8ClampedArray(pixels.flat());
    const { runs } = compressRLE(data, 3, 1);
    const { svgText } = generateSvg(runs, 3, 1, 0, data.byteLength, 1);

    expect(runs).toHaveLength(3);

    const expectedAlpha0 = Number((128 / 255).toFixed(4));
    const expectedAlpha1 = Number((64 / 255).toFixed(4));
    const expectedAlpha2 = Number((191 / 255).toFixed(4));

    expect(svgText).toContain(
      `<rect x="0" y="0" width="1" height="1" fill="#FF0000" fill-opacity="${expectedAlpha0}"/>`
    );
    expect(svgText).toContain(
      `<rect x="1" y="0" width="1" height="1" fill="#00FF00" fill-opacity="${expectedAlpha1}"/>`
    );
    expect(svgText).toContain(
      `<rect x="2" y="0" width="1" height="1" fill="#0000FF" fill-opacity="${expectedAlpha2}"/>`
    );
  });
});
