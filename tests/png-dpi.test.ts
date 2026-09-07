import { describe, it, expect } from 'vitest';
import { encode, decode } from 'fast-png';
import {
  setPngDpi,
  getPngDpi,
  createPhysChunk,
  dpiToPixelsPerMetre,
  pixelsPerMetreToDpi,
  calculateCrc32,
  isPngSignature,
  DPI_PRESETS,
} from '../src/engine/png-dpi';

describe('PNG DPI Metadata Module', () => {
  // Create a minimal 2x2 8-bit RGBA test PNG
  function createTestPng(): Uint8Array {
    const data = new Uint8Array(2 * 2 * 4);
    // Fill with solid red
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
    return encode({
      width: 2,
      height: 2,
      data,
      depth: 8,
      channels: 4,
    });
  }

  it('validates PNG signature correctly', () => {
    const validPng = createTestPng();
    expect(isPngSignature(validPng)).toBe(true);

    const invalidBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(isPngSignature(invalidBytes)).toBe(false);
  });

  it('converts between DPI and pixels per metre accurately', () => {
    expect(dpiToPixelsPerMetre(100)).toBe(3937);
    expect(dpiToPixelsPerMetre(300)).toBe(11811);
    expect(dpiToPixelsPerMetre(72)).toBe(2835);
    expect(dpiToPixelsPerMetre(96)).toBe(3780);

    expect(Math.round(pixelsPerMetreToDpi(3937))).toBe(100);
    expect(Math.round(pixelsPerMetreToDpi(11811))).toBe(300);
  });

  it('computes CRC32 matching standard PNG requirements', () => {
    const chunk = createPhysChunk(100);
    // Chunk layout: 4 len, 4 type, 9 data, 4 crc
    const view = new DataView(chunk.buffer);
    const storedCrc = view.getUint32(17);
    const calculatedCrc = calculateCrc32(chunk, 4, 13);
    expect(storedCrc).toBe(calculatedCrc);
  });

  it('injects 100 DPI into a PNG without pHYs and verifies via fast-png with strict CRC checking', () => {
    const rawPng = createTestPng();
    expect(getPngDpi(rawPng)).toBeNull();

    const taggedPng = setPngDpi(rawPng, 100);
    expect(isPngSignature(taggedPng)).toBe(true);

    // Verify with internal parser
    const info = getPngDpi(taggedPng);
    expect(info).not.toBeNull();
    expect(info?.ppmX).toBe(3937);
    expect(info?.ppmY).toBe(3937);
    expect(info?.unit).toBe(1);
    expect(Math.round(info?.dpiX || 0)).toBe(100);

    // Verify using fast-png with checkCrc: true
    const decoded = decode(taggedPng, { checkCrc: true });
    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(2);
    expect(decoded.resolution).toBeDefined();
    expect(decoded.resolution?.x).toBe(3937);
    expect(decoded.resolution?.y).toBe(3937);
    expect(decoded.resolution?.unit).toBe(1);
  });

  it('injects 300 DPI and replaces an existing pHYs chunk cleanly', () => {
    const rawPng = createTestPng();
    const tagged100 = setPngDpi(rawPng, 100);
    expect(getPngDpi(tagged100)?.ppmX).toBe(3937);

    // Now update to 300 DPI
    const tagged300 = setPngDpi(tagged100, 300);
    const info300 = getPngDpi(tagged300);
    expect(info300?.ppmX).toBe(11811);
    expect(info300?.ppmY).toBe(11811);
    expect(Math.round(info300?.dpiX || 0)).toBe(300);

    const decoded = decode(tagged300, { checkCrc: true });
    expect(decoded.resolution?.x).toBe(11811);
    expect(decoded.resolution?.y).toBe(11811);
  });

  it('handles all preset DPI values consistently', () => {
    const rawPng = createTestPng();
    for (const preset of DPI_PRESETS) {
      const tagged = setPngDpi(rawPng, preset.dpi);
      const decoded = decode(tagged, { checkCrc: true });
      const expectedPpm = dpiToPixelsPerMetre(preset.dpi);
      expect(decoded.resolution?.x).toBe(expectedPpm);
      expect(decoded.resolution?.y).toBe(expectedPpm);
    }
  });

  it('throws on invalid input or non-positive DPI', () => {
    const invalidBuffer = new Uint8Array([0, 0, 0, 0]);
    expect(() => setPngDpi(invalidBuffer, 100)).toThrow('Invalid PNG signature');

    const validPng = createTestPng();
    expect(() => setPngDpi(validPng, 0)).toThrow('Invalid DPI value');
    expect(() => setPngDpi(validPng, -50)).toThrow('Invalid DPI value');
  });
});
