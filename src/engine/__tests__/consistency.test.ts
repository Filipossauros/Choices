/**
 * MACBETH consistency engine — unit tests including M-MACBETH reference cases.
 *
 * Reference: Bana e Costa & Vansnick (1994), De Corte & Vansnick (2002).
 *
 * Key property: the LP returns z* > 0 iff the judgment set is consistent.
 * For inconsistent matrices, the engine must identify conflicting pairs
 * and suggest a correction that, when applied, restores consistency.
 */

import { describe, it, expect } from 'vitest';
import { checkConsistency, type JudgmentEntry } from '../consistency';

// ─── Helpers ────────────────────────────────────────────────────────────────

function exact(cat: 0 | 1 | 2 | 3 | 4 | 5 | 6): JudgmentEntry['judgment'] {
  return { kind: 'exact', category: cat };
}

// ─── Reference case 1: 3-level consistent matrix (M-MACBETH example) ────────
// A > B > C with judgments that are cardinally consistent.
//   A-B: moderate (3), A-C: strong (4), B-C: weak (2)
// Expected: consistent, because 4 > 3 > 2 and differences are compatible
// with ordering: diff(A,C) > diff(A,B) > diff(B,C).
describe('Reference case 1 — 3-level consistent matrix', () => {
  const entries: JudgmentEntry[] = [
    { idA: 'A', idB: 'B', judgment: exact(3) },
    { idA: 'A', idB: 'C', judgment: exact(4) },
    { idA: 'B', idB: 'C', judgment: exact(2) },
  ];

  it('reports consistent', async () => {
    const report = await checkConsistency(['A', 'B', 'C'], entries);
    expect(report.isConsistent).toBe(true);
    expect(report.consistencyMargin).toBeGreaterThan(0);
    expect(report.inconsistentPairs).toHaveLength(0);
  });
});

// ─── Reference case 2: inconsistent matrix (transitivity violation) ──────────
// A > B > C with:
//   A-B: strong (4), B-C: strong (4), A-C: weak (2)
// Inconsistent because v(A)-v(C) must be > v(A)-v(B) AND > v(B)-v(C),
// so A-C should be at least "very strong" (5), not weak (2).
describe('Reference case 2 — inconsistent matrix (transitivity violation)', () => {
  const entries: JudgmentEntry[] = [
    { idA: 'A', idB: 'B', judgment: exact(4) },
    { idA: 'B', idB: 'C', judgment: exact(4) },
    { idA: 'A', idB: 'C', judgment: exact(2) },
  ];

  it('reports inconsistent', async () => {
    const report = await checkConsistency(['A', 'B', 'C'], entries);
    expect(report.isConsistent).toBe(false);
  });

  it('identifies conflicting pairs', async () => {
    const report = await checkConsistency(['A', 'B', 'C'], entries);
    expect(report.inconsistentPairs.length).toBeGreaterThan(0);
  });

  it('suggests a correction that restores consistency', async () => {
    const report = await checkConsistency(['A', 'B', 'C'], entries);
    expect(report.inconsistentPairs.length).toBeGreaterThan(0);

    for (const pair of report.inconsistentPairs) {
      const corrected = entries.map((e) =>
        e.idA === pair.idA && e.idB === pair.idB
          ? { ...e, judgment: pair.suggestedJudgment }
          : e,
      );
      const correctedReport = await checkConsistency(['A', 'B', 'C'], corrected);
      expect(correctedReport.isConsistent).toBe(true);
    }
  });
});

// ─── Reference case 3: category 0 (equal attractiveness) ────────────────────
// A ≈ B (no difference) but both clearly better than C.
describe('Reference case 3 — category 0 (equal attractiveness)', () => {
  const entries: JudgmentEntry[] = [
    { idA: 'A', idB: 'B', judgment: exact(0) },
    { idA: 'A', idB: 'C', judgment: exact(3) },
    { idA: 'B', idB: 'C', judgment: exact(3) },
  ];

  it('is consistent', async () => {
    const report = await checkConsistency(['A', 'B', 'C'], entries);
    expect(report.isConsistent).toBe(true);
  });
});

// ─── Reference case 4: interval judgment ────────────────────────────────────
// "weak to moderate" is represented as { lo: 2, hi: 3 }.
describe('Reference case 4 — interval judgment', () => {
  const entries: JudgmentEntry[] = [
    { idA: 'A', idB: 'B', judgment: { kind: 'interval', lo: 2, hi: 3 } },
    { idA: 'A', idB: 'C', judgment: exact(5) },
    { idA: 'B', idB: 'C', judgment: exact(3) },
  ];

  it('accepts consistent interval judgments', async () => {
    const report = await checkConsistency(['A', 'B', 'C'], entries);
    expect(report.isConsistent).toBe(true);
  });
});

// ─── Reference case 5: 4-level consistent matrix ────────────────────────────
// A > B > C > D with all-consistent judgments (monotone in categories).
describe('Reference case 5 — 4-level consistent matrix', () => {
  const entries: JudgmentEntry[] = [
    { idA: 'A', idB: 'B', judgment: exact(2) },
    { idA: 'A', idB: 'C', judgment: exact(4) },
    { idA: 'A', idB: 'D', judgment: exact(6) },
    { idA: 'B', idB: 'C', judgment: exact(3) },
    { idA: 'B', idB: 'D', judgment: exact(5) },
    { idA: 'C', idB: 'D', judgment: exact(3) },
  ];

  it('is consistent', async () => {
    const report = await checkConsistency(['A', 'B', 'C', 'D'], entries);
    expect(report.isConsistent).toBe(true);
    expect(report.consistencyMargin).toBeGreaterThan(0);
  });
});

// ─── Reference case 6: single pair ──────────────────────────────────────────
describe('Reference case 6 — single pair', () => {
  it('is always consistent', async () => {
    const entries: JudgmentEntry[] = [
      { idA: 'A', idB: 'B', judgment: exact(4) },
    ];
    const report = await checkConsistency(['A', 'B'], entries);
    expect(report.isConsistent).toBe(true);
  });
});

// ─── Reference case 7: empty judgment set ────────────────────────────────────
describe('Reference case 7 — empty judgment set', () => {
  it('is trivially consistent', async () => {
    const report = await checkConsistency(['A', 'B', 'C'], []);
    expect(report.isConsistent).toBe(true);
  });
});

// ─── Reference case 8: extreme categories at boundaries ──────────────────────
describe('Reference case 8 — extreme category (C6)', () => {
  it('handles extreme category correctly', async () => {
    const entries: JudgmentEntry[] = [
      { idA: 'A', idB: 'B', judgment: exact(6) },
      { idA: 'A', idB: 'C', judgment: exact(6) },
      { idA: 'B', idB: 'C', judgment: exact(1) },
    ];
    const report = await checkConsistency(['A', 'B', 'C'], entries);
    expect(report.isConsistent).toBe(true);
  });
});
