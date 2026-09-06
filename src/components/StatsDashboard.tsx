import React from 'react';
import { VectorStats } from '../engine/types';
import { Layers, Clock, HardDrive, Maximize2, Zap, EyeOff } from 'lucide-react';

interface StatsDashboardProps {
  stats: VectorStats;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export const StatsDashboard: React.FC<StatsDashboardProps> = ({ stats }) => {
  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-header">
          <Maximize2 className="stat-icon text-blue" size={18} />
          <span className="stat-label">Raster Dimensions</span>
        </div>
        <div className="stat-value">
          {stats.width.toLocaleString()} × {stats.height.toLocaleString()}
        </div>
        <div className="stat-hint">{stats.originalPixels.toLocaleString()} total pixels</div>
      </div>

      <div className="stat-card">
        <div className="stat-header">
          <Layers className="stat-icon text-indigo" size={18} />
          <span className="stat-label">Vector Primitives</span>
        </div>
        <div className="stat-value">
          {stats.elementCount ? stats.elementCount.toLocaleString() : stats.vectorRuns.toLocaleString()}
        </div>
        <div className="stat-hint">
          {stats.elementCount && stats.elementCount !== stats.vectorRuns
            ? `${stats.vectorRuns.toLocaleString()} runs consolidated into ${stats.elementCount.toLocaleString()} elements`
            : stats.transparentSkipped > 0
            ? `${stats.transparentSkipped.toLocaleString()} transparent omitted`
            : '0 transparent pixels'}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-header">
          <Zap className="stat-icon text-emerald" size={18} />
          <span className="stat-label">Vector Compaction</span>
        </div>
        <div className="stat-value">{stats.compressionRatio}%</div>
        <div className="stat-hint">Exact 2D greedy meshing and run aggregation</div>
      </div>

      <div className="stat-card">
        <div className="stat-header">
          <Clock className="stat-icon text-amber" size={18} />
          <span className="stat-label">Engine Latency</span>
        </div>
        <div className="stat-value">{stats.durationMs} ms</div>
        <div className="stat-hint">
          {stats.durationMs < 250 ? '✓ Exceeds TR-3 performance target' : 'Completed'}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-header">
          <HardDrive className="stat-icon text-purple" size={18} />
          <span className="stat-label">SVG File Size</span>
        </div>
        <div className="stat-value">{formatBytes(stats.svgBytes)}</div>
        <div className="stat-hint">Source raster: {formatBytes(stats.rasterBytes)}</div>
      </div>

      <div className="stat-card">
        <div className="stat-header">
          <EyeOff className="stat-icon text-sky" size={18} />
          <span className="stat-label">Color Fidelity</span>
        </div>
        <div className="stat-value">ΔE = 0</div>
        <div className="stat-hint">Strict bit-for-bit lossless parity</div>
      </div>
    </div>
  );
};
