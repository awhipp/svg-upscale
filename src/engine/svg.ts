import { RLERun, VectorStats } from './types';

// Precomputed 2-digit uppercase hex lookup table for 0..255
const HEX_TABLE: string[] = Array.from({ length: 256 }, (_, i) =>
  i.toString(16).padStart(2, '0').toUpperCase()
);

/**
 * Converts 8-bit RGB channels to a #RRGGBB hexadecimal string.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${HEX_TABLE[r]}${HEX_TABLE[g]}${HEX_TABLE[b]}`;
}

export interface SvgOptions {
  pathGrouping?: boolean; // Group same-color runs into <path> elements (default: false for backward compatibility)
}

/**
 * Generates standalone, valid SVG markup from RLE runs with crispEdges rendering.
 * Supports compact color-grouped <path> syntax and strict lossless color definitions.
 */
export function generateSvg(
  runs: RLERun[],
  width: number,
  height: number,
  transparentSkipped: number,
  rasterBytes: number,
  durationMs: number,
  options?: SvgOptions
): { svgText: string; stats: VectorStats } {
  const chunks: string[] = [];
  const pathGrouping = options?.pathGrouping ?? false;

  chunks.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" shape-rendering="crispEdges">\n`
  );

  let elementCount = 0;

  if (pathGrouping) {
    // Group subpath commands by color key
    const groups = new Map<string, { hex: string; opacity?: number; commands: string[] }>();

    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      const hex = rgbToHex(run.r, run.g, run.b);
      const runH = run.height || 1;
      const isOpaque = run.a === 255;
      const opacity = isOpaque ? undefined : Number((run.a / 255).toFixed(4));
      const key = isOpaque ? hex : `${hex}|${opacity}`;

      let group = groups.get(key);
      if (!group) {
        group = { hex, opacity, commands: [] };
        groups.set(key, group);
      }

      group.commands.push(`M${run.x} ${run.y}h${run.width}v${runH}h-${run.width}z`);
    }

    for (const { hex, opacity, commands } of groups.values()) {
      elementCount++;
      const d = commands.join(' ');
      if (opacity === undefined) {
        chunks.push(`  <path fill="${hex}" d="${d}"/>\n`);
      } else {
        chunks.push(`  <path fill="${hex}" fill-opacity="${opacity}" d="${d}"/>\n`);
      }
    }
  } else {
    // Classic <rect> markup per run
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      const hex = rgbToHex(run.r, run.g, run.b);
      elementCount++;
      const runH = run.height || 1;
      if (run.a === 255) {
        chunks.push(
          `  <rect x="${run.x}" y="${run.y}" width="${run.width}" height="${runH}" fill="${hex}"/>\n`
        );
      } else {
        const opacity = Number((run.a / 255).toFixed(4));
        chunks.push(
          `  <rect x="${run.x}" y="${run.y}" width="${run.width}" height="${runH}" fill="${hex}" fill-opacity="${opacity}"/>\n`
        );
      }
    }
  }

  chunks.push('</svg>\n');

  const svgText = chunks.join('');
  const svgBytes = new TextEncoder().encode(svgText).length;
  const originalPixels = width * height;
  const compressionRatio =
    originalPixels > 0 ? Number(((1 - runs.length / originalPixels) * 100).toFixed(2)) : 0;

  const stats: VectorStats = {
    width,
    height,
    originalPixels,
    vectorRuns: runs.length,
    transparentSkipped,
    compressionRatio,
    durationMs: Math.round(durationMs),
    svgBytes,
    rasterBytes,
    elementCount,
  };

  return { svgText, stats };
}
