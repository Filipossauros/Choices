import { describe, it, expect } from 'vitest';
import { monotoneCubic, sampleCurve } from '../interpolation';

describe('monotoneCubic', () => {
  it('passes exactly through every node', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 0.25, y: 12 },
      { x: 0.5, y: 40 },
      { x: 0.75, y: 100 },
      { x: 1, y: 130 },
    ];
    const f = monotoneCubic(pts);
    for (const p of pts) {
      expect(f(p.x)).toBeCloseTo(p.y, 6);
    }
  });

  it('preserves the Neutro=0 / Bom=100 anchors exactly', () => {
    const f = monotoneCubic([
      { x: 0, y: -20 },
      { x: 0.4, y: 0 }, // neutral
      { x: 0.8, y: 100 }, // good
      { x: 1, y: 140 },
    ]);
    expect(f(0.4)).toBeCloseTo(0, 6);
    expect(f(0.8)).toBeCloseTo(100, 6);
  });

  it('is monotone increasing for increasing data (no overshoot)', () => {
    const f = monotoneCubic([
      { x: 0, y: 0 },
      { x: 0.33, y: 5 },
      { x: 0.66, y: 95 }, // steep jump — linear would be fine, cubic must not dip
      { x: 1, y: 100 },
    ]);
    let prev = -Infinity;
    for (let i = 0; i <= 100; i++) {
      const v = f(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(v).toBeLessThanOrEqual(100 + 1e-9);
      expect(v).toBeGreaterThanOrEqual(0 - 1e-9);
      prev = v;
    }
  });

  it('clamps outside the node range', () => {
    const f = monotoneCubic([
      { x: 0, y: 0 },
      { x: 1, y: 100 },
    ]);
    expect(f(-0.5)).toBe(0);
    expect(f(2)).toBe(100);
  });

  it('handles degenerate inputs', () => {
    expect(monotoneCubic([])(0.5)).toBe(0);
    expect(monotoneCubic([{ x: 0, y: 42 }])(0.9)).toBe(42);
  });

  it('sampleCurve includes original nodes and is ordered', () => {
    const nodes = [
      { x: 0, y: 0 },
      { x: 0.5, y: 50 },
      { x: 1, y: 100 },
    ];
    const curve = sampleCurve(nodes, 20);
    for (const n of nodes) {
      const hit = curve.find((c) => Math.abs(c.x - n.x) < 1e-9);
      expect(hit).toBeDefined();
      expect(hit!.y).toBeCloseTo(n.y, 6);
    }
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].x).toBeGreaterThan(curve[i - 1].x);
    }
  });
});
