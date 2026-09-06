import React, { useState } from 'react';
import { Download, Copy, Check, RotateCcw } from 'lucide-react';
import { ConversionResult } from '../engine/types';

interface ToolbarProps {
  result: ConversionResult;
  filename: string;
  onReset: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ result, filename, onReset }) => {
  const [copied, setCopied] = useState(false);

  const handleDownload = () => {
    const url = URL.createObjectURL(result.svgBlob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = filename.replace(/\.[^/.]+$/, '').trim();
    a.download = `${baseName || 'image'}-vector.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
          onClick={handleDownload}
          title="Export standalone SVG configured for Illustrator, Figma, Inkscape"
        >
          <Download size={18} />
          <span>Download Lossless SVG</span>
        </button>

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
          <span>Convert Another Image</span>
        </button>
      </div>
    </div>
  );
};
