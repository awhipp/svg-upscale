import { decode as decodePng } from 'fast-png';
import { DecodedImage, ResamplingMode } from './types';

export const MAX_DIMENSION = 8192;
export const MAX_PIXELS = 25_000_000; // 25 Megapixels
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 Megabytes

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Checks if the buffer starts with PNG magic header bytes.
 */
export function isPng(buffer: ArrayBuffer | Uint8Array): boolean {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_MAGIC[i]) return false;
  }
  return true;
}

/**
 * Normalizes raw channel data from fast-png to standard 8-bit RGBA Uint8ClampedArray.
 */
function normalizePngChannels(
  data: Uint8Array | Uint16Array | Uint8ClampedArray,
  width: number,
  height: number,
  channels: number,
  depth: number
): Uint8ClampedArray {
  const totalPixels = width * height;
  const out = new Uint8ClampedArray(totalPixels * 4);

  // If 16-bit depth, normalize to 8-bit
  const is16Bit = depth === 16;
  const getByte = (idx: number): number => {
    const val = data[idx];
    return is16Bit ? val >> 8 : val;
  };

  if (channels === 4) {
    if (!is16Bit && data instanceof Uint8Array) {
      out.set(data);
    } else {
      for (let i = 0; i < totalPixels * 4; i++) {
        out[i] = getByte(i);
      }
    }
  } else if (channels === 3) {
    // RGB -> RGBA (A = 255)
    for (let p = 0; p < totalPixels; p++) {
      const srcIdx = p * 3;
      const dstIdx = p * 4;
      out[dstIdx] = getByte(srcIdx);
      out[dstIdx + 1] = getByte(srcIdx + 1);
      out[dstIdx + 2] = getByte(srcIdx + 2);
      out[dstIdx + 3] = 255;
    }
  } else if (channels === 1) {
    // Grayscale -> RGBA
    for (let p = 0; p < totalPixels; p++) {
      const gray = getByte(p);
      const dstIdx = p * 4;
      out[dstIdx] = gray;
      out[dstIdx + 1] = gray;
      out[dstIdx + 2] = gray;
      out[dstIdx + 3] = 255;
    }
  } else if (channels === 2) {
    // Grayscale + Alpha -> RGBA
    for (let p = 0; p < totalPixels; p++) {
      const srcIdx = p * 2;
      const gray = getByte(srcIdx);
      const alpha = getByte(srcIdx + 1);
      const dstIdx = p * 4;
      out[dstIdx] = gray;
      out[dstIdx + 1] = gray;
      out[dstIdx + 2] = gray;
      out[dstIdx + 3] = alpha;
    }
  } else {
    throw new Error(`Unsupported PNG channel count: ${channels}`);
  }

  return out;
}

/**
 * Decodes PNG binary datastream directly in pure JavaScript with zero GPU/canvas intervention,
 * preserving exact discrete 8-bit RGBA channels (Delta E = 0).
 */
export function decodePngBuffer(buffer: ArrayBuffer): DecodedImage {
  const bytes = new Uint8Array(buffer);
  const parsed = decodePng(bytes);

  validateDimensions(parsed.width, parsed.height);

  const data = normalizePngChannels(
    parsed.data,
    parsed.width,
    parsed.height,
    parsed.channels,
    parsed.depth || 8
  );

  return {
    width: parsed.width,
    height: parsed.height,
    data,
  };
}

/**
 * Validates dimensions against limits defined in TR-3.
 */
export function validateDimensions(width: number, height: number): void {
  if (width <= 0 || height <= 0) {
    throw new Error(`Invalid image dimensions: ${width}x${height}`);
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new Error(
      `Image dimensions (${width}x${height}) exceed maximum allowed dimension of ${MAX_DIMENSION}px.`
    );
  }
  if (width * height > MAX_PIXELS) {
    throw new Error(
      `Image pixel count (${width * height}) exceeds maximum limit of ${MAX_PIXELS} pixels.`
    );
  }
}

/**
 * Decodes raster images (JPEG, WebP, BMP, PNG fallback) in browser environments
 * with unmanaged color space and unmultiplied alpha.
 */
export async function decodeViaBitmap(
  blob: Blob | ArrayBuffer,
  mimeType?: string,
  maxDimension?: number,
  resamplingMode: ResamplingMode = 'smooth'
): Promise<DecodedImage> {
  const imageBlob =
    blob instanceof Blob ? blob : new Blob([blob], { type: mimeType || 'image/png' });

  if (typeof createImageBitmap !== 'function') {
    throw new Error('createImageBitmap is not supported in this runtime environment.');
  }

  // Modern browser API with color space conversion and alpha premultiplication disabled
  const bitmap = await createImageBitmap(imageBlob, {
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none',
  });

  // Validate incoming input image dimensions against input limits (TR-3)
  validateDimensions(bitmap.width, bitmap.height);

  let targetWidth = bitmap.width;
  let targetHeight = bitmap.height;

  if (maxDimension && maxDimension > 0) {
    const scale = Math.min(maxDimension / targetWidth, maxDimension / targetHeight);
    targetWidth = Math.max(1, Math.min(MAX_DIMENSION, Math.round(targetWidth * scale)));
    targetHeight = Math.max(1, Math.min(MAX_DIMENSION, Math.round(targetHeight * scale)));
  }

  const isSmooth = resamplingMode !== 'pixelated';
  const canvas = new OffscreenCanvas(targetWidth, targetHeight);
  const ctx = canvas.getContext('2d', {
    willReadFrequently: true,
    colorSpace: 'srgb',
  }) as OffscreenCanvasRenderingContext2D | null;

  if (!ctx) throw new Error('Failed to acquire OffscreenCanvas 2D context.');
  ctx.imageSmoothingEnabled = isSmooth;
  if (isSmooth) ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  const data = ctx.getImageData(0, 0, targetWidth, targetHeight).data;

  bitmap.close();

  return { width: targetWidth, height: targetHeight, data };
}

/**
 * Universal image decoder: uses pure JS PNG decoder for PNGs, and unmanaged bitmap pipeline for secondary formats.
 * When maxDimension is specified, downscales gracefully according to the chosen resampling mode.
 */
export async function decodeImage(
  buffer: ArrayBuffer,
  mimeType?: string,
  maxDimension?: number,
  resamplingMode: ResamplingMode = 'smooth'
): Promise<DecodedImage> {
  if (buffer.byteLength > MAX_FILE_SIZE) {
    throw new Error(
      `File size (${(buffer.byteLength / (1024 * 1024)).toFixed(2)} MB) exceeds 25 MB limit.`
    );
  }

  if (isPng(buffer) && (!maxDimension || maxDimension === 0)) {
    try {
      return decodePngBuffer(buffer);
    } catch (err) {
      console.warn('fast-png binary decoding encountered an error, falling back to bitmap decoder:', err);
      return decodeViaBitmap(buffer, mimeType, maxDimension, resamplingMode);
    }
  }

  return decodeViaBitmap(buffer, mimeType, maxDimension, resamplingMode);
}
