import { describe, it, expect } from 'vitest';
import {
  parseLengthToPixels,
  parseSvgDimensions,
  calculateDimensions,
  prepareSvgForRasterization,
} from '../src/engine/rasterizer';

describe('SVG Dimension Parser & Calculator', () => {
  it('parses various CSS length units to pixels correctly', () => {
    expect(parseLengthToPixels('100px')).toBe(100);
    expect(parseLengthToPixels('100')).toBe(100);
    expect(parseLengthToPixels('1in')).toBe(96);
    expect(parseLengthToPixels('8.5in')).toBe(816);
    expect(parseLengthToPixels('11in')).toBe(1056);
    expect(parseLengthToPixels('2.54cm')).toBeCloseTo(96, 1);
    expect(parseLengthToPixels('25.4mm')).toBeCloseTo(96, 1);
    expect(parseLengthToPixels('72pt')).toBe(96);
    expect(parseLengthToPixels('6pc')).toBe(96);
    expect(parseLengthToPixels('')).toBeNull();
  });

  it('parses dimensions and viewBox from standard SVG tags', () => {
    const svg1 = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6144 5299" width="6144" height="5299"></svg>';
    const dims1 = parseSvgDimensions(svg1);
    expect(dims1.width).toBe(6144);
    expect(dims1.height).toBe(5299);
    expect(dims1.viewBox).toEqual({ x: 0, y: 0, width: 6144, height: 5299 });

    // With viewBox only, no explicit width/height
    const svg2 = '<svg viewBox="0 0 1200 800"><path d="M0 0"/></svg>';
    const dims2 = parseSvgDimensions(svg2);
    expect(dims2.width).toBe(1200);
    expect(dims2.height).toBe(800);

    // With physical units
    const svg3 = '<svg width="8.5in" height="11in" viewBox="0 0 850 1100"></svg>';
    const dims3 = parseSvgDimensions(svg3);
    expect(dims3.width).toBe(816);
    expect(dims3.height).toBe(1056);
  });

  it('calculates native dimensions correctly for 100 DPI', () => {
    const dims = calculateDimensions(6144, 5299, 100, 'native');
    expect(dims.pixelWidth).toBe(6144);
    expect(dims.pixelHeight).toBe(5299);
    expect(dims.dpi).toBe(100);
    expect(dims.printWidthInches).toBe(61.44);
    expect(dims.printHeightInches).toBe(52.99);
    expect(dims.printWidthCm).toBeCloseTo(156.06, 1);
    expect(dims.printHeightCm).toBeCloseTo(134.60, 1);
  });

  it('calculates dpi-scaled dimensions relative to 96 DPI base', () => {
    // 960x480 at 96 DPI is 10" x 5". At 100 DPI it should be 1000x500 px.
    const dims = calculateDimensions(960, 480, 100, 'dpi-scaled');
    expect(dims.pixelWidth).toBe(1000);
    expect(dims.pixelHeight).toBe(500);
    expect(dims.printWidthInches).toBe(10);
    expect(dims.printHeightInches).toBe(5);

    // At 300 DPI, 960x480 should scale by 300/96 = 3.125 -> 3000x1500 px
    const dims300 = calculateDimensions(960, 480, 300, 'dpi-scaled');
    expect(dims300.pixelWidth).toBe(3000);
    expect(dims300.pixelHeight).toBe(1500);
  });

  it('calculates custom scale and custom maxDimension', () => {
    const dimsScale = calculateDimensions(1000, 500, 100, 'custom', { scale: 2 });
    expect(dimsScale.pixelWidth).toBe(2000);
    expect(dimsScale.pixelHeight).toBe(1000);

    const dimsMax = calculateDimensions(1000, 500, 100, 'custom', { maxDimension: 2500 });
    expect(dimsMax.pixelWidth).toBe(2500);
    expect(dimsMax.pixelHeight).toBe(1250);
  });

  it('prepares SVG for rasterization by updating width, height, and preserving viewBox', () => {
    const rawSvg = '<svg viewBox="0 0 100 200" width="100" height="200" class="test"><rect/></svg>';
    const prepared = prepareSvgForRasterization(rawSvg, 500, 1000);
    expect(prepared).toContain('width="500"');
    expect(prepared).toContain('height="1000"');
    expect(prepared).toContain('viewBox="0 0 100 200"');
  });
});
