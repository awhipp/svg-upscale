import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadBlob } from '../src/utils/download';

describe('Download Utility (downloadBlob)', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  });

  it('falls back to resilient anchor tag when showSaveFilePicker is not present', async () => {
    const mockBlob = new Blob(['test content'], { type: 'image/png' });
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/test-uuid');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    let appendedAnchor: unknown = null;
    let clicked = false;

    const mockAnchor = {
      style: {},
      setAttribute: vi.fn(),
      getAttribute: (attr: string) => {
        if (attr === 'download') return 'logo-vector-100dpi.png';
        if (attr === 'href') return 'blob:http://localhost/test-uuid';
        return null;
      },
      click: vi.fn(() => {
        clicked = true;
      }),
      dispatchEvent: vi.fn(() => {
        clicked = true;
        return true;
      }),
    };

    const mockDoc = {
      createElement: vi.fn((tag: string) => {
        if (tag === 'a') return mockAnchor;
        return {};
      }),
      body: {
        appendChild: vi.fn((node: unknown) => {
          appendedAnchor = node;
          return node;
        }),
        removeChild: vi.fn((node: unknown) => node),
      },
    };

    const mockWin = {
      // showSaveFilePicker is intentionally undefined to trigger fallback
    };

    globalThis.window = mockWin as unknown as Window & typeof globalThis;
    globalThis.document = mockDoc as unknown as Document;

    await downloadBlob(mockBlob, 'logo-vector-100dpi.png', {
      mimeType: 'image/png',
      description: 'PNG Image',
    });

    expect(createObjectUrlSpy).toHaveBeenCalledWith(mockBlob);
    expect(mockDoc.createElement).toHaveBeenCalledWith('a');
    expect(mockDoc.body.appendChild).toHaveBeenCalled();
    expect(mockDoc.body.removeChild).toHaveBeenCalled();
    expect(appendedAnchor).toBe(mockAnchor);
    expect(mockAnchor.setAttribute).toHaveBeenCalledWith('download', 'logo-vector-100dpi.png');
    expect(mockAnchor.setAttribute).toHaveBeenCalledWith('href', 'blob:http://localhost/test-uuid');
    expect(clicked).toBe(true);

    // Verify that revokeObjectURL is NOT called immediately (resilient 60s lifecycle)
    expect(revokeObjectUrlSpy).not.toHaveBeenCalled();

    // Fast-forward 60 seconds
    vi.advanceTimersByTime(60_000);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:http://localhost/test-uuid');
  });

  it('uses window.showSaveFilePicker when available', async () => {
    const mockBlob = new Blob(['png-binary-data'], { type: 'image/png' });
    const writeMock = vi.fn().mockResolvedValue(undefined);
    const closeMock = vi.fn().mockResolvedValue(undefined);

    const mockFileHandle = {
      createWritable: vi.fn().mockResolvedValue({
        write: writeMock,
        close: closeMock,
      }),
    };

    const showSaveFilePickerMock = vi.fn().mockResolvedValue(mockFileHandle);
    globalThis.window = {
      showSaveFilePicker: showSaveFilePickerMock,
    } as unknown as Window & typeof globalThis;

    await downloadBlob(mockBlob, 'export-100dpi.png', {
      mimeType: 'image/png',
      description: 'PNG Image (*.png)',
    });

    expect(showSaveFilePickerMock).toHaveBeenCalledWith({
      suggestedName: 'export-100dpi.png',
      types: [
        {
          description: 'PNG Image (*.png)',
          accept: {
            'image/png': ['.png'],
          },
        },
      ],
    });

    expect(writeMock).toHaveBeenCalledWith(mockBlob);
    expect(closeMock).toHaveBeenCalled();
  });

  it('handles user cancellation of showSaveFilePicker gracefully', async () => {
    const mockBlob = new Blob(['test'], { type: 'image/png' });
    const abortError = new DOMException('The user aborted a request.', 'AbortError');

    const showSaveFilePickerMock = vi.fn().mockRejectedValue(abortError);
    globalThis.window = {
      showSaveFilePicker: showSaveFilePickerMock,
    } as unknown as Window & typeof globalThis;

    // Should not throw or crash when user cancels
    await expect(downloadBlob(mockBlob, 'test.png')).resolves.toBeUndefined();
  });
});
