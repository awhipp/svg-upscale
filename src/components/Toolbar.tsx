import React, { useState } from 'react';
import { Download, Copy, Check, RotateCcw, Printer } from 'lucide-react';
import { ConversionResult } from '../engine/types';
import { downloadBlob } from '../utils/download';

interface ToolbarProps {
  result: ConversionResult;
  filename: string;
  onReset: () => void;
  onToggleRaster?: () => void;
  isRasterOpen?: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  result,
  filename,
  onReset,
  onToggleRaster,
  isRasterOpen = false,
}) => {
  const [copied, setCopied] = useState(false);

  const handleDownloadSvg = async () => {
    const baseName = filename.replace(/\.[^/.]+$/, '').trim() || 'image';
    await downloadBlob(result.svgBlob, `${baseName}-vector.svg`, {
      mimeType: 'image/svg+xml;charset=utf-8',
      description: 'Lossless Vector SVG Image (*.svg)',
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.svgText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <div className="toolbar-container">
      <div className="toolbar-left">
        <button
          type="button"
          className="btn-primary"
          onClick={handleDownloadSvg}
          title="Export standalone SVG configured for Illustrator, Figma, Inkscape"
        >
          <Download size={18} />
          <span>Download Lossless SVG</span>
        </button>

        {onToggleRaster && (
          <button
            type="button"
            className={`btn-accent ${isRasterOpen ? 'active' : ''}`}
            onClick={onToggleRaster}
            title="Rasterize SVG to PNG with custom DPI minimum (e.g. 100 DPI) and physical resolution metadata"
          >
            <Printer size={18} />
            <span>{isRasterOpen ? 'Hide DPI Rasterizer' : 'Export PNG with DPI'}</span>
            <span className="badge-chip">100+ DPI</span>
          </button>
        )}

        <button
          type="button"
          className="btn-secondary"
          onClick={handleCopy}
          title="Copy SVG XML markup directly to clipboard"
        >
          {copied ? <Check size={18} className="text-emerald" /> : <Copy size={18} />}
          <span>{copied ? 'Copied Markup!' : 'Copy SVG Markup'}</span>
        </button>
      </div>

      <div className="toolbar-right">
        <button
          type="button"
          className="btn-ghost"
          onClick={onReset}
          title="Clear current image and upload a new one"
        >
          <RotateCcw size={16} />
          <span>Convert Another</span>
        </button>
      </div>
    </div>
  );
};
