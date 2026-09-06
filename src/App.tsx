import React, { useState, useCallback } from 'react';
import { DropZone } from './components/DropZone';
import { PreviewPane } from './components/PreviewPane';
import { StatsDashboard } from './components/StatsDashboard';
import { Toolbar } from './components/Toolbar';
import { OptimizationSettings } from './components/OptimizationSettings';
import { convertRasterToSvg } from './engine';
import { ConversionOptions, ConversionProgress, ConversionResult } from './engine/types';
import { ShieldCheck, Sparkles, AlertCircle, Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const [filename, setFilename] = useState<string>('image.png');
  const [rasterUrl, setRasterUrl] = useState<string | null>(null);
  const [converting, setConverting] = useState<boolean>(false);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const handleFileSelected = async (selectedFile: File) => {
    try {
      const buffer = await selectedFile.arrayBuffer();
      await processBuffer(buffer, selectedFile.type, selectedFile.name, false, options);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to read image file.');
      setConverting(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-brand">
          <div className="logo-badge">
            <Sparkles size={20} className="text-sky" />
          </div>
          <div>
            <h1 className="header-title">Lossless 1:1 Vector Engine</h1>
            <p className="header-subtitle">
              Pure client-side zero-drift (ΔE = 0) raster to SVG run-length vectorizer
            </p>
          </div>
        </div>

        <div className="header-actions">
          <div className="header-badges">
            <span className="pill-badge">
              <ShieldCheck size={14} className="text-emerald" />
              <span>Pure Client-Side</span>
            </span>
            <span className="pill-badge">ΔE = 0 Parity Available</span>
            <span className="pill-badge">Adaptive 2D RLE Meshing</span>
          </div>

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
                  <span>{progress?.step?.toUpperCase()}</span>
                  <span>{progress?.progress || 0}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

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
          />
        )}

        {result && !converting && (
          <div className="result-workspace">
            <Toolbar result={result} filename={filename} onReset={handleReset} />
            <StatsDashboard stats={result.stats} />
            <PreviewPane result={result} rasterUrl={rasterUrl} />
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
            <span className="footer-dot">•</span>
            <a href="./SPEC.md" target="_blank" rel="noreferrer">
              SPEC.md
            </a>
          </div>
          <p className="footer-note">
            Direct binary PNG extraction bypasses host GPU gamut mapping &amp; alpha premultiplication. Zero color drift (ΔE = 0).
          </p>
        </div>
      </footer>
    </div>
  );
};
export default App;
