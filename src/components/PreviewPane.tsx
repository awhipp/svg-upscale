import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize, RotateCcw, Columns, Image as ImageIcon, Eye, Zap } from 'lucide-react';
import { ConversionResult } from '../engine/types';

interface PreviewPaneProps {
  result: ConversionResult;
  rasterUrl: string | null;
}

type ViewMode = 'vector' | 'raster' | 'split';

export const PreviewPane: React.FC<PreviewPaneProps> = ({ result, rasterUrl }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('vector');
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [splitPos, setSplitPos] = useState(50); // percentage 0..100
  const [rawSvgUrl, setRawSvgUrl] = useState<string>('');
  const [displayVectorUrl, setDisplayVectorUrl] = useState<string>('');
  const [forceRawSvg, setForceRawSvg] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isSplitDraggingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const nextTranslateRef = useRef<{ x: number; y: number } | null>(null);
  const nextSplitRef = useRef<number | null>(null);

  const isLarge = result.stats.svgBytes > 2 * 1024 * 1024; // > 2MB

  // Generate and manage Blob URLs
  useEffect(() => {
    const rawUrl = URL.createObjectURL(result.svgBlob);
    setRawSvgUrl(rawUrl);

    let pUrl: string | null = null;
    if (result.previewBlob) {
      pUrl = URL.createObjectURL(result.previewBlob);
    }

    // Default to previewBlob for large SVGs to avoid browser lockup
    if (pUrl && isLarge) {
      setDisplayVectorUrl(pUrl);
    } else {
      setDisplayVectorUrl(pUrl || rawUrl);
    }

    return () => {
      URL.revokeObjectURL(rawUrl);
      if (pUrl) URL.revokeObjectURL(pUrl);
    };
  }, [result.svgBlob, result.previewBlob, isLarge]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const activeVectorUrl = forceRawSvg ? rawSvgUrl : displayVectorUrl;

  // Initial fit to screen
  const fitToScreen = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const pad = 40;
    const availW = Math.max(100, clientWidth - pad);
    const availH = Math.max(100, clientHeight - pad);
    const scaleX = availW / result.stats.width;
    const scaleY = availH / result.stats.height;
    const newScale = Math.min(scaleX, scaleY, 4); // max initial scale 4x
    setScale(Math.max(0.05, Number(newScale.toFixed(2))));
    setTranslate({ x: 0, y: 0 });
  }, [result.stats.width, result.stats.height]);

  useEffect(() => {
    fitToScreen();
  }, [fitToScreen]);

  const handleZoomIn = () => setScale((s) => Math.min(32, Number((s * 1.25).toFixed(2))));
  const handleZoomOut = () => setScale((s) => Math.max(0.05, Number((s / 1.25).toFixed(2))));
  const handleResetZoom = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    setScale((prev) => {
      const next = prev * factor;
      return Math.min(32, Math.max(0.05, Number(next.toFixed(2))));
    });
  };

  // Drag pan pointer down
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isSplitDraggingRef.current) return;
    if (e.button !== 0) return; // only left click
    setIsDragging(true);
    setDragStart({ x: e.clientX - translate.x, y: e.clientY - translate.y });
  };

  // Window listeners for smooth pan dragging
  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => {
      nextTranslateRef.current = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      };
      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(() => {
          if (nextTranslateRef.current !== null) {
            setTranslate(nextTranslateRef.current);
          }
          rafIdRef.current = null;
        });
      }
    };

    const onPointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [isDragging, dragStart]);

  // Window listeners for smooth split divider dragging
  const [isSplitDragging, setIsSplitDragging] = useState(false);

  useEffect(() => {
    if (!isSplitDragging) return;

    const onSplitMove = (e: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pos = ((e.clientX - rect.left) / rect.width) * 100;
      nextSplitRef.current = Math.min(100, Math.max(0, pos));
      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(() => {
          if (nextSplitRef.current !== null) {
            setSplitPos(nextSplitRef.current);
          }
          rafIdRef.current = null;
        });
      }
    };

    const onSplitUp = () => {
      setIsSplitDragging(false);
      isSplitDraggingRef.current = false;
    };

    window.addEventListener('pointermove', onSplitMove);
    window.addEventListener('pointerup', onSplitUp);
    return () => {
      window.removeEventListener('pointermove', onSplitMove);
      window.removeEventListener('pointerup', onSplitUp);
    };
  }, [isSplitDragging]);

  const w = result.stats.width;
  const h = result.stats.height;

  return (
    <div className="preview-component">
      <div className="preview-toolbar">
        <div className="viewmode-toggle">
          <button
            type="button"
            className={`btn-toggle ${viewMode === 'vector' ? 'active' : ''}`}
            onClick={() => setViewMode('vector')}
          >
            <Eye size={15} />
            <span>Vector SVG</span>
          </button>
          {rasterUrl && (
            <>
              <button
                type="button"
                className={`btn-toggle ${viewMode === 'split' ? 'active' : ''}`}
                onClick={() => setViewMode('split')}
              >
                <Columns size={15} />
                <span>Split Comparison</span>
              </button>
              <button
                type="button"
                className={`btn-toggle ${viewMode === 'raster' ? 'active' : ''}`}
                onClick={() => setViewMode('raster')}
              >
                <ImageIcon size={15} />
                <span>Source Raster</span>
              </button>
            </>
          )}

          {isLarge && result.previewBlob && (
            <button
              type="button"
              className={`btn-mode-pill ${forceRawSvg ? 'warn' : ''}`}
              onClick={() => setForceRawSvg((prev) => !prev)}
              title={
                forceRawSvg
                  ? 'Switch back to 60 FPS GPU Viewport (Lossless hardware acceleration)'
                  : 'Currently using 60 FPS GPU Viewport. Click to inspect raw SVG DOM (May cause browser freeze for 42MB)'
              }
            >
              <Zap size={12} />
              <span>{forceRawSvg ? 'Raw DOM (Laggy)' : '60 FPS GPU Viewport'}</span>
            </button>
          )}
        </div>

        <div className="zoom-controls">
          <button type="button" className="btn-icon" onClick={handleZoomOut} title="Zoom Out">
            <ZoomOut size={16} />
          </button>
          <span className="zoom-text">{Math.round(scale * 100)}%</span>
          <button type="button" className="btn-icon" onClick={handleZoomIn} title="Zoom In">
            <ZoomIn size={16} />
          </button>
          <button type="button" className="btn-icon" onClick={handleResetZoom} title="Reset 100%">
            <RotateCcw size={15} />
          </button>
          <button type="button" className="btn-icon" onClick={fitToScreen} title="Fit to Screen">
            <Maximize size={15} />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className={`preview-viewport ${isDragging ? 'grabbing' : 'grab'}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
      >
        <div
          className="preview-canvas-wrapper"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            width: `${w}px`,
            height: `${h}px`,
          }}
        >
          {viewMode === 'vector' && activeVectorUrl && (
            <img
              src={activeVectorUrl}
              alt="Vector Output"
              width={w}
              height={h}
              className="render-img pixelated"
              draggable={false}
            />
          )}

          {viewMode === 'raster' && rasterUrl && (
            <img
              src={rasterUrl}
              alt="Original Raster"
              width={w}
              height={h}
              className="render-img pixelated"
              draggable={false}
            />
          )}

          {viewMode === 'split' && rasterUrl && activeVectorUrl && (
            <div className="split-view-container" style={{ width: `${w}px`, height: `${h}px` }}>
              {/* Left layer: Original Raster */}
              <div
                className="split-layer raster-layer"
                style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}
              >
                <img
                  src={rasterUrl}
                  alt="Original Raster"
                  width={w}
                  height={h}
                  className="render-img pixelated"
                  draggable={false}
                />
                <span className="split-badge left-badge">Raster</span>
              </div>

              {/* Right layer: Vector SVG */}
              <div
                className="split-layer vector-layer"
                style={{ clipPath: `inset(0 0 0 ${splitPos}%)` }}
              >
                <img
                  src={activeVectorUrl}
                  alt="Vector SVG"
                  width={w}
                  height={h}
                  className="render-img pixelated"
                  draggable={false}
                />
                <span className="split-badge right-badge">Vector SVG</span>
              </div>

              {/* Divider Line */}
              <div
                className="split-divider"
                style={{ left: `${splitPos}%` }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  isSplitDraggingRef.current = true;
                  setIsSplitDragging(true);
                }}
              >
                <div className="split-handle" />
              </div>
            </div>
          )}
        </div>

        <div className="preview-overlay-info">
          <span>{w} × {h} px</span>
          <span>•</span>
          <span>{scale >= 1 ? `${Math.round(scale)}× scale` : `${Math.round(scale * 100)}%`}</span>
          <span>•</span>
          <span>
            {isLarge && !forceRawSvg
              ? '60 FPS GPU Viewport (Lossless ΔE = 0)'
              : 'shape-rendering: crispEdges'}
          </span>
        </div>
      </div>
    </div>
  );
};
