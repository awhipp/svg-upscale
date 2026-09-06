import React, { useState } from 'react';
import { Sliders, Sparkles, ChevronDown, ChevronUp, RefreshCw, Monitor, Printer, Maximize2 } from 'lucide-react';
import { ConversionOptions, QUALITY_TIERS } from '../engine/types';

interface OptimizationSettingsProps {
  options: ConversionOptions;
  onChange: (options: ConversionOptions) => void;
  onApply?: () => void;
  isConverting?: boolean;
}

export const OptimizationSettings: React.FC<OptimizationSettingsProps> = ({
  options,
  onChange,
  onApply,
  isConverting = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'digital' | 'print' | 'custom'>('digital');
  const [customDim, setCustomDim] = useState<string>(
    options.maxDimension && options.maxDimension > 0 ? String(options.maxDimension) : '1280'
  );

  const currentDim = options.maxDimension ?? 1280;

  // Find matching tier
  const matchingTier = QUALITY_TIERS.find((t) => t.dimension === currentDim);

  const handleSelectTier = (dimension: number) => {
    onChange({
      ...options,
      maxDimension: dimension,
    });
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customDim, 10);
    if (!isNaN(val) && val > 0) {
      onChange({
        ...options,
        maxDimension: Math.min(8192, Math.max(32, val)),
      });
    }
  };

  return (
    <div className="optimization-panel">
      <div className="optimization-header">
        <div className="optimization-title-group">
          <Sliders size={18} className="text-sky" />
          <span className="optimization-heading">Quality &amp; Resolution Pre-Scaler</span>
          <span className="optimization-sub">
            {matchingTier ? matchingTier.label : currentDim === 0 ? 'Original Resolution' : `Custom ${currentDim}px`}
            {' • '}
            <span className="text-emerald">Strict Lossless (ΔE = 0)</span>
            {' • '}
            {options.resamplingMode === 'pixelated' ? 'Crisp Nearest-Neighbor' : 'Smooth Bilinear'}
          </span>
        </div>

        <div className="optimization-header-actions">
          <div className="tier-quick-chips">
            <button
              type="button"
              className={`preset-btn ${currentDim === 1280 ? 'active' : ''}`}
              onClick={() => handleSelectTier(1280)}
              title="Standard HD (1280px) - Recommended for web, desktop & logos"
            >
              <Sparkles size={13} />
              <span>Standard HD (1280px)</span>
            </button>
            <button
              type="button"
              className={`preset-btn ${currentDim === 2048 ? 'active' : ''}`}
              onClick={() => handleSelectTier(2048)}
              title="Ultra 2K (2048px) - High-DPI screens & Retina displays"
            >
              <span>Ultra 2K</span>
            </button>
            <button
              type="button"
              className={`preset-btn ${currentDim === 2550 ? 'active' : ''}`}
              onClick={() => handleSelectTier(2550)}
              title="Standard 8.5x11 Letter Print (300 DPI)"
            >
              <Printer size={13} />
              <span>Letter Print</span>
            </button>
          </div>

          <button
            type="button"
            className="btn-ghost-sm"
            onClick={() => setExpanded(!expanded)}
            title="Toggle fine-grained quality tiers and options"
          >
            <span>{expanded ? 'Fewer Options' : 'All Quality Tiers & Settings'}</span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="optimization-body">
          {/* Category Tabs */}
          <div className="quality-category-nav">
            <button
              type="button"
              className={`cat-tab ${activeTab === 'digital' ? 'active' : ''}`}
              onClick={() => setActiveTab('digital')}
            >
              <Monitor size={15} />
              <span>Digital &amp; Screen Displays</span>
            </button>
            <button
              type="button"
              className={`cat-tab ${activeTab === 'print' ? 'active' : ''}`}
              onClick={() => setActiveTab('print')}
            >
              <Printer size={15} />
              <span>Print &amp; Display Materials</span>
            </button>
            <button
              type="button"
              className={`cat-tab ${activeTab === 'custom' ? 'active' : ''}`}
              onClick={() => setActiveTab('custom')}
            >
              <Maximize2 size={15} />
              <span>Native &amp; Custom Dimension</span>
            </button>
          </div>

          {/* Unified Tier Grid for Digital & Print */}
          {(activeTab === 'digital' || activeTab === 'print') && (
            <div className="tier-cards-grid">
              {QUALITY_TIERS.filter((t) => t.category === activeTab).map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  className={`tier-card ${currentDim === tier.dimension ? 'selected' : ''}`}
                  onClick={() => handleSelectTier(tier.dimension)}
                >
                  <div className="tier-card-header">
                    <span className="tier-title">{tier.label}</span>
                    {tier.dimension === 1280 && (
                      <span className="badge-recommended">Recommended</span>
                    )}
                  </div>
                  <p className="tier-desc">{tier.description}</p>
                </button>
              ))}
            </div>
          )}

          {/* Native & Custom Option */}
          {activeTab === 'custom' && (
            <div className="custom-dim-container">
              <div className="tier-cards-grid single-col">
                <button
                  type="button"
                  className={`tier-card ${currentDim === 0 ? 'selected' : ''}`}
                  onClick={() => handleSelectTier(0)}
                >
                  <div className="tier-card-header">
                    <span className="tier-title">Original 1:1 Dimensions (Unscaled)</span>
                    <span className="badge-warning">May Produce 100MB+ SVG</span>
                  </div>
                  <p className="tier-desc">
                    Processes the input image at native pixel bounds without any downscaling. Recommended for PNGs and pixel art. For large JPEGs, this can generate millions of vector elements.
                  </p>
                </button>
              </div>

              <form className="custom-input-card" onSubmit={handleCustomSubmit}>
                <label htmlFor="custom-dim-input">
                  <strong>Custom Max Dimension (Width or Height Ceiling)</strong>
                  <p className="control-hint">Specify any target dimension from 64px to 8192px.</p>
                </label>
                <div className="custom-input-row">
                  <input
                    id="custom-dim-input"
                    type="number"
                    min={64}
                    max={8192}
                    step={16}
                    value={customDim}
                    onChange={(e) => setCustomDim(e.target.value)}
                    className="number-input"
                  />
                  <span className="unit-label">px</span>
                  <button type="submit" className="btn-secondary-sm">
                    Apply Dimension
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Resampling Mode Selector */}
          <div className="resampling-selector-row">
            <span className="selector-label">Resampling Filter:</span>
            <div className="resampling-options">
              <label className={`resampling-radio ${options.resamplingMode !== 'pixelated' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="resampling"
                  checked={options.resamplingMode !== 'pixelated'}
                  onChange={() => onChange({ ...options, resamplingMode: 'smooth' })}
                />
                <div>
                  <strong>Smooth (High-Quality Bilinear)</strong>
                  <span>Smooths photographic noise and continuous tones (ideal for JPEGs &amp; logos)</span>
                </div>
              </label>

              <label className={`resampling-radio ${options.resamplingMode === 'pixelated' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="resampling"
                  checked={options.resamplingMode === 'pixelated'}
                  onChange={() => onChange({ ...options, resamplingMode: 'pixelated' })}
                />
                <div>
                  <strong>Crisp / Sharp (Nearest-Neighbor)</strong>
                  <span>Zero color blending; samples original pixels directly (ideal for pixel art &amp; flat graphics)</span>
                </div>
              </label>
            </div>
          </div>

          {/* Engine Optimizations Grid */}
          <div className="toggles-grid">
            <label className="toggle-item">
              <input
                type="checkbox"
                checked={options.pathGrouping ?? true}
                onChange={(e) => onChange({ ...options, pathGrouping: e.target.checked })}
              />
              <div>
                <strong>Group by Color (&lt;path&gt;)</strong>
                <p>Consolidates runs into shared subpaths, cutting XML size by ~50%</p>
              </div>
            </label>

            <label className="toggle-item">
              <input
                type="checkbox"
                checked={options.merge2D ?? true}
                onChange={(e) => onChange({ ...options, merge2D: e.target.checked })}
              />
              <div>
                <strong>2D Rectangle Consolidation</strong>
                <p>Merges contiguous vertical scanlines into multi-height rectangles</p>
              </div>
            </label>
          </div>

          {onApply && (
            <div className="apply-row">
              <button
                type="button"
                className="btn-primary"
                onClick={onApply}
                disabled={isConverting}
              >
                <RefreshCw size={15} className={isConverting ? 'spinner' : ''} />
                <span>{isConverting ? 'Converting...' : 'Re-convert with These Settings'}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
