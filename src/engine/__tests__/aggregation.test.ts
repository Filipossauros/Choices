import { describe, it, expect } from 'vitest';
import { aggregate } from '../aggregation';
import type { Evaluation, EvaluationModel, ValueTree, DecisionBand } from '../../domain/types';
import { MODEL_VERSION } from '../../domain/types';

const SCALE: DecisionBand[] = [
  { id: 'approved', label: 'Recomendado', minScore: 70, color: '#16a34a' },
  { id: 'conditional', label: 'Com reservas', minScore: 40, color: '#d97706' },
  { id: 'rejected', label: 'Não recomendado', minScore: 0, color: '#dc2626' },
];

function model(overrides: Partial<EvaluationModel> = {}): EvaluationModel {
  return {
    kind: 'model',
    id: 'm',
    modelVersion: MODEL_VERSION,
    label: 'Test',
    createdAt: '',
    updatedAt: '',
    valueTree: { root: { criterionId: 'root', children: [] }, criteria: {} },
    judgmentMatrices: [],
    derivedScales: [],
    decisionScale: SCALE,
    ...overrides,
  };
}

function evaluation(m: EvaluationModel, overrides: Partial<Evaluation> = {}): Evaluation {
  return {
    kind: 'evaluation',
    id: 'e',
    modelVersion: MODEL_VERSION,
    label: 'Eval',
    createdAt: '',
    updatedAt: '',
    model: m,
    options: [],
    performances: [],
    ...overrides,
  };
}

