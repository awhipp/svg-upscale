import { decodeImage } from './decoder';
import { compressRLE } from './rle';
import { generateSvg } from './svg';
import { ConversionOptions, ConversionProgress, VectorStats } from './types';

/**
 * Shared core execution pipeline for raster-to-SVG vector conversion.
 * Executes identically on main thread or background Web Worker.
 */
export async function executeConversionPipeline(
  buffer: ArrayBuffer,
  mimeType: string,
  rasterBytes: number,
  options: ConversionOptions,
  reportProgress?: (step: ConversionProgress['step'], progress: number, message: string) => void
): Promise<{ svgText: string; stats: VectorStats; previewBlob?: Blob }> {
  const startTime = performance.now();

  reportProgress?.('decoding', 20, 'Decoding image datastream...');
  const decoded = await decodeImage(
    buffer,
    mimeType,
    options.maxDimension,
    options.resamplingMode
  );

  reportProgress?.('compressing', 50, 'Compressing run-lengths...');
  const { runs, transparentSkipped } = compressRLE(
    decoded.data,
    decoded.width,
    decoded.height,
    {
      merge2D: options.merge2D ?? true,
    }
  );

  reportProgress?.('generating', 80, 'Generating vector SVG markup & preview...');
  const durationMs = performance.now() - startTime;
  const { svgText, stats } = generateSvg(
    runs,
    decoded.width,
    decoded.height,
    transparentSkipped,
    rasterBytes,
    durationMs,
    {
      pathGrouping: options.pathGrouping ?? true,
    }
  );
  stats.resamplingMode = options.resamplingMode;

  // Generate 1:1 lossless preview texture for high-performance 60 FPS viewport
  let previewBlob: Blob | undefined;
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const pCanvas = new OffscreenCanvas(decoded.width, decoded.height);
      const pCtx = pCanvas.getContext('2d');
      if (pCtx) {
        const imgData =
          typeof ImageData !== 'undefined'
            ? new ImageData(
                decoded.data as unknown as Uint8ClampedArray<ArrayBuffer>,
                decoded.width,
                decoded.height
              )
            : ({ data: decoded.data, width: decoded.width, height: decoded.height } as unknown as ImageData);
        pCtx.putImageData(imgData, 0, 0);

        try {
          previewBlob = await pCanvas.convertToBlob({ type: 'image/webp', quality: 1.0 });
        } catch {
          previewBlob = await pCanvas.convertToBlob({ type: 'image/png' });
        }
      }
    } catch (e) {
      console.warn('Could not generate OffscreenCanvas preview blob:', e);
    }
  }

  return { svgText, stats, previewBlob };
}
