/**
 * Regression tests for the LP/profile fixes:
 *  - interval judgments: hi respected, {lo:0} no longer collapsed to equality
 *  - all-C0 matrices solve as consistent (bounded z) instead of unbounded
 *  - all-equal weighting yields 1/n instead of zero weights
 *  - admissible ranges computed at z = z* (no degenerate judgment-violating spans)
 *  - partial scale matrices stay bounded (no garbage values)
 *  - resolveBands treats dead level ids as incomplete (falls back to cache)
 *  - bandOrderConflicts flags profile-induced order inversions
 *  - pending gates mark the classification as provisional
 */
import { describe, it, expect } from 'vitest';
import { checkConsistency, type JudgmentEntry } from '../consistency';
import { deriveScale } from '../scaling';
import { deriveWeights } from '../weighting';
import { aggregate, resolveBands, bandOrderConflicts } from '../aggregation';
import type {
  Descriptor,
  Evaluation,
  EvaluationModel,
  JudgmentMatrix,
  MacbethJudgment,
  ValueTree,
} from '../../domain/types';
import { MODEL_VERSION } from '../../domain/types';

const exact = (category: 0 | 1 | 2 | 3 | 4 | 5 | 6): MacbethJudgment => ({ kind: 'exact', category });
const interval = (lo: 0 | 1 | 2 | 3 | 4 | 5 | 6, hi: 0 | 1 | 2 | 3 | 4 | 5 | 6): MacbethJudgment => ({
  kind: 'interval',
  lo,
  hi,
});

// ── Consistency: interval semantics ─────────────────────────────────────────

describe('consistency — interval judgments', () => {
  it('respects the hi bound: A-B=5, B-C=1, A-C∈[2,6] is consistent', async () => {
    // Additivity forces d(A,C) = d(A,B) + d(B,C) > d(A,B); the interval admits
    // category 6, so the matrix is consistent. Treating the interval as
    // exact(2) (the old bug) would demand d(A,B) > d(A,C) — a contradiction.
    const entries: JudgmentEntry[] = [
      { idA: 'A', idB: 'B', judgment: exact(5) },
      { idA: 'B', idB: 'C', judgment: exact(1) },
      { idA: 'A', idB: 'C', judgment: interval(2, 6) },
    ];
    const report = await checkConsistency(['A', 'B', 'C'], entries);
    expect(report.isConsistent).toBe(true);
  });

  it('does not collapse {lo:0} to equality: A-B∈[0,2], A-C=3, B-C=1 is consistent', async () => {
    // d(A,B) may sit anywhere in categories 0–2; the cardinal pair A-C(3) vs
    // B-C(1) requires d(A,C) > d(B,C), satisfiable with d(A,B) > 0. The old
    // code forced v[A] = v[B] and reported inconsistency.
    const entries: JudgmentEntry[] = [
      { idA: 'A', idB: 'B', judgment: interval(0, 2) },
      { idA: 'A', idB: 'C', judgment: exact(3) },
      { idA: 'B', idB: 'C', judgment: exact(1) },
    ];
    const report = await checkConsistency(['A', 'B', 'C'], entries);
    expect(report.isConsistent).toBe(true);
  });

  it('overlapping intervals impose no ordering: A-B∈[1,3], A-C∈[2,4] is consistent either way', async () => {
    const entries: JudgmentEntry[] = [
      { idA: 'A', idB: 'B', judgment: interval(1, 3) },
      { idA: 'B', idB: 'C', judgment: interval(2, 4) },
    ];
    const report = await checkConsistency(['A', 'B', 'C'], entries);
    expect(report.isConsistent).toBe(true);
  });

  it('an all-C0 matrix is trivially consistent (bounded z)', async () => {
    const entries: JudgmentEntry[] = [
      { idA: 'A', idB: 'B', judgment: exact(0) },
      { idA: 'A', idB: 'C', judgment: exact(0) },
      { idA: 'B', idB: 'C', judgment: exact(0) },
    ];
    const report = await checkConsistency(['A', 'B', 'C'], entries);
    expect(report.isConsistent).toBe(true);
    expect(report.consistencyMargin).toBeGreaterThan(0);
  });

  it('still detects a genuine cardinal inconsistency', async () => {
    // d(A,B)=1 and d(B,C)=1 but d(A,C)=6 with only categories to spare: the
    // classic overstretch A-B=1, B-C=1, A-C=6 remains INCONSISTENT? No — it is
    // consistent (6 > 1). Use the canonical cycle instead: A-B=3, B-C=3, A-C=1
    // (sum of two mediums judged small).
    const entries: JudgmentEntry[] = [
      { idA: 'A', idB: 'B', judgment: exact(3) },
      { idA: 'B', idB: 'C', judgment: exact(3) },
      { idA: 'A', idB: 'C', judgment: exact(1) },
    ];
    const report = await checkConsistency(['A', 'B', 'C'], entries);
    expect(report.isConsistent).toBe(false);
  });
});

