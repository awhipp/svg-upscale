/**
 * Robust client-side file downloader for browser environments.
 * Handles large binary blobs (e.g. multi-megabyte high-DPI raster images)
 * without premature object URL revocation or filename truncation.
 */

// Retain active blob URLs in memory to prevent garbage collection or Chrome download cancellation
const activeBlobUrls = new Set<string>();

export interface DownloadBlobOptions {
  mimeType?: string;
  description?: string;
}

/**
 * Downloads a Blob with a guaranteed filename and extension.
 * Prefers File System Access API (`showSaveFilePicker`) when available,
 * and falls back to an anchor tag with resilient lifetime management.
 */
export async function downloadBlob(
  blob: Blob,
  filename: string,
  options?: DownloadBlobOptions
): Promise<void> {
  const mimeType = options?.mimeType || blob.type || 'application/octet-stream';

  // 1. Attempt modern File System Access API (Chromium 86+, Edge)
  // This gives the user native OS save control and bypasses all blob URL restrictions
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const ext = filename.includes('.') ? '.' + filename.split('.').pop()! : '.png';
      const handle = await (window as unknown as {
        showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle>;
      }).showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: options?.description || 'PNG Image (*.png)',
            accept: {
              [mimeType]: [ext],
            },
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err: unknown) {
      // AbortError is thrown when user cancels the save picker
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      // If permission denied or unexpected error, fall through to anchor tag
      console.warn('Native showSaveFilePicker failed or was not allowed; falling back to anchor download:', err);
    }
  }

  // 2. Resilient Anchor Tag Download Fallback
  const blobUrl = URL.createObjectURL(blob);
  activeBlobUrls.add(blobUrl);

  const anchor = document.createElement('a');
  anchor.style.display = 'none';
  anchor.setAttribute('href', blobUrl);
  anchor.setAttribute('download', filename);
  anchor.setAttribute('rel', 'noopener');
  anchor.setAttribute('target', '_blank');

  document.body.appendChild(anchor);

  try {
    if (typeof MouseEvent !== 'undefined') {
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      });
      anchor.dispatchEvent(clickEvent);
    } else {
      anchor.click();
    }
  } finally {
    document.body.removeChild(anchor);
  }

  // Keep the blob URL alive for at least 60 seconds so large transfers have ample time to flush to disk
  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
    activeBlobUrls.delete(blobUrl);
  }, 60_000);
}
