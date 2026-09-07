import React, { useRef, useState } from 'react';
import { UploadCloud, AlertTriangle } from 'lucide-react';
import { MAX_FILE_SIZE } from '../engine/decoder';

interface DropZoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  activeFlow?: 'vectorize' | 'rasterize';
}

export const DropZone: React.FC<DropZoneProps> = ({
  onFileSelected,
  disabled = false,
  activeFlow = 'vectorize',
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = (file: File) => {
    setErrorMsg(null);

    // Validate mime type
    const validMimes = [
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/bmp',
      'image/x-ms-bmp',
      'image/svg+xml',
    ];
    const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
    const isImage = validMimes.includes(file.type) || isSvg || /\.(png|jpe?g|webp|bmp)$/i.test(file.name);

    if (!isImage) {
      setErrorMsg(`Unsupported file type (${file.type || 'unknown'}). Please drop a PNG, JPEG, WebP, BMP, or SVG.`);
      return;
    }

    // Allow up to 120 MB for dense vector SVGs, 25 MB for raster inputs
    const maxSize = isSvg ? 120 * 1024 * 1024 : MAX_FILE_SIZE;
    if (file.size > maxSize) {
      setErrorMsg(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds ${isSvg ? 120 : 25} MB limit.`);
      return;
    }

    onFileSelected(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSelect(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSelect(e.target.files[0]);
    }
  };

  const isVectorize = activeFlow === 'vectorize';

  return (
    <div className="dropzone-container">
      <div
        className={`dropzone-box ${isDragOver ? 'drag-over' : ''} ${disabled ? 'disabled' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept={
            isVectorize
              ? '.png,.jpg,.jpeg,.webp,.bmp,image/png,image/jpeg,image/webp,image/bmp'
              : '.svg,image/svg+xml'
          }
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />

        <div className="dropzone-icon-wrapper">
          <UploadCloud className="dropzone-icon" size={48} />
        </div>

        <h3 className="dropzone-title">
          {isVectorize
            ? 'Drop your raster image here, or browse'
            : 'Drop your SVG file here, or browse'}
        </h3>
        <p className="dropzone-subtitle">
          {isVectorize
            ? 'Convert PNG, JPEG, WebP, or BMP into crisp, scalable vector SVG paths'
            : 'Rasterize SVG to high-resolution PNG with certified DPI metadata for print & preflight'}
        </p>

        <div className="format-badges">
          {isVectorize ? (
            <>
              <span className="badge png">PNG (Lossless 1:1)</span>
              <span className="badge">WebP</span>
              <span className="badge">JPEG</span>
              <span className="badge">BMP</span>
              <span className="badge hint">Drop SVG to auto-switch to DPI mode</span>
            </>
          ) : (
            <>
              <span className="badge svg">SVG Vector Graphics</span>
              <span className="badge hint">Exports at 100, 150, 300+ DPI</span>
              <span className="badge hint">Drop image to auto-switch to Vectorizer</span>
            </>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="error-alert">
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
