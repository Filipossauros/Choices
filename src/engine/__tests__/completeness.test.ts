/**
 * An option that has not been scored on every criterion must not be scored at
 * all.
 *
 * The additive model divides by the total weight it actually applied, so
 * skipping an unanswered criterion silently renormalises the remaining weights:
 * an option missing its heaviest criterion gets measured on a lighter model than
 * its peers, and the two numbers land in the same ranking as if they meant the
 * same thing. In the app this put a proposal with one of five criteria answered
 * at the top of the list, on 100.0, badged "Recomendado".
 *
 * These tests pin the rule and its two deliberate exceptions: structural
 * exclusions (a factor that can never hold a value) still renormalise, because
 * they apply identically to every option; and a triggered veto still rejects,
 * because it is decisive on its own evidence.
 */
import { describe, it, expect } from 'vitest';
import { aggregate, treeValue } from '../aggregation';
import { computeSensitivity } from '../sensitivity';
import type {
  Evaluation, EvaluationModel, QualificationCriterion, GateCriterion,
  CompositeCriterion, DerivedScale, Weights, Performance,
} from '../../domain/types';
import { ROOT_ID } from '../../domain/types';

/** Two-level criterion: Bom = 100, Neutro = 0, so scores need no LP. */
const qual = (id: string): QualificationCriterion => ({
  id, label: id, type: 'qualification',
  descriptor: {
    levels: [{ id: `${id}_g`, label: 'Bom' }, { id: `${id}_n`, label: 'Neutro' }],
    neutralIndex: 1, goodIndex: 0,
  },
});
const scaleOf = (id: string): DerivedScale => ({
  criterionId: id, consistencyMargin: 1, derivedAt: '',
  values: [
    { levelId: `${id}_g`, value: 100, admissibleRange: [100, 100] },
    { levelId: `${id}_n`, value: 0, admissibleRange: [0, 0] },
  ],
});
const weightsOf = (entries: [string, number][]): Weights => ({
  consistencyMargin: 1, derivedAt: '',
  weights: entries.map(([criterionId, weight]) => ({ criterionId, weight, admissibleRange: [0, 1] as [number, number] })),
});

/** Flat model: a (0.7), b (0.3), plus an optional gate. */
function flatModel(withGate = false): EvaluationModel {
  const criteria: EvaluationModel['valueTree']['criteria'] = { a: qual('a'), b: qual('b') };
  const children = [{ criterionId: 'a', children: [] }, { criterionId: 'b', children: [] }];
  if (withGate) {
    criteria.g = { id: 'g', label: 'g', type: 'gate' } as GateCriterion;
    children.push({ criterionId: 'g', children: [] });
  }
  return {
    kind: 'model', id: 'm', modelVersion: '3', label: 'm', createdAt: '', updatedAt: '',
    valueTree: { root: { criterionId: ROOT_ID, children }, criteria },
    judgmentMatrices: [],
    derivedScales: [scaleOf('a'), scaleOf('b')],
    weights: weightsOf([['a', 0.7], ['b', 0.3]]),
    decisionScale: [
      { id: 'hi', label: 'Recomendado', minScore: 50, color: '#0a0' },
      { id: 'lo', label: 'Não', minScore: 0, color: '#a00' },
    ],
  };
}

function evaluationOf(model: EvaluationModel, performances: Performance[], optionIds = ['p1']): Evaluation {
  return {
    kind: 'evaluation', id: 'e', modelVersion: '3', label: 'e', createdAt: '', updatedAt: '', model,
    options: optionIds.map((id) => ({ id, label: id, createdAt: '' })),
    performances,
  };
}

