import { decodeImage } from './decoder';
import { compressRLE } from './rle';
import { generateSvg } from './svg';
import { removeBackground } from './bg-removal';
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
): Promise<{ svgText: string; stats: VectorStats; previewBlob?: Blob; maskBlob?: Blob }> {
  const startTime = performance.now();

  reportProgress?.('decoding', 20, 'Decoding image datastream...');
  const decoded = await decodeImage(
    buffer,
    mimeType,
    options.maxDimension,
    options.resamplingMode
  );

  // Optional client-side background removal pre-processor
  let maskData: Uint8ClampedArray | undefined;
  let bgRemovedPixels = 0;

  if (options.bgRemoval?.enabled) {
    reportProgress?.('bg-removal', 35, 'Removing background & generating mask...');
    const bgResult = removeBackground(
      decoded.data,
      decoded.width,
      decoded.height,
      options.bgRemoval,
      true // generate visual mask overlay
    );
    bgRemovedPixels = bgResult.removedCount;
    maskData = bgResult.maskData;
  }

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
  stats.bgRemovedPixels = bgRemovedPixels;

  // Generate 1:1 or capped preview texture for high-performance 60 FPS viewport
  let previewBlob: Blob | undefined;
  let maskBlob: Blob | undefined;

  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      // 1. Generate primary vector/raster preview blob
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

        // Cap preview texture to max 2048px to prevent GPU memory exhaustion on 30+ Megapixel images
        const maxPrevDim = 2048;
        let exportCanvas: OffscreenCanvas = pCanvas;
        if (decoded.width > maxPrevDim || decoded.height > maxPrevDim) {
          const scale = Math.min(maxPrevDim / decoded.width, maxPrevDim / decoded.height);
          const tw = Math.round(decoded.width * scale);
          const th = Math.round(decoded.height * scale);
          const scaledCanvas = new OffscreenCanvas(tw, th);
          const sCtx = scaledCanvas.getContext('2d');
          if (sCtx) {
            sCtx.imageSmoothingEnabled = true;
            sCtx.imageSmoothingQuality = 'high';
            sCtx.drawImage(pCanvas, 0, 0, tw, th);
            exportCanvas = scaledCanvas;
          }
        }

        try {
          previewBlob = await exportCanvas.convertToBlob({ type: 'image/webp', quality: 0.98 });
        } catch {
          previewBlob = await exportCanvas.convertToBlob({ type: 'image/png' });
        }
      }

      // 2. Generate mask preview blob if background removal was applied
      if (maskData) {
        const mCanvas = new OffscreenCanvas(decoded.width, decoded.height);
        const mCtx = mCanvas.getContext('2d');
        if (mCtx) {
          const mImgData =
            typeof ImageData !== 'undefined'
              ? new ImageData(
                  maskData as unknown as Uint8ClampedArray<ArrayBuffer>,
                  decoded.width,
                  decoded.height
                )
              : ({ data: maskData, width: decoded.width, height: decoded.height } as unknown as ImageData);
          mCtx.putImageData(mImgData, 0, 0);

          let exportMaskCanvas: OffscreenCanvas = mCanvas;
          const maxPrevDim = 2048;
          if (decoded.width > maxPrevDim || decoded.height > maxPrevDim) {
            const scale = Math.min(maxPrevDim / decoded.width, maxPrevDim / decoded.height);
            const tw = Math.round(decoded.width * scale);
            const th = Math.round(decoded.height * scale);
            const scaledMask = new OffscreenCanvas(tw, th);
            const smCtx = scaledMask.getContext('2d');
            if (smCtx) {
              smCtx.imageSmoothingEnabled = false;
              smCtx.drawImage(mCanvas, 0, 0, tw, th);
              exportMaskCanvas = scaledMask;
            }
          }

          try {
            maskBlob = await exportMaskCanvas.convertToBlob({ type: 'image/png' });
          } catch {
            maskBlob = await exportMaskCanvas.convertToBlob({ type: 'image/webp' });
          }
        }
      }
    } catch (e) {
      console.warn('Could not generate OffscreenCanvas preview or mask blob:', e);
    }
  }

  return { svgText, stats, previewBlob, maskBlob };
}
