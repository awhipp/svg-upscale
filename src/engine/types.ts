export interface DecodedImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface RLERun {
  x: number;
  y: number;
  width: number;
  height?: number; // Defaults to 1 for 1D horizontal runs
  r: number;
  g: number;
  b: number;
  a: number;
}

export type ResamplingMode = 'smooth' | 'pixelated';

export const QUALITY_TIERS = [
  { id: 'standard', label: 'Standard HD (1280px)', dimension: 1280, category: 'digital', description: 'Recommended default for web & desktop display' },
  { id: 'fullHd', label: 'Full HD (1600px)', dimension: 1600, category: 'digital', description: 'High-res desktop & presentations' },
  { id: 'ultra2k', label: 'Ultra 2K (2048px)', dimension: 2048, category: 'digital', description: 'Retina displays & 4K viewing' },
  { id: 'compact', label: 'Compact Web (800px)', dimension: 800, category: 'digital', description: 'Mobile layouts & fast email graphics' },
  { id: 'letter', label: 'Letter / 8.5"×11" (2550px)', dimension: 2550, category: 'print', description: 'Standard 8.5" × 11" print at 300 DPI' },
  { id: 'tableCover', label: 'Table Cover / Banner (3840px)', dimension: 3840, category: 'print', description: 'Conference table covers & pull-up banners' },
  { id: 'backdrop', label: 'Conference Backdrop (6144px)', dimension: 6144, category: 'print', description: 'Stage backdrops & grand format trade show walls' },
  { id: 'original', label: 'Original Resolution', dimension: 0, category: 'native', description: '1:1 unscaled raw pixel grid (large file size)' },
] as const;

export type QualityTierId = typeof QUALITY_TIERS[number]['id'] | 'custom';

export interface ConversionOptions {
  maxDimension?: number; // Maximum dimension limit (0 = original resolution, e.g. 1280)
  resamplingMode?: ResamplingMode; // 'smooth' (bilinear) or 'pixelated' (nearest neighbor)
  merge2D?: boolean; // Consolidate identical adjacent scanline runs into multi-height rects (default: true)
  pathGrouping?: boolean; // Group same-color shapes into compact <path> elements (default: true)
}

export interface VectorStats {
  width: number;
  height: number;
  originalPixels: number;
  vectorRuns: number;
  transparentSkipped: number;
  compressionRatio: number;
  durationMs: number;
  svgBytes: number;
  rasterBytes: number;
  elementCount?: number;
  resamplingMode?: ResamplingMode;
}

export interface ConversionResult {
  svgText: string;
  svgBlob: Blob;
  stats: VectorStats;
  previewBlob?: Blob;
  rasterPreviewUrl?: string;
}

export interface ConversionProgress {
  step: 'decoding' | 'compressing' | 'generating' | 'done';
  progress: number; // 0 to 100
  message: string;
}

export type ProgressCallback = (progress: ConversionProgress) => void;

export interface WorkerInputMessage {
  type: 'CONVERT';
  fileBuffer: ArrayBuffer;
  mimeType: string;
  rasterBytes: number;
  options?: ConversionOptions;
}

export type WorkerOutputMessage =
  | {
      type: 'PROGRESS';
      step: ConversionProgress['step'];
      progress: number;
      message: string;
    }
  | {
      type: 'SUCCESS';
      svgText: string;
      stats: VectorStats;
      previewBlob?: Blob;
    }
  | {
      type: 'ERROR';
      error: string;
    };
