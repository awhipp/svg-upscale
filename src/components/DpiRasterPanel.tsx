import React, { useState, useMemo } from 'react';
import {
  Printer,
  Sparkles,
  Maximize2,
  Check,
  AlertCircle,
  Loader2,
  FileImage,
  Info,
  Download,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  DPI_PRESETS,
  parseSvgDimensions,
  calculateDimensions,
  rasterizeSvgToPng,
  DimensionMode,
  dpiToPixelsPerMetre,
} from '../engine';
import { downloadBlob } from '../utils/download';

interface DpiRasterPanelProps {
  svgText: string;
  defaultFilename?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const DpiRasterPanel: React.FC<DpiRasterPanelProps> = ({
  svgText,
  defaultFilename = 'image',
  isExpanded = true,
  onToggleExpand,
}) => {
  const [dpi, setDpi] = useState<number>(100);
  const [customDpiInput, setCustomDpiInput] = useState<string>('100');
  const [dimensionMode, setDimensionMode] = useState<DimensionMode>('native');
  const [customScale, setCustomScale] = useState<number>(1);
  const [customDimension, setCustomDimension] = useState<string>('');
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Parse native dimensions from SVG
  const nativeDims = useMemo(() => {
    try {
      return parseSvgDimensions(svgText);
    } catch {
      return { width: 1280, height: 720 };
    }
  }, [svgText]);

  // Calculate live output specifications
  const calculated = useMemo(() => {
    const customOpts = {
      scale: customScale,
      maxDimension: customDimension ? parseInt(customDimension, 10) : undefined,
    };
    return calculateDimensions(
      nativeDims.width,
      nativeDims.height,
      dpi,
      dimensionMode,
      customOpts
    );
  }, [nativeDims, dpi, dimensionMode, customScale, customDimension]);

  const handleSelectDpiPreset = (presetDpi: number) => {
    setDpi(presetDpi);
    setCustomDpiInput(String(presetDpi));
  };

  const handleCustomDpiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomDpiInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 2400) {
      setDpi(parsed);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setDownloadSuccess(false);

    try {
      const result = await rasterizeSvgToPng(svgText, {
        dpi: calculated.dpi,
        targetWidth: calculated.pixelWidth,
        targetHeight: calculated.pixelHeight,
      });

      const baseName =
        defaultFilename.replace(/\.(svg|png|jpe?g|webp|bmp)$/i, '').trim() || 'image';
      const outputFilename = `${baseName}-${calculated.dpi}dpi.png`;

      // Use resilient download utility
      await downloadBlob(result.blob, outputFilename, {
        mimeType: 'image/png',
        description: 'High-DPI Lossless PNG Image (*.png)',
      });

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err: unknown) {
      console.error('Failed to rasterize PNG with DPI:', err);
      setError(err instanceof Error ? err.message : 'Rasterization failed.');
    } finally {
      setExporting(false);
    }
  };

  const ppm = dpiToPixelsPerMetre(calculated.dpi);

