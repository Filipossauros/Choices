/**
 * A continuous performance is read off the value curve at a position along the
 * descriptor — so what that position *measures* has to be a real quantity.
 *
 * Spacing the levels evenly by index assumes every step is the same size. For
 * "≤ 2 dias / 3–5 / 6–10 / > 10" that is false, and a position half-way between
 * the last two levels corresponds to no particular number of days: the PCHIP
 * curve was interpolating smoothly over a geometry that had been invented.
 * When every level carries a `numericValue`, the descriptor's own axis is used.
 */
import { describe, it, expect } from 'vitest';
import {
  hasNumericAxis, levelPosition, numericPosition, positionToNumeric,
  nearestLevelId, scoreAtPosition,
} from '../scaling';
import type { Descriptor, DerivedScale } from '../../domain/types';

/** Response time: lower is better, and the steps are wildly uneven. */
const latency = (): Descriptor => ({
  levels: [
    { id: 'fast', label: '≤ 100 ms', numericValue: 100 },
    { id: 'mid', label: '200 ms', numericValue: 200 },
    { id: 'slow', label: '1000 ms', numericValue: 1000 },
  ],
  neutralIndex: 1,
  goodIndex: 0,
  unit: 'ms',
});

/** Same shape, no numbers — the index fallback must still work. */
const labelled = (): Descriptor => ({
  levels: [{ id: 'a', label: 'Alto' }, { id: 'b', label: 'Médio' }, { id: 'c', label: 'Baixo' }],
  neutralIndex: 1,
  goodIndex: 0,
});

describe('numeric axis detection', () => {
  it('needs a reading on every level, not just some', () => {
    expect(hasNumericAxis(latency())).toBe(true);
    expect(hasNumericAxis(labelled())).toBe(false);
    const partial = latency();
    delete partial.levels[1].numericValue;
    expect(hasNumericAxis(partial)).toBe(false);
  });

  it('rejects a degenerate axis where every level reads the same', () => {
    const flat: Descriptor = {
      levels: [{ id: 'a', label: 'a', numericValue: 5 }, { id: 'b', label: 'b', numericValue: 5 }],
      neutralIndex: 1, goodIndex: 0,
    };
    expect(numericPosition(flat, 5)).toBeNull();
    // …and falls back to index spacing rather than dividing by zero.
    expect(levelPosition(flat, 'a')).toBe(1);
  });
});

describe('positions follow the measurement axis', () => {
  it('spaces levels by their readings, not by their index', () => {
    const d = latency();
    // By index the middle level would sit at 0.5. By milliseconds it sits much
    // closer to the fast end, which is where 200 ms actually is between 100 and 1000.
    expect(levelPosition(d, 'mid')).toBeCloseTo(1 - (200 - 100) / 900, 6);
    expect(levelPosition(d, 'mid')).toBeGreaterThan(0.85);
    expect(levelPosition(d, 'fast')).toBe(1);
    expect(levelPosition(d, 'slow')).toBe(0);
  });

  it('falls back to even index spacing without readings', () => {
    const d = labelled();
    expect(levelPosition(d, 'a')).toBe(1);
    expect(levelPosition(d, 'b')).toBe(0.5);
    expect(levelPosition(d, 'c')).toBe(0);
  });

  it('orients itself from the descriptor, so lower-is-better still runs best → worst', () => {
    const d = latency(); // decreasing attractiveness = increasing ms
    expect(numericPosition(d, 100)).toBe(1);
    expect(numericPosition(d, 1000)).toBe(0);
    // A criterion where higher is better must come out the other way round.
    const uptime: Descriptor = {
      levels: [
        { id: 'hi', label: '99.9%', numericValue: 99.9 },
        { id: 'lo', label: '95%', numericValue: 95 },
      ],
      neutralIndex: 1, goodIndex: 0,
    };
    expect(numericPosition(uptime, 99.9)).toBe(1);
    expect(numericPosition(uptime, 95)).toBe(0);
  });

  it('clamps readings outside the declared range', () => {
    const d = latency();
    expect(numericPosition(d, 10)).toBe(1);
    expect(numericPosition(d, 99999)).toBe(0);
  });

  it('round-trips a reading through its position', () => {
    const d = latency();
    for (const ms of [100, 250, 640, 1000]) {
      expect(positionToNumeric(d, numericPosition(d, ms)!)).toBeCloseTo(ms, 6);
    }
  });
});

describe('scoring against the numeric axis', () => {
  const scale: DerivedScale = {
    criterionId: 'c', consistencyMargin: 5, derivedAt: '',
    values: [
      { levelId: 'fast', value: 100, admissibleRange: [100, 100] },
      { levelId: 'mid', value: 0, admissibleRange: [0, 0] },
      { levelId: 'slow', value: -80, admissibleRange: [-80, -80] },
    ],
  };

  it('reads the anchors back exactly', () => {
    const d = latency();
    expect(scoreAtPosition(d, scale, numericPosition(d, 100)!)).toBe(100);
    expect(scoreAtPosition(d, scale, numericPosition(d, 200)!)).toBe(0);
    expect(scoreAtPosition(d, scale, numericPosition(d, 1000)!)).toBe(-80);
  });

  /**
   * The defining property: equal spans of the measured quantity take equal spans
   * of the axis. Index spacing breaks it — it gives 100→200 ms (a 100 ms gap)
   * the same half of the axis as 200→1000 ms (an 800 ms gap), which is what made
   * every position between two levels meaningless.
   */
  it('gives equal spans of the quantity equal spans of the axis', () => {
    const d = latency();
    const at = (ms: number) => numericPosition(d, ms)!;
    expect(at(100) - at(200)).toBeCloseTo(at(200) - at(300), 9);
    expect(at(200) - at(300)).toBeCloseTo(at(800) - at(900), 9);

    const indexAxis: Descriptor = { ...d, levels: d.levels.map((l) => ({ id: l.id, label: l.label })) };
    // Same three levels, no readings: the first 100 ms now occupy half the axis.
    expect(levelPosition(indexAxis, 'fast') - levelPosition(indexAxis, 'mid')).toBeCloseTo(0.5, 9);
    expect(levelPosition(d, 'fast') - levelPosition(d, 'mid')).toBeCloseTo(100 / 900, 9);
  });

  it('keeps a 300 ms reading just below Neutro rather than a quarter of the way down', () => {
    const d = latency();
    const v = scoreAtPosition(d, scale, numericPosition(d, 300)!);
    // One eighth of the way from 200 ms (Neutro, 0) to 1000 ms (−80): below
    // Neutro, but nowhere near the bottom. (Not a linear −10: the monotone
    // curve is steep just under a node, which is legitimate — it still passes
    // exactly through every derived value.)
    expect(v).toBeLessThan(0);
    expect(v).toBeGreaterThan(-80 / 2);
  });

  it('stays monotone across the whole axis', () => {
    const d = latency();
    let prev = Infinity;
    for (let ms = 100; ms <= 1000; ms += 50) {
      const v = scoreAtPosition(d, scale, numericPosition(d, ms)!);
      expect(v).toBeLessThanOrEqual(prev + 1e-9);
      prev = v;
    }
  });

  it('names the nearest level for a reading', () => {
    const d = latency();
    expect(nearestLevelId(d, numericPosition(d, 110)!)).toBe('fast');
    expect(nearestLevelId(d, numericPosition(d, 210)!)).toBe('mid');
    expect(nearestLevelId(d, numericPosition(d, 950)!)).toBe('slow');
  });
});
