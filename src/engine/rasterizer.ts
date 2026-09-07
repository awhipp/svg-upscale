import { setPngDpi } from './png-dpi';

export interface SvgDimensions {
  width: number;
  height: number;
  viewBox?: { x: number; y: number; width: number; height: number };
}

export type DimensionMode = 'native' | 'dpi-scaled' | 'custom';

export interface CalculatedDimensions {
  pixelWidth: number;
  pixelHeight: number;
  printWidthInches: number;
  printHeightInches: number;
  printWidthCm: number;
  printHeightCm: number;
  dpi: number;
  scale: number;
}

/**
 * Converts CSS length units to pixels (based on 96 px = 1 inch CSS standard).
 */
export function parseLengthToPixels(val: string): number | null {
  if (!val) return null;
  const trimmed = val.trim();
  const match = trimmed.match(/^([+-]?\d+(?:\.\d+)?)\s*(px|in|cm|mm|pt|pc)?$/i);
  if (!match) return null;

  const num = parseFloat(match[1]);
  const unit = (match[2] || 'px').toLowerCase();

  switch (unit) {
    case 'in':
      return num * 96;
    case 'cm':
      return (num * 96) / 2.54;
    case 'mm':
      return (num * 96) / 25.4;
    case 'pt':
      return (num * 96) / 72;
    case 'pc':
      return num * 16;
    case 'px':
    default:
      return num;
  }
}

/**
 * Parses native SVG dimensions and viewBox from raw SVG text.
 * Optimized for multi-megabyte SVGs by inspecting only the root element header.
 */
export function parseSvgDimensions(svgText: string): SvgDimensions {
  // Opening <svg ...> is always in the first 32 KB; slice to avoid scanning multi-megabyte strings
  const searchChunk = svgText.length > 32768 ? svgText.slice(0, 32768) : svgText;
  const svgTagMatch = searchChunk.match(/<svg\b([^>]*)>/i);
  if (!svgTagMatch) {
    throw new Error('Invalid SVG: No <svg> root element found.');
  }

  const attrs = svgTagMatch[1];

  // Parse viewBox
  let viewBox: { x: number; y: number; width: number; height: number } | undefined;
  const viewBoxMatch = attrs.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(parseFloat);
    if (parts.length === 4 && !parts.some(isNaN) && parts[2] > 0 && parts[3] > 0) {
      viewBox = {
        x: parts[0],
        y: parts[1],
        width: parts[2],
        height: parts[3],
      };
    }
  }

  // Parse width and height attributes
  const widthMatch = attrs.match(/\bwidth\s*=\s*["']([^"']+)["']/i);
  const heightMatch = attrs.match(/\bheight\s*=\s*["']([^"']+)["']/i);

  const parsedW = widthMatch ? parseLengthToPixels(widthMatch[1]) : null;
  const parsedH = heightMatch ? parseLengthToPixels(heightMatch[1]) : null;

  let width = parsedW && parsedW > 0 ? Math.round(parsedW) : 0;
  let height = parsedH && parsedH > 0 ? Math.round(parsedH) : 0;

  // Fallbacks if one or both dimensions are missing or 0
  if ((!width || !height) && viewBox) {
    if (!width && !height) {
      width = Math.round(viewBox.width);
      height = Math.round(viewBox.height);
    } else if (!width && height) {
      width = Math.round((height * viewBox.width) / viewBox.height);
    } else if (width && !height) {
      height = Math.round((width * viewBox.height) / viewBox.width);
    }
  }

  // Default fallback if still unknown
  if (!width || !height) {
    width = width || 800;
    height = height || 600;
  }

  return { width, height, viewBox };
}

/**
 * Calculates pixel and physical print dimensions for a given DPI and dimension mode.
 */
