import React from 'react';
import { X, ShieldCheck, Zap, Printer, Palette, Cpu, Sparkles } from 'lucide-react';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <Sparkles size={20} className="text-sky" />
            </div>
            <div>
              <h2 className="modal-title">Engine Architecture &amp; Accuracy</h2>
              <p className="modal-subtitle">
                How this studio achieves 100% color parity and print-ready vector output in your browser
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="architecture-grid">
            {/* Pillar 1: Color Parity */}
            <div className="arch-item">
              <div className="arch-icon-wrap">
                <Palette size={20} className="text-sky" />
              </div>
              <div className="arch-content">
                <h3 className="arch-heading">Exact Color Accuracy (Zero Drift)</h3>
                <p className="arch-text">
                  Standard HTML5 canvas drawing applies host GPU gamut mapping (such as sRGB to Display P3)
                  and alpha premultiplication, subtly altering pixel hex codes. This engine bypasses canvas
                  by parsing binary PNG datastreams directly in JavaScript. Every pixel retains its exact
                  original 8-bit RGBA color channels with zero drift (&Delta;E = 0).
                </p>
              </div>
            </div>

            {/* Pillar 2: 2D Greedy Meshing */}
            <div className="arch-item">
              <div className="arch-icon-wrap">
                <Zap size={20} className="text-indigo" />
              </div>
              <div className="arch-content">
                <h3 className="arch-heading">2D Rectangle Meshing &amp; Path Grouping</h3>
                <p className="arch-text">
                  Instead of generating a separate DOM node for every single pixel, our algorithm performs
                  horizontal run-length encoding combined with 2D vertical consolidation. Pixels of the
                  same color merge into multi-height rectangles and group into unified SVG <code>&lt;path&gt;</code>{' '}
                  definitions, reducing XML markup size by 50% to 90%.
                </p>
              </div>
            </div>

            {/* Pillar 3: High-DPI pHYs Chunk */}
            <div className="arch-item">
              <div className="arch-icon-wrap">
                <Printer size={20} className="text-emerald" />
              </div>
              <div className="arch-content">
                <h3 className="arch-heading">Physical DPI Resolution Chunk (pHYs)</h3>
                <p className="arch-text">
                  Exported PNGs are injected with an official binary <code>pHYs</code> header (ISO/IEC 15948)
                  specifying physical pixels-per-metre. Print preflight tools, Adobe Photoshop, Illustrator,
                  and Windows file properties immediately recognize the document at 100, 150, 300, or 600 DPI
                  without any resampling or blurry interpolation.
                </p>
              </div>
            </div>

            {/* Pillar 4: Pure Client-Side Privacy */}
            <div className="arch-item">
              <div className="arch-icon-wrap">
                <Cpu size={20} className="text-amber" />
              </div>
              <div className="arch-content">
                <h3 className="arch-heading">100% In-Browser Privacy</h3>
                <p className="arch-text">
                  All vector transformations and rasterizations execute directly on your device inside dedicated
                  Web Workers using transferable <code>ArrayBuffer</code> memory. No images, vectors, or data
                  are ever uploaded to any external server. Works completely offline.
                </p>
              </div>
            </div>
          </div>

          <div className="modal-specs-summary">
            <div className="spec-badge">
              <ShieldCheck size={16} className="text-emerald" />
              <span>Full Client-Side Isolation</span>
            </div>
            <div className="spec-badge">
              <span>Bit-for-Bit Color Parity</span>
            </div>
            <div className="spec-badge">
              <span>Standard ISO/IEC 15948 PNG Output</span>
            </div>
            <div className="spec-badge">
              <span>Compatible with Figma, Illustrator &amp; Inkscape</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <a
            href="./SPEC.md"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost-sm"
          >
            View Full Technical Specification (SPEC.md)
          </a>
          <button type="button" className="btn-primary-sm" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