// ── Scaling: intervals, bounded z, tight ranges ─────────────────────────────

const descriptor3 = (): Descriptor => ({
  levels: [
    { id: 'G', label: 'Good' },
    { id: 'M', label: 'Mid' },
    { id: 'N', label: 'Neutral' },
  ],
  neutralIndex: 2,
  goodIndex: 0,
});

const matrix = (judgments: Record<string, MacbethJudgment>): JudgmentMatrix => ({
  id: 'jm',
  kind: 'scale',
  criterionId: 'c1',
  assessorId: 'a',
  judgments,
  updatedAt: '',
});

describe('scaling — interval and boundedness fixes', () => {
  it('an interval starting at C0 derives without the undeclared s_0 variable', async () => {
    const scale = await deriveScale('c1', descriptor3(), matrix({
      G__M: interval(0, 2),
      M__N: exact(2),
      G__N: exact(3),
    }));
    expect(scale.consistencyMargin).toBeGreaterThan(0);
    const val = (id: string) => scale.values.find((v) => v.levelId === id)!.value;
    expect(val('G')).toBe(100);
    expect(val('N')).toBe(0);
    expect(val('M')).toBeGreaterThanOrEqual(0);
    expect(val('M')).toBeLessThanOrEqual(100);
  });

  it('admissible ranges are computed at z* — no degenerate [0,100] span', async () => {
    // G-M and M-N both C2, G-N C4: symmetric, so at maximum discrimination
    // v(M) is pinned at 50. With z left free (the old bug) the range came back
    // as the judgment-violating [0, 100].
    const scale = await deriveScale('c1', descriptor3(), matrix({
      G__M: exact(2),
      M__N: exact(2),
      G__N: exact(4),
    }));
    expect(scale.consistencyMargin).toBeGreaterThan(0);
    const mid = scale.values.find((v) => v.levelId === 'M')!;
    expect(mid.value).toBe(50);
    const [lo, hi] = mid.admissibleRange;
    expect(lo).toBeGreaterThan(0);
    expect(hi).toBeLessThan(100);
    expect(lo).toBeLessThanOrEqual(mid.value);
    expect(hi).toBeGreaterThanOrEqual(mid.value);
  });

  it('a partial matrix that never chains to the anchors stays bounded and ordered', async () => {
    // Top > Good > Neutral with ONLY Top-Good judged: the old formulation made
    // max-z unbounded, GLPK errored out, and garbage values (Top = 0 < Good)
    // were stored. Now the LP is bounded and the monotone order holds.
    const desc: Descriptor = {
      levels: [
        { id: 'T', label: 'Top' },
        { id: 'G', label: 'Good' },
        { id: 'N', label: 'Neutral' },
      ],
      neutralIndex: 2,
      goodIndex: 1,
    };
    const scale = await deriveScale('c1', desc, matrix({ T__G: exact(2) }));
    expect(scale.consistencyMargin).toBeGreaterThan(0);
    const val = (id: string) => scale.values.find((v) => v.levelId === id)!.value;
    expect(val('G')).toBe(100);
    expect(val('N')).toBe(0);
    expect(val('T')).toBeGreaterThan(val('G'));
  });
});

// ── Weighting: all-equal criteria ────────────────────────────────────────────

describe('weighting — boundedness fixes', () => {
  it('criteria all judged equally important get weights 1/n', async () => {
    const weights = await deriveWeights(['a', 'b', 'c'], {
      a__b: exact(0),
      a__c: exact(0),
      b__c: exact(0),
    });
    expect(weights.consistencyMargin).toBeGreaterThan(0);
    for (const w of weights.weights) {
      expect(w.weight).toBeCloseTo(1 / 3, 2);
    }
  });
});

// ── Decision profiles: integrity, order conflicts, pending gates ────────────

function profileModel(overrides: Partial<EvaluationModel> = {}): EvaluationModel {
  const valueTree: ValueTree = {
    root: { criterionId: 'root', children: [{ criterionId: 'q1', children: [] }] },
    criteria: {
      q1: {
        id: 'q1',
        label: 'Q1',
        type: 'qualification',
        descriptor: {
          levels: [{ id: 'high', label: 'High' }, { id: 'low', label: 'Low' }],
          neutralIndex: 1,
          goodIndex: 0,
        },
      },
    },
  };
  return {
    kind: 'model',
    id: 'm',
    modelVersion: MODEL_VERSION,
    label: 'Test',
    createdAt: '',
    updatedAt: '',
    valueTree,
    judgmentMatrices: [],
    derivedScales: [
      {
        criterionId: 'q1',
        values: [
          { levelId: 'high', value: 100, admissibleRange: [100, 100] },
          { levelId: 'low', value: 0, admissibleRange: [0, 0] },
        ],
        consistencyMargin: 1,
        derivedAt: '',
      },
    ],
    weights: {
      weights: [{ criterionId: 'q1', weight: 1, admissibleRange: [1, 1] }],
      consistencyMargin: 1,
      derivedAt: '',
    },
    decisionScale: [],
    ...overrides,
  };
}

