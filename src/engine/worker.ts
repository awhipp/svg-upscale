import { executeConversionPipeline } from './pipeline';
import { WorkerInputMessage, WorkerOutputMessage } from './types';

// Web Worker context
const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<WorkerInputMessage>) => {
  const { fileBuffer, mimeType, rasterBytes, options = {} } = e.data;

  try {
    const result = await executeConversionPipeline(
      fileBuffer,
      mimeType,
      rasterBytes,
      options,
      (step, progress, message) => {
        ctx.postMessage({ type: 'PROGRESS', step, progress, message } as WorkerOutputMessage);
      }
    );

    ctx.postMessage({
      type: 'SUCCESS',
      svgText: result.svgText,
      stats: result.stats,
      previewBlob: result.previewBlob,
    } as WorkerOutputMessage);
  } catch (err: unknown) {
    ctx.postMessage({
      type: 'ERROR',
      error: err instanceof Error ? err.message : String(err),
    } as WorkerOutputMessage);
  }
};
