import { describe, it, expect } from 'vitest';
import { compressRLE } from '../src/engine/rle';
import { generateSvg } from '../src/engine/svg';
import { QUALITY_TIERS } from '../src/engine/types';
import { executeConversionPipeline } from '../src/engine/pipeline';

describe('Test Suite: Vectorization Optimizations', () => {
  it('consolidates 2D vertical scanlines into multi-height rectangles', () => {
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4);

    // Solid red 10x10 block
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = 255;
      data[i * 4 + 1] = 0;
      data[i * 4 + 2] = 0;
      data[i * 4 + 3] = 255;
    }

    // 1D compression produces 10 runs (1 per scanline)
    const rle1D = compressRLE(data, width, height, { merge2D: false });
    expect(rle1D.runs).toHaveLength(10);
    expect(rle1D.runs[0].height).toBeUndefined();

    // 2D greedy meshing merges all 10 rows into 1 single rectangle with height=10
    const rle2D = compressRLE(data, width, height, { merge2D: true });
    expect(rle2D.runs).toHaveLength(1);
    expect(rle2D.runs[0].width).toBe(10);
    expect(rle2D.runs[0].height).toBe(10);
    expect(rle2D.runs[0].r).toBe(255);
  });

  it('generates compact color-grouped <path> markup with subpaths', () => {
    const runs = [
      { x: 0, y: 0, width: 10, height: 2, r: 255, g: 0, b: 0, a: 255 },
      { x: 20, y: 0, width: 10, height: 2, r: 255, g: 0, b: 0, a: 255 },
      { x: 0, y: 5, width: 30, height: 1, r: 0, g: 0, b: 255, a: 255 },
    ];

    const { svgText, stats } = generateSvg(runs, 40, 10, 0, 1000, 1, {
      pathGrouping: true,
    });

    // Valid root and crispEdges
    expect(svgText).toContain('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 10"');
    expect(svgText).toContain('shape-rendering="crispEdges"');

    // Groups red runs into single <path> with multiple M... subpaths
    expect(svgText).toContain('<path fill="#FF0000" d="M0 0h10v2h-10z M20 0h10v2h-10z"/>');
    // Blue run in its own <path>
    expect(svgText).toContain('<path fill="#0000FF" d="M0 5h30v1h-30z"/>');

    // Only 2 path elements generated instead of 3 rect elements
    expect(stats.elementCount).toBe(2);
    expect(svgText).not.toContain('<rect');
  });

  it('merges 2D shapes with 1-pixel horizontal step offsets into multi-height rectangles (no scanline fragmentation)', () => {
    const width = 12;
    const height = 2;
    const data = new Uint8ClampedArray(width * height * 4); // All zeros (transparent)

    // Row 0 has width 10 (x: 0..9)
    for (let x = 0; x < 10; x++) {
      const idx = (0 * width + x) * 4;
      data[idx] = 36; data[idx + 1] = 52; data[idx + 2] = 86; data[idx + 3] = 255;
    }
    // Row 1 has width 12 (x: 0..11) - 2px wider than Row 0
    for (let x = 0; x < 12; x++) {
      const idx = (1 * width + x) * 4;
      data[idx] = 36; data[idx + 1] = 52; data[idx + 2] = 86; data[idx + 3] = 255;
    }

    const { runs } = compressRLE(data, width, height, { merge2D: true });

    // 2D greedy meshing finds the shared 10x2 rectangle across both rows
    const multiRowRect = runs.find((r) => r.height === 2);
    expect(multiRowRect).toBeDefined();
    expect(multiRowRect?.x).toBe(0);
    expect(multiRowRect?.width).toBe(10);
    expect(multiRowRect?.height).toBe(2);

    // The remaining 2px overhang on row 1 is handled cleanly as a 2x1 run
    const overhang = runs.find((r) => r.x === 10);
    expect(overhang).toBeDefined();
    expect(overhang?.width).toBe(2);
    expect(overhang?.y).toBe(1);
  });

  it('provides dedicated quality tiers for digital screens and physical display materials', () => {
    expect(QUALITY_TIERS).toBeDefined();

    // Verify digital tiers
    const standardHd = QUALITY_TIERS.find((t) => t.id === 'standard');
    expect(standardHd).toBeDefined();
    expect(standardHd!.dimension).toBe(1280);

    const ultra2k = QUALITY_TIERS.find((t) => t.id === 'ultra2k');
    expect(ultra2k).toBeDefined();
    expect(ultra2k!.dimension).toBe(2048);

    // Verify physical display materials tiers (8.5x11, table cover, conference backdrop)
    const letter = QUALITY_TIERS.find((t) => t.id === 'letter');
    expect(letter).toBeDefined();
    expect(letter!.dimension).toBe(2550); // 8.5"x11" at 300 DPI
    expect(letter!.category).toBe('print');

    const tableCover = QUALITY_TIERS.find((t) => t.id === 'tableCover');
    expect(tableCover).toBeDefined();
    expect(tableCover!.dimension).toBe(3840); // 4K Conference Table Cover & Banner
    expect(tableCover!.category).toBe('print');

    const backdrop = QUALITY_TIERS.find((t) => t.id === 'backdrop');
    expect(backdrop).toBeDefined();
    expect(backdrop!.dimension).toBe(6144); // 6K Grand Format Backdrop
    expect(backdrop!.category).toBe('print');
  });

  it('runs executeConversionPipeline cleanly with progress reports', async () => {
    const { encode: encodePng } = await import('fast-png');
    const width = 8;
    const height = 8;
    const data = new Uint8Array(width * height * 4);
    data.fill(255); // Solid white

    const png = encodePng({ width, height, data });
    const steps: string[] = [];

    const { svgText, stats } = await executeConversionPipeline(
      png.buffer as ArrayBuffer,
      'image/png',
      png.byteLength,
      { merge2D: true, pathGrouping: true },
      (step) => {
        steps.push(step);
      }
    );

    expect(steps).toContain('decoding');
    expect(steps).toContain('compressing');
    expect(steps).toContain('generating');
    expect(stats.vectorRuns).toBe(1); // 8x8 solid white collapses to 1 rect
    expect(svgText).toContain('<svg');
  });

  it('generates previewBlob when OffscreenCanvas is available in runtime', async () => {
    const { encode: encodePng } = await import('fast-png');
    const width = 4;
    const height = 4;
    const data = new Uint8Array(width * height * 4);
    data.fill(128);

    const png = encodePng({ width, height, data });

    // Mock OffscreenCanvas and createImageBitmap if not in environment
    const originalOffscreen = globalThis.OffscreenCanvas;
    const originalBitmap = globalThis.createImageBitmap;
    const mockBlob = new Blob(['mock-png'], { type: 'image/png' });
    globalThis.OffscreenCanvas = class MockOffscreenCanvas {
      width: number;
      height: number;
      constructor(w: number, h: number) {
        this.width = w;
        this.height = h;
      }
      getContext() {
        return {
          putImageData: () => {},
          drawImage: () => {},
          getImageData: () => ({ data: new Uint8ClampedArray(data) }),
        };
      }
      async convertToBlob() {
        return mockBlob;
      }
    } as unknown as typeof OffscreenCanvas;

    globalThis.createImageBitmap = (async () => ({
      width,
      height,
      close: () => {},
    })) as unknown as typeof createImageBitmap;

    try {
      const result = await executeConversionPipeline(
        png.buffer as ArrayBuffer,
        'image/png',
        png.byteLength,
        { maxDimension: 4, merge2D: true, pathGrouping: true }
      );

      expect(result.previewBlob).toBeDefined();
      expect(result.previewBlob).toBe(mockBlob);
      expect(result.stats.width).toBe(4);
      expect(result.stats.height).toBe(4);
    } finally {
      globalThis.OffscreenCanvas = originalOffscreen;
      globalThis.createImageBitmap = originalBitmap;
    }
  });

  it('preserves Conference Backdrop preset resolution ceiling (6144px)', () => {
    const backdropTier = QUALITY_TIERS.find((t) => t.id === 'backdrop');
    expect(backdropTier).toBeDefined();
    expect(backdropTier!.dimension).toBe(6144);
    expect(backdropTier!.category).toBe('print');
    expect(backdropTier!.label).toContain('Conference Backdrop');
  });

  it('scales smaller images up to match target maxDimension', async () => {
    const { decodeViaBitmap } = await import('../src/engine/decoder');

    const originalBitmap = globalThis.createImageBitmap;
    const originalOffscreen = globalThis.OffscreenCanvas;

    const sourceW = 100;
    const sourceH = 50;

    globalThis.createImageBitmap = (async () => ({
      width: sourceW,
      height: sourceH,
      close: () => {},
    })) as unknown as typeof createImageBitmap;

    globalThis.OffscreenCanvas = class MockCanvas {
      width: number;
      height: number;
      constructor(w: number, h: number) {
        this.width = w;
        this.height = h;
      }
      getContext() {
        return {
          drawImage: () => {},
          getImageData: (_x: number, _y: number, w: number, h: number) => ({
            data: new Uint8ClampedArray(w * h * 4),
          }),
        };
      }
    } as unknown as typeof OffscreenCanvas;

    try {
      const decoded = await decodeViaBitmap(new ArrayBuffer(16), 'image/jpeg', 1280, 'smooth');
      expect(decoded.width).toBe(1280);
      expect(decoded.height).toBe(640);
    } finally {
      globalThis.createImageBitmap = originalBitmap;
      globalThis.OffscreenCanvas = originalOffscreen;
    }
  });
});
