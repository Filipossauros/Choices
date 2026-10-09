/**
 * Turning weights into something a person can disagree with.
 *
 * The claims and the showdown exist to be checked by someone who does not read
 * percentages, so what matters is that they are *true of the model* — a wrong
 * sentence here is worse than no sentence, because the respondent would sign it.
 */
import { describe, it, expect } from 'vitest';
import { weightedLeaves, weightClaims, weightShowdown } from '../explain';
import type {
  EvaluationModel, QualificationCriterion, CompositeCriterion, Weights, ValueTreeNode,
} from '../../domain/types';
import { ROOT_ID } from '../../domain/types';

const qual = (id: string): QualificationCriterion => ({
  id, label: id, type: 'qualification',
  descriptor: {
    levels: [{ id: `${id}_g`, label: `${id} bom` }, { id: `${id}_n`, label: `${id} neutro` }],
    neutralIndex: 1, goodIndex: 0,
  },
});

const weightsOf = (entries: [string, number][]): Weights => ({
  consistencyMargin: 1, derivedAt: '',
  weights: entries.map(([criterionId, weight]) => ({ criterionId, weight, admissibleRange: [0, 1] as [number, number] })),
});

const node = (criterionId: string, children: ValueTreeNode[] = []): ValueTreeNode => ({ criterionId, children });

/** a (0.7), b (0.25), c (0.05) under the root. */
function flat(): EvaluationModel {
  return {
    kind: 'model', id: 'm', modelVersion: '3', label: 'm', createdAt: '', updatedAt: '',
    valueTree: {
      root: node(ROOT_ID, [node('a'), node('b'), node('c')]),
      criteria: { a: qual('a'), b: qual('b'), c: qual('c') },
    },
    judgmentMatrices: [],
    derivedScales: [],
    weights: weightsOf([['a', 0.7], ['b', 0.25], ['c', 0.05]]),
    decisionScale: [],
  };
}

/** Root: F (0.6) → {a 0.8, b 0.2}, c (0.4). */
function nested(): EvaluationModel {
  const f: CompositeCriterion = { id: 'F', label: 'F', type: 'composite' };
  return {
    kind: 'model', id: 'm', modelVersion: '3', label: 'm', createdAt: '', updatedAt: '',
    valueTree: {
      root: node(ROOT_ID, [node('F', [node('a'), node('b')]), node('c')]),
      criteria: { F: f, a: qual('a'), b: qual('b'), c: qual('c') },
    },
    judgmentMatrices: [],
    derivedScales: [],
    weights: weightsOf([['F', 0.6], ['c', 0.4]]),
    subWeights: { F: weightsOf([['a', 0.8], ['b', 0.2]]) },
    decisionScale: [],
  } as EvaluationModel;
}

describe('weightedLeaves', () => {
  it('multiplies down the tree and sorts heaviest first', () => {
    const leaves = weightedLeaves(nested());
    expect(leaves.map((l) => l.criterionId)).toEqual(['a', 'c', 'b']);
    expect(leaves[0].weight).toBeCloseTo(0.48, 6); // 0.6 × 0.8
    expect(leaves.reduce((s, l) => s + l.weight, 0)).toBeCloseTo(1, 6);
  });

  it('carries the level names the claim will have to quote', () => {
    const [top] = weightedLeaves(flat());
    expect(top.goodLabel).toBe('a bom');
    expect(top.neutralLabel).toBe('a neutro');
  });
});

describe('weightClaims', () => {
  it('says a criterion dominates only when it outweighs all the others together', () => {
    const dominates = weightClaims(flat()).find((c) => c.kind === 'dominates');
    expect(dominates).toMatchObject({ winner: 'a', winnerPct: 70, othersPct: 30 });

    const even = flat();
    even.weights = weightsOf([['a', 0.4], ['b', 0.35], ['c', 0.25]]);
    expect(weightClaims(even).some((c) => c.kind === 'dominates')).toBe(false);
  });

  it('falls back to a ratio when nothing dominates', () => {
    const m = flat();
    m.weights = weightsOf([['a', 0.45], ['b', 0.3], ['c', 0.25]]);
    const ratio = weightClaims(m).find((c) => c.kind === 'ratio');
    expect(ratio).toMatchObject({ a: 'a', b: 'b', times: 1.5 });
  });

  it('flags the leaf that barely counts, and only that one', () => {
    const negligible = weightClaims(flat()).filter((c) => c.kind === 'negligible');
    expect(negligible).toHaveLength(1);
    expect(negligible[0]).toMatchObject({ label: 'c', pct: 5 });
  });

  it('states where a proposal lands when it misses only the heaviest criterion', () => {
    // Bom everywhere but `a` ⟹ 100 × (1 − 0.7) = 30.
    const ceiling = weightClaims(flat()).find((c) => c.kind === 'ceiling');
    expect(ceiling).toMatchObject({ label: 'a', score: 30 });
  });

  it('claims nothing about a model with no weights', () => {
    const m = flat();
    delete (m as { weights?: Weights }).weights;
    expect(weightClaims(m)).toEqual([]);
  });

  it('reads the inner group of a nested model, naming it', () => {
    const inner = weightClaims(nested()).find((c) => (c.kind === 'dominates' || c.kind === 'ratio') && c.groupId === 'F');
    expect(inner).toMatchObject({ kind: 'dominates', groupLabel: 'F', winner: 'a' });
  });
});

describe('weightShowdown', () => {
  it('pits the heaviest criterion against every other one, scored on the swing anchors', () => {
    const s = weightShowdown(flat())!;
    expect(s.solo.criterionId).toBe('a');
    expect(s.rest.map((l) => l.criterionId)).toEqual(['b', 'c']);
    // Bom on `a` alone = 70; Bom on everything else = 30.
    expect(s.soloScore).toBeCloseTo(70, 5);
    expect(s.restScore).toBeCloseTo(30, 5);
    expect(s.winner).toBe('solo');
    expect(s.soloScore + s.restScore).toBeCloseTo(100, 5);
  });

  it('lets the rest win when no single criterion carries the model', () => {
    const m = flat();
    m.weights = weightsOf([['a', 0.4], ['b', 0.35], ['c', 0.25]]);
    expect(weightShowdown(m)!.winner).toBe('rest');
  });

  it('calls it a tie at 50/50, where the test would prove nothing', () => {
    const m = flat();
    m.weights = weightsOf([['a', 0.5], ['b', 0.3], ['c', 0.2]]);
    expect(weightShowdown(m)!.winner).toBe('tie');
  });

  it('has nothing to show with fewer than two scoring criteria', () => {
    const m = flat();
    m.valueTree = { root: node(ROOT_ID, [node('a')]), criteria: { a: qual('a') } };
    m.weights = weightsOf([['a', 1]]);
    expect(weightShowdown(m)).toBeNull();
  });
});
