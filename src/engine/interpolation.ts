/**
 * Smooth, shape-preserving interpolation of a derived value scale.
 *
 * MACBETH produces a cardinal value at each *discrete* descriptor level. To let
 * proposals take *continuous* performances (a position between two levels) we
 * need a value function defined for every position in between. A naive
 * piecewise-linear join shows visible "kinks" at each level; instead we use a
 * monotone cubic (PCHIP / Fritsch–Carlson) interpolant:
 *
 *   - passes *through* every derived point (anchors Neutro=0 / Bom=100 stay exact),
 *   - is C¹-smooth (no perceptible cut points),
 *   - is monotone and free of overshoot between points.
 *
 * This is an interpolation (through the points), NOT a regression (near them):
 * the LP-derived values are preserved exactly, so consistency is not disturbed.
 */

export interface SplinePoint {
  x: number;
  y: number;
}

/**
 * Build a monotone cubic Hermite interpolant through `points` (sorted ascending
 * by x). Returns f(x); outside [x₀, xₙ] the value is clamped to the endpoints.
 */
export function monotoneCubic(points: SplinePoint[]): (x: number) => number {
  const pts = [...points].sort((a, b) => a.x - b.x);
  const n = pts.length;
  if (n === 0) return () => 0;
  if (n === 1) return () => pts[0].y;

  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);

  // Secant slopes of each interval
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const h = xs[i + 1] - xs[i];
    dx.push(h);
    slope.push(h !== 0 ? (ys[i + 1] - ys[i]) / h : 0);
  }

  // Tangents (Fritsch–Carlson): zero at local extrema, weighted harmonic mean
  // elsewhere — this is what guarantees monotonicity without overshoot.
  const m: number[] = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      m[i] = 0;
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      m[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
  }

  return (x: number): number => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    // Locate the interval containing x
    let i = 0;
    while (i < n - 1 && x > xs[i + 1]) i++;
    const h = dx[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    // Hermite basis
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1];
  };
}

/**
 * Sample the interpolant at `samples` evenly-spaced points across [x₀, xₙ],
 * useful for drawing a smooth curve. Always includes the original node x's so
 * the curve visibly passes through them.
 */
export function sampleCurve(
  points: SplinePoint[],
  samples = 60,
): SplinePoint[] {
  const pts = [...points].sort((a, b) => a.x - b.x);
  if (pts.length < 2) return pts;
  const f = monotoneCubic(pts);
  const x0 = pts[0].x;
  const x1 = pts[pts.length - 1].x;
  const xsSet = new Set<number>(pts.map((p) => p.x));
  for (let i = 0; i <= samples; i++) {
    xsSet.add(x0 + ((x1 - x0) * i) / samples);
  }
  return [...xsSet].sort((a, b) => a - b).map((x) => ({ x, y: f(x) }));
}