export function calculateDimensions(
  baseWidth: number,
  baseHeight: number,
  dpi: number,
  mode: DimensionMode,
  customOptions?: { scale?: number; maxDimension?: number; width?: number; height?: number }
): CalculatedDimensions {
  let scale = 1;

  if (mode === 'native') {
    // 1:1 exact native pixel grid
    scale = 1;
  } else if (mode === 'dpi-scaled') {
    // Scale proportionally relative to CSS 96 DPI base
    scale = dpi / 96;
  } else if (mode === 'custom') {
    if (customOptions?.scale && customOptions.scale > 0) {
      scale = customOptions.scale;
    } else if (customOptions?.maxDimension && customOptions.maxDimension > 0) {
      const maxBase = Math.max(baseWidth, baseHeight);
      scale = customOptions.maxDimension / maxBase;
    } else if (customOptions?.width && customOptions.width > 0) {
      scale = customOptions.width / baseWidth;
    } else if (customOptions?.height && customOptions.height > 0) {
      scale = customOptions.height / baseHeight;
    }
  }

  const pixelWidth = Math.max(1, Math.round(baseWidth * scale));
  const pixelHeight = Math.max(1, Math.round(baseHeight * scale));

  // Physical dimensions at the specified DPI
  const printWidthInches = Number((pixelWidth / dpi).toFixed(2));
  const printHeightInches = Number((pixelHeight / dpi).toFixed(2));
  const printWidthCm = Number(((pixelWidth / dpi) * 2.54).toFixed(2));
  const printHeightCm = Number(((pixelHeight / dpi) * 2.54).toFixed(2));

  return {
    pixelWidth,
    pixelHeight,
    printWidthInches,
    printHeightInches,
    printWidthCm,
    printHeightCm,
    dpi,
    scale,
  };
}

/**
 * Injects target dimensions and ensures viewBox exists in SVG markup for accurate scaling.
 * Optimized for multi-megabyte SVGs by only modifying the root tag and slicing rather than full-text regex.
 */
export function prepareSvgForRasterization(
  svgText: string,
  targetWidth: number,
  targetHeight: number
): string {
  const { viewBox, width: baseW, height: baseH } = parseSvgDimensions(svgText);
  const vbW = viewBox ? viewBox.width : baseW;
  const vbH = viewBox ? viewBox.height : baseH;
  const vbX = viewBox ? viewBox.x : 0;
  const vbY = viewBox ? viewBox.y : 0;

  // Find the closing '>' of the root <svg ...> tag
  const svgCloseIndex = svgText.indexOf('>');
  if (svgCloseIndex === -1) return svgText;

  const header = svgText.slice(0, svgCloseIndex + 1);
  const body = svgText.slice(svgCloseIndex + 1);

  const updatedHeader = header.replace(/<svg\b([^>]*)>/i, (_match, attrs) => {
    const cleanAttrs = attrs
      .replace(/\bwidth\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\bheight\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\bviewBox\s*=\s*["'][^"']*["']/gi, '')
      .trim();

    return `<svg width="${targetWidth}" height="${targetHeight}" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" ${cleanAttrs}>`;
  });

  return updatedHeader + body;
}

export interface RasterizeOptions {
  dpi: number;
  targetWidth: number;
  targetHeight: number;
  backgroundColor?: string;
}

/**
 * Rasterizes SVG markup to a standalone PNG Blob with injected DPI (pHYs) chunk.
 * Compatible with modern browser DOM environments (Canvas / OffscreenCanvas).
 */
export async function rasterizeSvgToPng(
  svgText: string,
  options: RasterizeOptions
): Promise<{ blob: Blob; width: number; height: number; dpi: number }> {
  const { dpi, targetWidth, targetHeight, backgroundColor } = options;

  if (targetWidth <= 0 || targetHeight <= 0) {
    throw new Error(`Invalid dimensions: ${targetWidth}x${targetHeight}`);
  }

  const preparedSvg = prepareSvgForRasterization(svgText, targetWidth, targetHeight);
  const svgBlob = new Blob([preparedSvg], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to render SVG image into browser graphics surface.'));
      img.src = blobUrl;
    });

    let rawPngBlob: Blob;

    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(targetWidth, targetHeight);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to acquire 2D canvas context.');

      if (backgroundColor) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      rawPngBlob = await canvas.convertToBlob({ type: 'image/png' });
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to acquire 2D canvas context.');

      if (backgroundColor) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      rawPngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas toBlob returned null.'))), 'image/png');
      });
    }

    // Inject pHYs physical DPI metadata into the PNG byte buffer
    const arrayBuffer = await rawPngBlob.arrayBuffer();
    const taggedBuffer = setPngDpi(new Uint8Array(arrayBuffer), dpi);
    const finalBlob = new Blob([taggedBuffer as unknown as BlobPart], { type: 'image/png' });

    return {
      blob: finalBlob,
      width: targetWidth,
      height: targetHeight,
      dpi,
    };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
