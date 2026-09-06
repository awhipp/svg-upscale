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
    ];
    const isImage = validMimes.includes(file.type) || /\.(png|jpe?g|webp|bmp)$/i.test(file.name);

    if (!isImage) {
      setErrorMsg(`Unsupported file type (${file.type || 'unknown'}). Please drop a PNG, JPEG, WebP, or BMP.`);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds 25 MB limit.`);
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
          accept=".png,.jpg,.jpeg,.webp,.bmp,image/png,image/jpeg,image/webp,image/bmp"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />

        <div className="dropzone-icon-wrapper">
          <UploadCloud className="dropzone-icon" size={48} />
        </div>

        <h3 className="dropzone-title">Drop your raster image here, or browse</h3>
        <p className="dropzone-subtitle">
          Supports <strong>PNG</strong> (direct binary 1:1 IDAT), <strong>WebP</strong>,{' '}
          <strong>JPEG</strong>, and <strong>BMP</strong> up to 25 MB &amp; 8192×8192 px
        </p>

        <div className="format-badges">
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
