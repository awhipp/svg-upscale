import React, { useState, useCallback } from 'react';
import { DropZone } from './components/DropZone';
import { PreviewPane } from './components/PreviewPane';
import { StatsDashboard } from './components/StatsDashboard';
import { Toolbar } from './components/Toolbar';
import { OptimizationSettings } from './components/OptimizationSettings';
import { DpiRasterPanel } from './components/DpiRasterPanel';
import { HowItWorksModal } from './components/HowItWorksModal';
import { convertRasterToSvg, parseSvgDimensions } from './engine';
import { ConversionOptions, ConversionProgress, ConversionResult } from './engine/types';
import {
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Loader2,
  Printer,
  Info,
  SlidersHorizontal,
} from 'lucide-react';

export type AppFlow = 'vectorize' | 'rasterize';

export const App: React.FC = () => {
  const [activeFlow, setActiveFlow] = useState<AppFlow>('vectorize');
  const [filename, setFilename] = useState<string>('image.png');
  const [rasterUrl, setRasterUrl] = useState<string | null>(null);
  const [converting, setConverting] = useState<boolean>(false);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRasterPanelOpen, setIsRasterPanelOpen] = useState<boolean>(false);
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);

  const [options, setOptions] = useState<ConversionOptions>({
    maxDimension: 1280, // Standard HD default
    resamplingMode: 'smooth',
    merge2D: true,
    pathGrouping: true,
  });

  const [currentBuffer, setCurrentBuffer] = useState<{
    buffer: ArrayBuffer;
    mimeType: string;
    name: string;
  } | null>(null);

  // Clean up object URLs on unmount or reset
  const cleanupRasterUrl = useCallback(() => {
    setRasterUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const handleReset = () => {
    cleanupRasterUrl();
    setResult(null);
    setProgress(null);
    setError(null);
    setCurrentBuffer(null);
    setIsRasterPanelOpen(false);
  };

  const processBuffer = async (
    buffer: ArrayBuffer,
    mimeType: string,
    name: string,
    keepExistingUrl = false,
    overrideOptions?: ConversionOptions
  ) => {
    if (!keepExistingUrl) {
      cleanupRasterUrl();
      const blob = new Blob([buffer], { type: mimeType });
      const url = URL.createObjectURL(blob);
      setRasterUrl(url);
    }

    setError(null);
    setResult(null);
    setConverting(true);
    setFilename(name);
    setCurrentBuffer({ buffer, mimeType, name });

    const activeOpts = overrideOptions || options;

    try {
      const conversionResult = await convertRasterToSvg(
        { buffer, mimeType },
        (p) => setProgress(p),
        activeOpts
      );
      setResult(conversionResult);
    } catch (err: unknown) {
      console.error('Conversion failed:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConverting(false);
    }
  };

  const handleReconvert = () => {
    if (currentBuffer) {
      processBuffer(
        currentBuffer.buffer,
        currentBuffer.mimeType,
        currentBuffer.name,
        true, // Keep existing raster URL intact
        options
      );
    }
  };

  const handleAddIslandSeed = (seed: { x: number; y: number }) => {
    const prevSeeds = options.bgRemoval?.seeds || [];
    const newSeeds = [...prevSeeds, seed];
    const updated: ConversionOptions = {
      ...options,
      bgRemoval: {
        ...options.bgRemoval,
        enabled: true,
        seeds: newSeeds,
      },
    };
    setOptions(updated);
    if (currentBuffer) {
      processBuffer(
        currentBuffer.buffer,
        currentBuffer.mimeType,
        currentBuffer.name,
        true,
        updated
      );
    }
  };

  const handleClearIslandSeeds = () => {
    const updated: ConversionOptions = {
      ...options,
      bgRemoval: {
        ...options.bgRemoval,
        enabled: options.bgRemoval?.enabled ?? true,
        seeds: [],
      },
    };
    setOptions(updated);
    if (currentBuffer) {
      processBuffer(
        currentBuffer.buffer,
        currentBuffer.mimeType,
        currentBuffer.name,
        true,
        updated
      );
    }
  };

  const handleFileSelected = async (selectedFile: File) => {
    const isSvg = selectedFile.type === 'image/svg+xml' || /\.svg$/i.test(selectedFile.name);
    if (isSvg) {
      try {
        cleanupRasterUrl();
        setConverting(true);
        setError(null);
        setFilename(selectedFile.name);
        setActiveFlow('rasterize');

        // Fast header chunk: extract viewBox and dimensions without scanning 80+ MB of markup
        const headerChunk = await selectedFile.slice(0, 8192).text();
        const dims = parseSvgDimensions(headerChunk);

        const isLargeSvg = selectedFile.size > 2 * 1024 * 1024;
        let pathCount = 1;
        let text = '';

        if (isLargeSvg) {
          pathCount = Math.max(1, Math.round(selectedFile.size / 270));
          text = await selectedFile.text();
        } else {
          text = await selectedFile.text();
          const pathMatches = text.match(/<(path|rect|circle|polygon|line|polyline)\b/gi);
          pathCount = pathMatches ? pathMatches.length : 1;
        }

        const svgBlob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' });

        // Generate fast, downscaled preview texture for instant 60 FPS viewport rendering
        let previewBlob: Blob | undefined;
        try {
          if (typeof OffscreenCanvas !== 'undefined' && typeof Image !== 'undefined') {
            const svgUrl = URL.createObjectURL(svgBlob);
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject();
              img.src = svgUrl;
            });
            URL.revokeObjectURL(svgUrl);

            const maxDim = 1920;
            const scale = Math.min(1, maxDim / Math.max(dims.width, dims.height));
            const tw = Math.max(1, Math.round(dims.width * scale));
            const th = Math.max(1, Math.round(dims.height * scale));

            const canvas = new OffscreenCanvas(tw, th);
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, tw, th);
              try {
                previewBlob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.95 });
              } catch {
                previewBlob = await canvas.convertToBlob({ type: 'image/png' });
              }
            }
          }
        } catch (prevErr) {
          console.warn('Could not generate raster preview for SVG:', prevErr);
        }

        const totalPixels = dims.width * dims.height;
        const syntheticResult: ConversionResult = {
          svgText: text,
          svgBlob,
          previewBlob,
          stats: {
            width: dims.width,
            height: dims.height,
            originalPixels: totalPixels,
            vectorRuns: pathCount,
            transparentSkipped: 0,
            compressionRatio: 1.0,
            durationMs: 0,
            svgBytes: selectedFile.size,
            rasterBytes: selectedFile.size,
            elementCount: pathCount,
          },
        };

        setResult(syntheticResult);
        setIsRasterPanelOpen(true);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to read SVG file.');
      } finally {
        setConverting(false);
      }
      return;
    }

    try {
      setActiveFlow('vectorize');
      const buffer = await selectedFile.arrayBuffer();
      await processBuffer(buffer, selectedFile.type, selectedFile.name, false, options);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to read image file.');
      setConverting(false);
    }
  };

  const handleSwitchFlow = (flow: AppFlow) => {
    setActiveFlow(flow);
    if (flow === 'rasterize') {
      setIsRasterPanelOpen(true);
    }
  };

  return (
    <div className="app-container">
      {/* Centralized Technical & Architecture Information Modal */}
      <HowItWorksModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />

      {/* Main Navigation Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="logo-badge">
            <Sparkles size={20} className="text-sky" />
          </div>
          <div>
            <h1 className="header-title">Vector &amp; High-DPI Studio</h1>
            <p className="header-subtitle">
              Convert images to scalable SVGs &amp; export print-ready, high-DPI PNGs — 100% in your browser
            </p>
          </div>
        </div>

        <div className="header-actions">
          <div className="header-badges">
            <span className="pill-badge">
              <ShieldCheck size={14} className="text-emerald" />
              <span>Private &amp; Client-Side</span>
            </span>
            <span className="pill-badge">
              <Sparkles size={14} className="text-sky" />
              <span>Exact Color Match</span>
            </span>
          </div>

          <button
            type="button"
            className="btn-info-header"
            onClick={() => setIsInfoOpen(true)}
            title="Read technical architecture, color parity details, and specification"
          >
            <Info size={15} />
            <span>How It Works</span>
          </button>

          <a
            href="https://github.com/awhipp/svg-upscale"
            target="_blank"
            rel="noopener noreferrer"
            className="header-github-link"
            title="View awhipp/svg-upscale on GitHub"
            aria-label="View awhipp/svg-upscale on GitHub"
          >
            <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <span>GitHub</span>
          </a>
        </div>
      </header>

      {/* Guided Flow Selector */}
      <div className="flow-nav-container">
        <nav className="flow-tabs-nav" aria-label="Workflow Selection">
          <button
            type="button"
            className={`flow-tab ${activeFlow === 'vectorize' ? 'active' : ''}`}
            onClick={() => handleSwitchFlow('vectorize')}
          >
            <div className="flow-tab-icon-wrap">
              <Sparkles size={18} />
            </div>
            <div className="flow-tab-content">
              <span className="flow-tab-title">1. Vectorize Image to SVG</span>
              <span className="flow-tab-desc">PNG, JPEG, WebP &rarr; Lossless SVG</span>
            </div>
          </button>

          <button
            type="button"
            className={`flow-tab ${activeFlow === 'rasterize' ? 'active' : ''}`}
            onClick={() => handleSwitchFlow('rasterize')}
          >
            <div className="flow-tab-icon-wrap">
              <Printer size={18} />
            </div>
            <div className="flow-tab-content">
              <span className="flow-tab-title">2. High-DPI PNG Rasterizer</span>
              <span className="flow-tab-desc">SVG &rarr; 100+ DPI Print-Ready PNG</span>
            </div>
            {result && activeFlow === 'vectorize' && (
              <span className="flow-tab-badge">SVG Ready</span>
            )}
          </button>
        </nav>
      </div>

      <main className="app-main">
        {error && (
          <div className="error-banner">
            <AlertCircle size={20} />
            <div>
              <strong>Conversion Error:</strong> {error}
            </div>
          </div>
        )}

        {converting && (
          <div className="progress-container">
            <div className="progress-card">
              <Loader2 className="spinner" size={32} />
              <div className="progress-info">
                <h3>{progress?.message || 'Processing image...'}</h3>
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${progress?.progress || 10}%` }}
                  />
                </div>
                <div className="progress-meta">
                  <span>{progress?.step?.toUpperCase() || 'INITIALIZING'}</span>
                  <span>{progress?.progress || 0}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FLOW 1: VECTORIZE IMAGE TO SVG */}
        {activeFlow === 'vectorize' && (
          <div className="flow-workspace">
            {/* Contextual Vectorization Settings - Only shown in Vectorize flow */}
            <OptimizationSettings
              options={options}
              onChange={setOptions}
              onApply={result ? handleReconvert : undefined}
              isConverting={converting}
            />

            {!result && !converting && (
              <DropZone
                onFileSelected={handleFileSelected}
                disabled={converting}
                activeFlow="vectorize"
              />
            )}

            {result && !converting && (
              <div className="result-workspace">
                <Toolbar
                  result={result}
                  filename={filename}
                  onReset={handleReset}
                  activeFlow="vectorize"
                  onSwitchFlow={handleSwitchFlow}
                />

                <StatsDashboard stats={result.stats} />
                <PreviewPane
                  result={result}
                  rasterUrl={rasterUrl}
                  onAddIslandSeed={currentBuffer ? handleAddIslandSeed : undefined}
                  onClearIslandSeeds={currentBuffer ? handleClearIslandSeeds : undefined}
                  islandSeeds={options.bgRemoval?.seeds}
                />
              </div>
            )}
          </div>
        )}

        {/* FLOW 2: HIGH-DPI PNG RASTERIZER */}
        {activeFlow === 'rasterize' && (
          <div className="flow-workspace">
            {!result && !converting && (
              <DropZone
                onFileSelected={handleFileSelected}
                disabled={converting}
                activeFlow="rasterize"
              />
            )}

            {result && !converting && (
              <div className="result-workspace">
                <div className="flow-notice-banner">
                  <div className="flow-notice-info">
                    <Printer size={16} className="text-sky" />
                    <span>
                      Rasterizing <strong>{filename}</strong>. Output PNG will contain an embedded physical resolution (pHYs) chunk.
                    </span>
                  </div>
                  {rasterUrl && (
                    <button
                      type="button"
                      className="btn-ghost-sm"
                      onClick={() => setActiveFlow('vectorize')}
                    >
                      <SlidersHorizontal size={14} />
                      <span>Back to Vector Settings</span>
                    </button>
                  )}
                </div>

                <DpiRasterPanel
                  svgText={result.svgText}
                  defaultFilename={filename}
                  isExpanded={isRasterPanelOpen}
                  onToggleExpand={() => setIsRasterPanelOpen((prev) => !prev)}
                />

                <Toolbar
                  result={result}
                  filename={filename}
                  onReset={handleReset}
                  activeFlow="rasterize"
                  onSwitchFlow={handleSwitchFlow}
                />

                <StatsDashboard stats={result.stats} />
                <PreviewPane
                  result={result}
                  rasterUrl={rasterUrl}
                  onAddIslandSeed={currentBuffer ? handleAddIslandSeed : undefined}
                  onClearIslandSeeds={currentBuffer ? handleClearIslandSeeds : undefined}
                  islandSeeds={options.bgRemoval?.seeds}
                />
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-links">
            <a
              href="https://github.com/awhipp/svg-upscale"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-github-link"
              title="GitHub repository: awhipp/svg-upscale"
            >
              <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              <span>awhipp/svg-upscale</span>
            </a>
            <span className="footer-dot">&bull;</span>
            <button
              type="button"
              className="footer-info-btn"
              onClick={() => setIsInfoOpen(true)}
            >
              How It Works
            </button>
            <span className="footer-dot">&bull;</span>
            <a href="./SPEC.md" target="_blank" rel="noreferrer">
              SPEC.md
            </a>
          </div>
          <p className="footer-note">
            All vector processing and high-DPI rasterization execute entirely on your device. Zero server uploads.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
