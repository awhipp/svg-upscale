import { executeConversionPipeline } from './pipeline';
import {
  ConversionOptions,
  ConversionProgress,
  ConversionResult,
  ProgressCallback,
  WorkerInputMessage,
  WorkerOutputMessage,
} from './types';

/**
 * Orchestrates raster to SVG vector conversion.
 * Executes in a background Web Worker when available to maintain 60 FPS UI responsiveness,
 * with automatic synchronous fallback to main thread.
 */
export async function convertRasterToSvg(
  input: { buffer: ArrayBuffer; mimeType: string },
  onProgress?: ProgressCallback,
  options?: ConversionOptions
): Promise<ConversionResult> {
  const rasterBytes = input.buffer.byteLength;
  const isJpegOrWebp = input.mimeType === 'image/jpeg' || input.mimeType === 'image/webp';
  const resolvedOptions: ConversionOptions = {
    maxDimension: options?.maxDimension !== undefined ? options.maxDimension : (isJpegOrWebp ? 1280 : 0),
    resamplingMode: options?.resamplingMode ?? 'smooth',
    merge2D: options?.merge2D ?? true,
    pathGrouping: options?.pathGrouping ?? true,
    bgRemoval: options?.bgRemoval,
  };

  // Attempt Web Worker execution if supported
  if (typeof Worker !== 'undefined') {
    try {
      return await runInWorker(
        input.buffer,
        input.mimeType,
        rasterBytes,
        resolvedOptions,
        onProgress
      );
    } catch (workerErr) {
      console.warn('Worker execution failed, falling back to main thread:', workerErr);
    }
  }

  // Fallback execution on main thread
  const report = (step: ConversionProgress['step'], progress: number, message: string) => {
    onProgress?.({ step, progress, message });
  };

  const { svgText, stats, previewBlob, maskBlob } = await executeConversionPipeline(
    input.buffer,
    input.mimeType,
    rasterBytes,
    resolvedOptions,
    report
  );

  const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  report('done', 100, 'Conversion completed.');
  return { svgText, svgBlob, stats, previewBlob, maskBlob };
}

function runInWorker(
  buffer: ArrayBuffer,
  mimeType: string,
  rasterBytes: number,
  options: ConversionOptions,
  onProgress?: ProgressCallback
): Promise<ConversionResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    });

    const transferBuffer = buffer.slice(0);

    worker.onmessage = (e: MessageEvent<WorkerOutputMessage>) => {
      const msg = e.data;
      if (msg.type === 'PROGRESS') {
        onProgress?.({
          step: msg.step,
          progress: msg.progress,
          message: msg.message,
        });
      } else if (msg.type === 'SUCCESS') {
        worker.terminate();
        const svgBlob = new Blob([msg.svgText], { type: 'image/svg+xml;charset=utf-8' });
        resolve({
          svgText: msg.svgText,
          svgBlob,
          stats: msg.stats,
          previewBlob: msg.previewBlob,
          maskBlob: msg.maskBlob,
        });
      } else if (msg.type === 'ERROR') {
        worker.terminate();
        reject(new Error(msg.error));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(err.message || 'Unknown Web Worker error.'));
    };

    const inputMsg: WorkerInputMessage = {
      type: 'CONVERT',
      fileBuffer: transferBuffer,
      mimeType,
      rasterBytes,
      options,
    };

    worker.postMessage(inputMsg, [transferBuffer]);
  });
}

export * from './types';
export * from './decoder';
export * from './rle';
export * from './svg';
export * from './pipeline';
export * from './png-dpi';
export * from './rasterizer';
export * from './bg-removal';

