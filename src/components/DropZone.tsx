import React, { useRef, useState } from 'react';
import { UploadCloud, AlertTriangle } from 'lucide-react';
import { MAX_FILE_SIZE } from '../engine/decoder';

interface DropZoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onFileSelected,
  disabled = false,
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
          accept=".png,.jpg,.jpeg,.webp,.bmp,.svg,image/png,image/jpeg,image/webp,image/bmp,image/svg+xml"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />

        <div className="dropzone-icon-wrapper">
          <UploadCloud className="dropzone-icon" size={48} />
        </div>

        <h3 className="dropzone-title">Drop your raster image or SVG here, or browse</h3>
        <p className="dropzone-subtitle">
          Vectorize rasters to lossless <strong>SVG</strong> (ΔE = 0), or drop an <strong>SVG</strong> to rasterize with custom <strong>DPI (100+ DPI)</strong>
        </p>

        <div className="format-badges">
          <span className="badge svg">SVG (DPI Rasterizer)</span>
          <span className="badge png">PNG (Lossless 1:1)</span>
          <span className="badge">WebP</span>
          <span className="badge">JPEG</span>
          <span className="badge">BMP</span>
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