  return (
    <div className="dpi-raster-panel">
      {/* Panel Header */}
      <div className="dpi-panel-header">
        <div className="dpi-panel-title-group">
          <Printer size={18} className="text-sky" />
          <span className="dpi-panel-heading">DPI-Specific PNG Rasterizer</span>
          <span className="dpi-panel-sub">
            <span className="highlight-sky font-semibold">{calculated.dpi} DPI</span>
            {' • '}
            <span>
              {calculated.pixelWidth.toLocaleString()} × {calculated.pixelHeight.toLocaleString()} px
            </span>
            {' • '}
            <span>
              {calculated.printWidthInches}" × {calculated.printHeightInches}" print
            </span>
            {' • '}
            <span className="text-emerald">Standard pHYs Chunk</span>
          </span>
        </div>

        <div className="dpi-panel-header-actions">
          {/* Quick DPI Chips */}
          <div className="dpi-quick-chips">
            <button
              type="button"
              className={`preset-btn ${dpi === 100 ? 'active' : ''}`}
              onClick={() => handleSelectDpiPreset(100)}
              title="100 DPI - Standard Client / Vendor Minimum"
            >
              <Sparkles size={13} />
              <span>100 DPI</span>
            </button>
            <button
              type="button"
              className={`preset-btn ${dpi === 150 ? 'active' : ''}`}
              onClick={() => handleSelectDpiPreset(150)}
              title="150 DPI - Medium Print & Newsprint"
            >
              <span>150 DPI</span>
            </button>
            <button
              type="button"
              className={`preset-btn ${dpi === 300 ? 'active' : ''}`}
              onClick={() => handleSelectDpiPreset(300)}
              title="300 DPI - Commercial High-Res Print"
            >
              <Printer size={13} />
              <span>300 DPI</span>
            </button>
            <button
              type="button"
              className={`preset-btn ${dpi === 600 ? 'active' : ''}`}
              onClick={() => handleSelectDpiPreset(600)}
              title="600 DPI - Ultra Fine Art & Vector Line Printing"
            >
              <span>600 DPI</span>
            </button>
          </div>

          {onToggleExpand && (
            <button
              type="button"
              className="btn-ghost-sm"
              onClick={onToggleExpand}
              title="Toggle DPI rasterization settings"
            >
              <span>{isExpanded ? 'Hide Settings' : 'Configure DPI & Dimensions'}</span>
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="dpi-panel-body">
          {error && (
            <div className="error-banner">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Target DPI Selection */}
          <div className="dpi-section">
            <div className="section-label-row">
              <span className="section-label">1. Target Resolution (DPI Minimum):</span>
              <span className="section-hint">Embeds standard binary <code>pHYs</code> chunk (ISO/IEC 15948)</span>
            </div>

            <div className="dpi-presets-grid">
              {DPI_PRESETS.map((preset) => {
                const isSelected = dpi === preset.dpi;
                return (
                  <button
                    key={preset.dpi}
                    type="button"
                    className={`dpi-preset-chip ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectDpiPreset(preset.dpi)}
                  >
                    <div className="dpi-chip-top">
                      <span className="dpi-chip-val">{preset.label}</span>
                    </div>
                    <span className="dpi-chip-desc">{preset.description}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom DPI Input */}
            <div className="custom-dpi-row">
              <span className="custom-dpi-label">Or custom DPI:</span>
              <div className="custom-dpi-input-wrap">
                <input
                  type="number"
                  min={20}
                  max={2400}
                  value={customDpiInput}
                  onChange={handleCustomDpiChange}
                  className="dpi-number-input"
                  placeholder="100"
                />
                <span className="dpi-unit-tag">DPI</span>
              </div>
              <span className="custom-dpi-ppm-hint">
                = {ppm.toLocaleString()} pixels/metre in PNG header
              </span>
            </div>
          </div>

          {/* Section 2: Dimension & Scaling Mode */}
          <div className="dpi-section">
            <div className="section-label-row">
              <span className="section-label">2. Sizing &amp; Pixel Dimensions:</span>
            </div>

            <div className="dimension-modes-grid">
              <button
                type="button"
                className={`mode-card ${dimensionMode === 'native' ? 'selected' : ''}`}
                onClick={() => setDimensionMode('native')}
              >
                <div className="mode-card-header">
                  <Sparkles size={16} className="text-sky" />
                  <span className="mode-title">Native 1:1 Pixel Preservation</span>
                </div>
                <p className="mode-desc">
                  Preserves the exact {nativeDims.width} × {nativeDims.height} px grid. Tagged with {dpi} DPI, yielding a {calculated.printWidthInches}" × {calculated.printHeightInches}" print.
                </p>
              </button>

              <button
                type="button"
                className={`mode-card ${dimensionMode === 'dpi-scaled' ? 'selected' : ''}`}
                onClick={() => setDimensionMode('dpi-scaled')}
              >
                <div className="mode-card-header">
                  <Printer size={16} className="text-indigo" />
                  <span className="mode-title">DPI-Scaled (from 96 DPI base)</span>
                </div>
                <p className="mode-desc">
                  Scales pixels ({dpi}/96 = {Number((dpi / 96).toFixed(2))}×) so physical print size remains identical while pixel density increases.
                </p>
              </button>

              <button
                type="button"
                className={`mode-card ${dimensionMode === 'custom' ? 'selected' : ''}`}
                onClick={() => setDimensionMode('custom')}
              >
                <div className="mode-card-header">
                  <Maximize2 size={16} className="text-emerald" />
                  <span className="mode-title">Custom Multiplier / Dimension</span>
                </div>
                <p className="mode-desc">
                  Specify a custom scale multiplier (e.g. 2×, 4×) or target pixel bounding box.
                </p>
              </button>
            </div>

            {dimensionMode === 'custom' && (
              <div className="custom-scale-subpanel">
                <div className="scale-quick-chips">
                  <span className="subpanel-label">Scale Multiplier:</span>
                  {[0.5, 1, 1.5, 2, 3, 4].map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`scale-chip ${customScale === s && !customDimension ? 'active' : ''}`}
                      onClick={() => {
                        setCustomScale(s);
                        setCustomDimension('');
                      }}
                    >
                      {s}×
                    </button>
                  ))}
                </div>

                <div className="custom-dim-input-row">
                  <span className="subpanel-label">Or Max Dimension:</span>
                  <input
                    type="number"
                    min={64}
                    max={16384}
                    step={64}
                    value={customDimension}
                    onChange={(e) => setCustomDimension(e.target.value)}
                    placeholder="e.g. 4096"
                    className="dpi-number-input"
                  />
                  <span className="dpi-unit-tag">px</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Live Output Specifications Readout */}
          <div className="specs-card">
            <div className="specs-header">
              <FileImage size={16} className="text-sky" />
              <span>Target Output Specifications</span>
            </div>

            <div className="specs-grid">
              <div className="spec-item">
                <span className="spec-label">Pixel Resolution</span>
                <span className="spec-val">
                  {calculated.pixelWidth.toLocaleString()} × {calculated.pixelHeight.toLocaleString()} px
                </span>
                <span className="spec-sub">
                  {((calculated.pixelWidth * calculated.pixelHeight) / 1_000_000).toFixed(1)} Megapixels
                </span>
              </div>

              <div className="spec-item">
                <span className="spec-label">Physical Print Size</span>
                <span className="spec-val">
                  {calculated.printWidthInches}" × {calculated.printHeightInches}"
                </span>
                <span className="spec-sub">
                  {calculated.printWidthCm} × {calculated.printHeightCm} cm
                </span>
              </div>

              <div className="spec-item">
                <span className="spec-label">Resolution Metadata</span>
                <span className="spec-val highlight-sky">
                  {calculated.dpi} DPI
                </span>
                <span className="spec-sub">
                  {ppm.toLocaleString()} pixels/metre (pHYs chunk)
                </span>
              </div>

              <div className="spec-item">
                <span className="spec-label">Color &amp; Alpha</span>
                <span className="spec-val">32-bit RGBA</span>
                <span className="spec-sub">Lossless Transparency</span>
              </div>
            </div>

            <div className="specs-note">
              <Info size={14} className="text-sky" />
              <span>
                Exported PNG embeds official binary <code>pHYs</code> physical resolution metadata recognized by Windows Properties, Adobe Photoshop, InDesign, Illustrator, and print preflight tools.
              </span>
            </div>
          </div>

          {/* Section 4: Primary Action Button */}
          <div className="dpi-action-row">
            <button
              type="button"
              className="btn-primary-large"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? (
                <>
                  <Loader2 size={18} className="spinner" />
                  <span>Rasterizing at {calculated.dpi} DPI...</span>
                </>
              ) : downloadSuccess ? (
                <>
                  <Check size={18} className="text-emerald" />
                  <span>Downloaded {calculated.dpi} DPI PNG!</span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <span>Download PNG ({calculated.dpi} DPI)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
