/**
 * PNG Physical Resolution (pHYs) metadata injector and parser.
 *
 * Implements PNG specification ISO/IEC 15948:2004 for the pHYs chunk:
 * - 4 bytes: Pixels per unit, X axis (UInt32BE)
 * - 4 bytes: Pixels per unit, Y axis (UInt32BE)
 * - 1 byte:  Unit specifier (1 = metre, 0 = unknown)
 *
 * 1 inch = 0.0254 metres.
 * pixels_per_metre = Math.round(dpi / 0.0254)
 */

export const DPI_PRESETS = [
  { dpi: 72, label: '72 DPI', description: 'Legacy web / standard display' },
  { dpi: 96, label: '96 DPI', description: 'Standard Windows / CSS desktop baseline' },
  { dpi: 100, label: '100 DPI', description: 'Vendor / Client requirement minimum' },
  { dpi: 150, label: '150 DPI', description: 'Medium print & newsprint' },
  { dpi: 300, label: '300 DPI', description: 'High-res commercial print standard' },
  { dpi: 600, label: '600 DPI', description: 'Ultra fine art & vector line printing' },
] as const;

// Precomputed CRC32 lookup table (polynomial 0xEDB88320)
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

/**
 * Calculates standard IEEE 802.3 / ISO 3309 CRC32 checksum for a slice of bytes.
 */