describe('Two-tier aggregation', () => {
  it('Tier 1 — gate failure vetos before scoring', () => {
    const valueTree: ValueTree = {
      root: { criterionId: 'root', children: [{ criterionId: 'g1', children: [] }] },
      criteria: { g1: { id: 'g1', label: 'Gate 1', type: 'gate' } },
    };
    const result = aggregate(
      evaluation(model({ valueTree }), {
        options: [{ id: 'p1', label: 'P1', createdAt: '' }],
        performances: [{ optionId: 'p1', criterionId: 'g1', value: 'fail' }],
      }),
    );
    const r = result.optionResults[0];
    expect(r.hardRejected).toBe(true);
    expect(r.globalValue).toBeNull();
    expect(r.rejectedByGate).toBe('g1');
  });

  it('Tier 1 — gate pass allows scoring', () => {
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
        q1: {
          id: 'q1',
          label: 'Quality',
          type: 'qualification',
          descriptor: {
            levels: [{ id: 'high', label: 'High' }, { id: 'low', label: 'Low' }],
            neutralIndex: 1,
            goodIndex: 0,
          },
        },
      },
    };
    const result = aggregate(
      evaluation(
        model({
          valueTree,
          derivedScales: [{
            criterionId: 'q1',
            values: [
              { levelId: 'high', value: 100, admissibleRange: [100, 100] },
              { levelId: 'low', value: 0, admissibleRange: [0, 0] },
            ],
            consistencyMargin: 1,
            derivedAt: '',
          }],
          weights: {
            weights: [{ criterionId: 'q1', weight: 1.0, admissibleRange: [1, 1] }],
            consistencyMargin: 1,
            derivedAt: '',
          },
        }),
        {
          options: [{ id: 'p1', label: 'P1', createdAt: '' }],
          performances: [
            { optionId: 'p1', criterionId: 'g1', value: 'pass' },
            { optionId: 'p1', criterionId: 'q1', value: 'high' },
          ],
        },
      ),
    );
    const r = result.optionResults[0];
    expect(r.hardRejected).toBe(false);
    expect(r.bandId).toBe('approved');
    expect(r.globalValue).toBe(100);
  });

  it('Tier 2 — veto triggers when score below veto level', () => {
    const valueTree: ValueTree = {
      root: { criterionId: 'root', children: [{ criterionId: 'q1', children: [] }] },
      criteria: {
        q1: {
          id: 'q1',
          label: 'Q1',
          type: 'qualification',
          vetoLevelId: 'mid',
          descriptor: {
            levels: [
              { id: 'high', label: 'High' },
              { id: 'mid', label: 'Mid' },
              { id: 'low', label: 'Low' },
            ],
            neutralIndex: 1,
            goodIndex: 0,
          },
        },
      },
    };
    const result = aggregate(
      evaluation(
        model({
          valueTree,
          derivedScales: [{
            criterionId: 'q1',
            values: [
              { levelId: 'high', value: 100, admissibleRange: [100, 100] },
              { levelId: 'mid', value: 0, admissibleRange: [0, 0] },
              { levelId: 'low', value: -50, admissibleRange: [-50, -50] },
            ],
            consistencyMargin: 1,
            derivedAt: '',
          }],
          weights: {
            weights: [{ criterionId: 'q1', weight: 1.0, admissibleRange: [1, 1] }],
            consistencyMargin: 1,
            derivedAt: '',
          },
        }),
        {
          options: [{ id: 'p1', label: 'P1', createdAt: '' }],
          performances: [{ optionId: 'p1', criterionId: 'q1', value: 'low' }],
        },
      ),
    );
    const r = result.optionResults[0];
    expect(r.hardRejected).toBe(true);
    expect(r.vetoedByCriterion).toBe('q1');
  });

  it('classifies into the band between thresholds', () => {
    const valueTree: ValueTree = {
      root: { criterionId: 'root', children: [{ criterionId: 'q1', children: [] }] },
      criteria: {
        q1: {
          id: 'q1',
          label: 'Q1',
          type: 'qualification',
          descriptor: {
            levels: [{ id: 'high', label: 'H' }, { id: 'low', label: 'L' }],
            neutralIndex: 1,
            goodIndex: 0,
          },
        },
      },
    };
    const result = aggregate(
      evaluation(
        model({
          valueTree,
          derivedScales: [{
            criterionId: 'q1',
            values: [
              { levelId: 'high', value: 100, admissibleRange: [100, 100] },
              { levelId: 'low', value: 55, admissibleRange: [55, 55] },
            ],
            consistencyMargin: 1,
            derivedAt: '',
          }],
          weights: {
            weights: [{ criterionId: 'q1', weight: 1.0, admissibleRange: [1, 1] }],
            consistencyMargin: 1,
            derivedAt: '',
          },
        }),
        {
          options: [{ id: 'p1', label: 'P1', createdAt: '' }],
          performances: [{ optionId: 'p1', criterionId: 'q1', value: 'low' }],
        },
      ),
    );
    expect(result.optionResults[0].bandId).toBe('conditional');
    expect(result.optionResults[0].globalValue).toBe(55);
  });

  it('additive model: V(p) = Σ kᵢ · vᵢ(p)', () => {
    const valueTree: ValueTree = {
      root: {
        criterionId: 'root',
        children: [
          { criterionId: 'q1', children: [] },
          { criterionId: 'q2', children: [] },
        ],
      },
      criteria: {
        q1: {
          id: 'q1', label: 'Q1', type: 'qualification',
          descriptor: { levels: [{ id: 'h', label: 'H' }, { id: 'l', label: 'L' }], neutralIndex: 1, goodIndex: 0 },
        },
        q2: {
          id: 'q2', label: 'Q2', type: 'qualification',
          descriptor: { levels: [{ id: 'h', label: 'H' }, { id: 'l', label: 'L' }], neutralIndex: 1, goodIndex: 0 },
        },
      },
    };
    // Weights: q1=0.6, q2=0.4; scores: q1=80, q2=50 → V = 0.6*80+0.4*50 = 68
    const result = aggregate(
      evaluation(
        model({
          valueTree,
          derivedScales: [
            { criterionId: 'q1', values: [{ levelId: 'h', value: 80, admissibleRange: [80, 80] }, { levelId: 'l', value: 0, admissibleRange: [0, 0] }], consistencyMargin: 1, derivedAt: '' },
            { criterionId: 'q2', values: [{ levelId: 'h', value: 50, admissibleRange: [50, 50] }, { levelId: 'l', value: 0, admissibleRange: [0, 0] }], consistencyMargin: 1, derivedAt: '' },
          ],
          weights: {
            weights: [
              { criterionId: 'q1', weight: 0.6, admissibleRange: [0.6, 0.6] },
              { criterionId: 'q2', weight: 0.4, admissibleRange: [0.4, 0.4] },
            ],
            consistencyMargin: 1,
            derivedAt: '',
          },
        }),
        {
          options: [{ id: 'p1', label: 'P1', createdAt: '' }],
          performances: [
            { optionId: 'p1', criterionId: 'q1', value: 'h' },
            { optionId: 'p1', criterionId: 'q2', value: 'h' },
          ],
        },
      ),
    );
    const r = result.optionResults[0];
    expect(r.globalValue).toBeCloseTo(68, 1);
    expect(r.bandId).toBe('conditional'); // 68 < 70
  });
});
