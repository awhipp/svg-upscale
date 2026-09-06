import { describe, it, expect } from 'vitest';
import { encode as encodePng } from 'fast-png';
import { decodePngBuffer, validateDimensions, isPng } from '../src/engine/decoder';
import { compressRLE } from '../src/engine/rle';
import { generateSvg } from '../src/engine/svg';

describe('Test Suite 4: Integration, Cross-Platform Consistency & Benchmarks', () => {
  it('correctly identifies PNG magic bytes', () => {
    const validPngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const invalidHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

    expect(isPng(validPngHeader.buffer)).toBe(true);
    expect(isPng(invalidHeader.buffer)).toBe(false);
  });

  it('rejects images exceeding 8192px dimension or 25 MP ceiling', () => {
    expect(() => validateDimensions(8193, 100)).toThrow(/exceed maximum allowed dimension/);
    expect(() => validateDimensions(100, 8193)).toThrow(/exceed maximum allowed dimension/);
    expect(() => validateDimensions(6000, 5000)).toThrow(/exceeds maximum limit/); // 30 MP > 25 MP
    expect(() => validateDimensions(0, 100)).toThrow(/Invalid image dimensions/);
    expect(() => validateDimensions(4452, 3840)).not.toThrow(); // logo.jpg fixture must pass!
  });

  it('end-to-end: encodes and decodes a synthetic PNG with identical byte consistency', () => {
    // 4x2 test image with distinct colors
    const rawRgba = new Uint8Array([
      // Row 0: Red, Green, Blue, White
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
      255, 255, 255, 255,
      // Row 1: Black, Yellow, Cyan, Magenta
      0, 0, 0, 255,
      255, 255, 0, 255,
      0, 255, 255, 255,
      255, 0, 255, 255,
    ]);

    const pngBuffer = encodePng({
      width: 4,
      height: 2,
      data: rawRgba,
    });

    const decoded = decodePngBuffer(pngBuffer.buffer as ArrayBuffer);
    expect(decoded.width).toBe(4);
    expect(decoded.height).toBe(2);

    const { runs } = compressRLE(decoded.data, decoded.width, decoded.height);
    const { svgText, stats } = generateSvg(runs, 4, 2, 0, pngBuffer.byteLength, 1);

    expect(stats.vectorRuns).toBe(8);
    expect(svgText).toContain('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 2" width="4" height="2" shape-rendering="crispEdges">');
    expect(svgText).toContain('<rect x="0" y="0" width="1" height="1" fill="#FF0000"/>');
    expect(svgText).toContain('<rect x="3" y="1" width="1" height="1" fill="#FF00FF"/>');
  });

  it('benchmark: converts a 512x512 image in under 250 milliseconds (TR-3 target)', () => {
    const width = 512;
    const height = 512;
    const totalPixels = width * height;
    const data = new Uint8ClampedArray(totalPixels * 4);

    // Create realistic pattern (bands of colors)
    for (let y = 0; y < height; y++) {
      const r = (y * 2) % 256;
      const g = (y * 3) % 256;
      const b = (y * 5) % 256;
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    const t0 = performance.now();
    const { runs, transparentSkipped } = compressRLE(data, width, height);
    const { svgText, stats } = generateSvg(
      runs,
      width,
      height,
      transparentSkipped,
      data.byteLength,
      performance.now() - t0
    );
    const elapsed = performance.now() - t0;

    expect(stats.vectorRuns).toBe(512); // 512 horizontal color bands, each compressed to 1 rect!
    expect(svgText.length).toBeGreaterThan(1000);
    expect(elapsed).toBeLessThan(250); // Well under 250ms target!
  });

  it('validates the workspace fixture og-image.png against limits', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const ogPath = path.resolve(__dirname, '../public/og-image.png');
    expect(fs.existsSync(ogPath)).toBe(true);

    const buf = fs.readFileSync(ogPath);
    expect(buf.length).toBeLessThan(25 * 1024 * 1024); // Well under 25 MB

    // Parse PNG IHDR chunk (bytes 16..24) for dimensions
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);

    expect(w).toBe(1376);
    expect(h).toBe(768);
    expect(() => validateDimensions(w, h)).not.toThrow();
  });
});