describe('incomplete options', () => {
  it('has no global value when a criterion is unanswered', () => {
    // Only b (weight 0.3) answered, at Bom. The old behaviour renormalised over
    // b alone and reported a perfect 100.
    const r = aggregate(evaluationOf(flatModel(), [{ optionId: 'p1', criterionId: 'b', value: 'b_g' }]));
    expect(r.optionResults[0].globalValue).toBeNull();
    expect(r.optionResults[0].bandId).toBeNull();
    expect(r.optionResults[0].missingCriteria).toEqual(['a']);
    expect(r.optionResults[0].hardRejected).toBe(false);
  });

  it('lists every unanswered criterion, not just the first', () => {
    const model = flatModel();
    model.valueTree.criteria.c = qual('c');
    model.valueTree.root.children.push({ criterionId: 'c', children: [] });
    model.derivedScales.push(scaleOf('c'));
    model.weights = weightsOf([['a', 0.5], ['b', 0.3], ['c', 0.2]]);
    const r = aggregate(evaluationOf(model, [{ optionId: 'p1', criterionId: 'b', value: 'b_g' }]));
    expect(r.optionResults[0].missingCriteria?.sort()).toEqual(['a', 'c']);
  });

  it('keeps the scores it does have, so the gap is visible per criterion', () => {
    const r = aggregate(evaluationOf(flatModel(), [{ optionId: 'p1', criterionId: 'b', value: 'b_g' }]));
    expect(r.optionResults[0].criterionScores.b).toBe(100);
    expect(r.optionResults[0].criterionScores.a).toBeNull();
  });

  it('scores normally once every criterion is answered', () => {
    const r = aggregate(evaluationOf(flatModel(), [
      { optionId: 'p1', criterionId: 'a', value: 'a_g' },
      { optionId: 'p1', criterionId: 'b', value: 'b_n' },
    ]));
    expect(r.optionResults[0].globalValue).toBe(70);
    expect(r.optionResults[0].missingCriteria).toBeUndefined();
  });

  it('propagates incompleteness up through a composite factor', () => {
    const model = flatModel();
    model.valueTree.criteria.f = { id: 'f', label: 'f', type: 'composite' } as CompositeCriterion;
    model.valueTree.criteria.a1 = qual('a1');
    model.valueTree.criteria.a2 = qual('a2');
    model.valueTree.root.children = [
      { criterionId: 'f', children: [{ criterionId: 'a1', children: [] }, { criterionId: 'a2', children: [] }] },
      { criterionId: 'b', children: [] },
    ];
    delete model.valueTree.criteria.a;
    model.derivedScales = [scaleOf('a1'), scaleOf('a2'), scaleOf('b')];
    model.weights = weightsOf([['f', 0.6], ['b', 0.4]]);
    model.subWeights = { f: weightsOf([['a1', 0.5], ['a2', 0.5]]) };
    const r = aggregate(evaluationOf(model, [
      { optionId: 'p1', criterionId: 'a1', value: 'a1_g' },
      { optionId: 'p1', criterionId: 'b', value: 'b_g' },
    ]));
    expect(r.optionResults[0].globalValue).toBeNull();
    expect(r.optionResults[0].missingCriteria).toEqual(['a2']);
    expect(r.optionResults[0].criterionScores.f).toBeNull(); // the factor too
  });

  it('still renormalises over structure: a gate-only factor absorbs no weight', () => {
    // "Conformidade" holds nothing scorable, so it cannot contribute a value.
    // Excluding it is safe precisely because it happens for every option alike.
    const model = flatModel();
    model.valueTree.criteria.f = { id: 'f', label: 'f', type: 'composite' } as CompositeCriterion;
    model.valueTree.criteria.g = { id: 'g', label: 'g', type: 'gate' } as GateCriterion;
    model.valueTree.root.children = [
      { criterionId: 'a', children: [] },
      { criterionId: 'b', children: [] },
      { criterionId: 'f', children: [{ criterionId: 'g', children: [] }] },
    ];
    model.weights = weightsOf([['a', 0.5], ['b', 0.2], ['f', 0.3]]);
    const r = aggregate(evaluationOf(model, [
      { optionId: 'p1', criterionId: 'a', value: 'a_g' },
      { optionId: 'p1', criterionId: 'b', value: 'b_n' },
      { optionId: 'p1', criterionId: 'g', value: 'pass' },
    ]));
    // a and b renormalise to 0.5/0.7 and 0.2/0.7 → 71.43, not null.
    expect(r.optionResults[0].globalValue).toBeCloseTo(71.43, 1);
    expect(r.optionResults[0].missingCriteria).toBeUndefined();
  });

  it('a failed gate still rejects before completeness is considered', () => {
    const r = aggregate(evaluationOf(flatModel(true), [{ optionId: 'p1', criterionId: 'g', value: 'fail' }]));
    expect(r.optionResults[0].hardRejected).toBe(true);
    expect(r.optionResults[0].rejectedByGate).toBe('g');
    expect(r.optionResults[0].missingCriteria).toBeUndefined();
  });

  it('a triggered veto still rejects even with other criteria unanswered', () => {
    const model = flatModel();
    (model.valueTree.criteria.b as QualificationCriterion).vetoLevelId = 'b_g';
    const r = aggregate(evaluationOf(model, [{ optionId: 'p1', criterionId: 'b', value: 'b_n' }]));
    expect(r.optionResults[0].hardRejected).toBe(true);
    expect(r.optionResults[0].vetoedByCriterion).toBe('b');
  });

  it('treeValue reports the missing leaves directly', () => {
    const { global, missing } = treeValue(flatModel(), (id) => (id === 'b' ? 100 : null));
    expect(global).toBeNull();
    expect(missing).toEqual(['a']);
  });
});

describe('sensitivity excludes options that hold no score', () => {
  const model = flatModel(true);

  it('omits a gate-rejected option instead of charting it at zero', () => {
    const ev = evaluationOf(model, [
      { optionId: 'p1', criterionId: 'a', value: 'a_g' }, { optionId: 'p1', criterionId: 'b', value: 'b_g' },
      { optionId: 'p1', criterionId: 'g', value: 'pass' },
      { optionId: 'p2', criterionId: 'a', value: 'a_n' }, { optionId: 'p2', criterionId: 'b', value: 'b_n' },
      { optionId: 'p2', criterionId: 'g', value: 'fail' },
    ], ['p1', 'p2']);
    const s = computeSensitivity(ev, 'a');
    expect(Object.keys(s.points[0].optionValues)).toEqual(['p1']);
  });

  it('omits an incomplete option too', () => {
    const ev = evaluationOf(model, [
      { optionId: 'p1', criterionId: 'a', value: 'a_g' }, { optionId: 'p1', criterionId: 'b', value: 'b_g' },
      { optionId: 'p2', criterionId: 'b', value: 'b_n' },
    ], ['p1', 'p2']);
    const s = computeSensitivity(ev, 'a');
    expect(Object.keys(s.points[0].optionValues)).toEqual(['p1']);
  });

  it('reports no phantom ranking change when only one option is scorable', () => {
    const ev = evaluationOf(model, [
      { optionId: 'p1', criterionId: 'a', value: 'a_g' }, { optionId: 'p1', criterionId: 'b', value: 'b_n' },
      { optionId: 'p2', criterionId: 'g', value: 'fail' },
    ], ['p1', 'p2']);
    expect(computeSensitivity(ev, 'a').rankingChangePoints).toEqual([]);
  });
});