export function calculateCrc32(buffer: Uint8Array, offset: number, length: number): number {
  let crc = 0xffffffff;
  const end = offset + length;
  for (let i = offset; i < end; i++) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Validates that a buffer has a valid 8-byte PNG file signature.
 */
export function isPngSignature(buffer: Uint8Array): boolean {
  if (buffer.length < 8) return false;
  return (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

/**
 * Converts DPI (dots per inch) to pixels per metre.
 * 1 inch = 0.0254 metres.
 */
export function dpiToPixelsPerMetre(dpi: number): number {
  return Math.round(dpi / 0.0254);
}

/**
 * Converts pixels per metre to DPI (dots per inch).
 */
export function pixelsPerMetreToDpi(ppm: number): number {
  return Math.round(ppm * 0.0254 * 100) / 100;
}

export interface PngDpiInfo {
  dpiX: number;
  dpiY: number;
  ppmX: number;
  ppmY: number;
  unit: number; // 1 = metre, 0 = unknown
}

/**
 * Reads DPI metadata from any existing pHYs chunk in a PNG buffer.
 * Returns null if no pHYs chunk is present or if buffer is not a valid PNG.
 */
export function getPngDpi(buffer: Uint8Array): PngDpiInfo | null {
  if (!isPngSignature(buffer)) return null;

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let offset = 8; // Skip 8-byte signature

  while (offset + 8 <= buffer.length) {
    const chunkLength = view.getUint32(offset);
    const chunkType = String.fromCharCode(
      buffer[offset + 4],
      buffer[offset + 5],
      buffer[offset + 6],
      buffer[offset + 7]
    );

    const chunkDataOffset = offset + 8;

    if (chunkType === 'pHYs' && chunkLength >= 9 && chunkDataOffset + 9 <= buffer.length) {
      const ppmX = view.getUint32(chunkDataOffset);
      const ppmY = view.getUint32(chunkDataOffset + 4);
      const unit = buffer[chunkDataOffset + 8];

      return {
        dpiX: unit === 1 ? pixelsPerMetreToDpi(ppmX) : ppmX,
        dpiY: unit === 1 ? pixelsPerMetreToDpi(ppmY) : ppmY,
        ppmX,
        ppmY,
        unit,
      };
    }

    if (chunkType === 'IEND') break;
    offset += 12 + chunkLength; // 4 (length) + 4 (type) + chunkLength + 4 (crc)
  }

  return null;
}

/**
 * Builds a valid 21-byte PNG pHYs chunk with correct length, chunk type, data, and CRC32.
 */
export function createPhysChunk(dpi: number): Uint8Array {
  const ppm = dpiToPixelsPerMetre(dpi);
  const chunk = new Uint8Array(21); // 4 length + 4 type + 9 data + 4 crc
  const view = new DataView(chunk.buffer);

  // Length = 9 bytes
  view.setUint32(0, 9);

  // Type = 'pHYs' (0x70 0x48 0x59 0x73)
  chunk[4] = 0x70;
  chunk[5] = 0x48;
  chunk[6] = 0x59;
  chunk[7] = 0x73;

  // Data: Pixels per metre X, Y (UInt32BE)
  view.setUint32(8, ppm);
  view.setUint32(12, ppm);

  // Unit: 1 = metre
  chunk[16] = 1;

  // CRC32 calculated over Type (4 bytes) + Data (9 bytes) = 13 bytes starting at index 4
  const crc = calculateCrc32(chunk, 4, 13);
  view.setUint32(17, crc);

  return chunk;
}

/**
 * Injects or replaces the pHYs physical resolution chunk in a PNG byte buffer.
 * If a pHYs chunk is already present, it is cleanly replaced.
 * Otherwise, the pHYs chunk is inserted immediately after IHDR (before any IDAT chunk).
 *
 * @throws Error if buffer is not a valid PNG.
 */
export function setPngDpi(pngBuffer: Uint8Array, dpi: number): Uint8Array {
  if (!isPngSignature(pngBuffer)) {
    throw new Error('Invalid PNG signature. Cannot inject DPI metadata.');
  }

  if (dpi <= 0 || !isFinite(dpi)) {
    throw new Error(`Invalid DPI value: ${dpi}. DPI must be a positive number.`);
  }

  const physChunk = createPhysChunk(dpi);
  const view = new DataView(pngBuffer.buffer, pngBuffer.byteOffset, pngBuffer.byteLength);

  let offset = 8; // After PNG signature
  let ihdrEndOffset = -1;
  let existingPhysOffset = -1;
  let existingPhysTotalLength = 0;

  // Walk chunks to locate IHDR and any existing pHYs
  while (offset + 8 <= pngBuffer.length) {
    const chunkLength = view.getUint32(offset);
    const chunkType = String.fromCharCode(
      pngBuffer[offset + 4],
      pngBuffer[offset + 5],
      pngBuffer[offset + 6],
      pngBuffer[offset + 7]
    );

    const totalChunkLength = 12 + chunkLength; // 4 (len) + 4 (type) + data + 4 (crc)

    if (chunkType === 'IHDR') {
      ihdrEndOffset = offset + totalChunkLength;
    } else if (chunkType === 'pHYs') {
      existingPhysOffset = offset;
      existingPhysTotalLength = totalChunkLength;
      break; // Found existing pHYs
    } else if (chunkType === 'IDAT' || chunkType === 'IEND') {
      // pHYs must appear before IDAT; stop searching
      break;
    }

    offset += totalChunkLength;
  }

  if (ihdrEndOffset === -1) {
    throw new Error('Corrupt PNG: Missing IHDR chunk.');
  }

  if (existingPhysOffset !== -1) {
    // Replace existing pHYs chunk
    const newSize = pngBuffer.length - existingPhysTotalLength + physChunk.length;
    const output = new Uint8Array(newSize);

    // Copy bytes before existing pHYs
    output.set(pngBuffer.subarray(0, existingPhysOffset), 0);
    // Copy new pHYs chunk
    output.set(physChunk, existingPhysOffset);
    // Copy remaining bytes after existing pHYs
    output.set(
      pngBuffer.subarray(existingPhysOffset + existingPhysTotalLength),
      existingPhysOffset + physChunk.length
    );

    return output;
  }

  // Insert immediately after IHDR chunk
  const newSize = pngBuffer.length + physChunk.length;
  const output = new Uint8Array(newSize);

  output.set(pngBuffer.subarray(0, ihdrEndOffset), 0);
  output.set(physChunk, ihdrEndOffset);
  output.set(pngBuffer.subarray(ihdrEndOffset), ihdrEndOffset + physChunk.length);

  return output;
}