describe('resolveBands — profile integrity', () => {
  it('a profile referencing a dead level id falls back to the cached minScore', () => {
    const m = profileModel({
      decisionScale: [
        { id: 'b1', label: 'Top', minScore: 60, color: '#0f0', referenceProfile: { q1: 'deleted-level' } },
        { id: 'b0', label: 'Base', minScore: 0, color: '#f00' },
      ],
    });
    const resolved = resolveBands(m);
    // Not silently renormalized to some subset score — the cache (60) holds.
    expect(resolved[0].minScore).toBe(60);
  });

  it('a valid profile still derives its cut-off live', () => {
    const m = profileModel({
      decisionScale: [
        { id: 'b1', label: 'Top', minScore: 10, color: '#0f0', referenceProfile: { q1: 'high' } },
        { id: 'b0', label: 'Base', minScore: 0, color: '#f00' },
      ],
    });
    expect(resolveBands(m)[0].minScore).toBe(100);
  });
});

describe('bandOrderConflicts', () => {
  it('flags a nominally higher band whose profile now scores below a lower band', () => {
    // Stored order: b1 (60) above b2 (40). Live resolution sends b1's profile
    // to 0 (level "low") and b2's to 100 (level "high") — inverted.
    const m = profileModel({
      decisionScale: [
        { id: 'b1', label: 'Alta', minScore: 60, color: '#0f0', referenceProfile: { q1: 'low' } },
        { id: 'b2', label: 'Média', minScore: 40, color: '#ff0', referenceProfile: { q1: 'high' } },
        { id: 'b0', label: 'Base', minScore: 0, color: '#f00' },
      ],
    });
    const conflicts = bandOrderConflicts(m);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].higher.id).toBe('b1');
    expect(conflicts[0].lower.id).toBe('b2');
  });

  it('reports nothing when the resolved order matches the stored order', () => {
    const m = profileModel({
      decisionScale: [
        { id: 'b1', label: 'Alta', minScore: 60, color: '#0f0', referenceProfile: { q1: 'high' } },
        { id: 'b0', label: 'Base', minScore: 0, color: '#f00' },
      ],
    });
    expect(bandOrderConflicts(m)).toHaveLength(0);
  });
});

describe('pending gates — provisional classification', () => {
  it('an unanswered gate marks the result with pendingGates', () => {
    const valueTree: ValueTree = {
      root: {
        criterionId: 'root',
        children: [
          { criterionId: 'g1', children: [] },
          { criterionId: 'q1', children: [] },
        ],
      },
      criteria: {
        g1: { id: 'g1', label: 'Gate', type: 'gate' },
        q1: profileModel().valueTree.criteria.q1,
      },
    };
    const m = profileModel({
      valueTree,
      decisionScale: [
        { id: 'top', label: 'Top', minScore: 50, color: '#0f0' },
        { id: 'base', label: 'Base', minScore: 0, color: '#f00' },
      ],
    });
    const e: Evaluation = {
      kind: 'evaluation',
      id: 'e',
      modelVersion: MODEL_VERSION,
      label: 'Eval',
      createdAt: '',
      updatedAt: '',
      model: m,
      options: [{ id: 'p1', label: 'P1', createdAt: '' }],
      // gate g1 left unanswered on purpose
      performances: [{ optionId: 'p1', criterionId: 'q1', value: 'high' }],
    };
    const r = aggregate(e).optionResults[0];
    expect(r.hardRejected).toBe(false);
    expect(r.pendingGates).toEqual(['g1']);
    expect(r.bandId).toBe('top'); // still classified, but flagged provisional
  });

  it('a fully answered gate leaves pendingGates unset', () => {
    const valueTree: ValueTree = {
      root: {
        criterionId: 'root',
        children: [
          { criterionId: 'g1', children: [] },
          { criterionId: 'q1', children: [] },
        ],
      },
      criteria: {
        g1: { id: 'g1', label: 'Gate', type: 'gate' },
        q1: profileModel().valueTree.criteria.q1,
      },
    };
    const m = profileModel({
      valueTree,
      decisionScale: [{ id: 'base', label: 'Base', minScore: 0, color: '#f00' }],
    });
    const e: Evaluation = {
      kind: 'evaluation',
      id: 'e',
      modelVersion: MODEL_VERSION,
      label: 'Eval',
      createdAt: '',
      updatedAt: '',
      model: m,
      options: [{ id: 'p1', label: 'P1', createdAt: '' }],
      performances: [
        { optionId: 'p1', criterionId: 'g1', value: 'pass' },
        { optionId: 'p1', criterionId: 'q1', value: 'high' },
      ],
    };
    const r = aggregate(e).optionResults[0];
    expect(r.pendingGates).toBeUndefined();
  });
});
