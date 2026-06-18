import { describe, it, expect } from 'vitest';
import { aggregate } from '../aggregation';
import type { MacbethModel, ValueTree } from '../../domain/types';
import { MODEL_VERSION } from '../../domain/types';

function base(overrides: Partial<MacbethModel> = {}): MacbethModel {
  return {
    id: 'test',
    modelVersion: MODEL_VERSION,
    label: 'Test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    valueTree: { root: { criterionId: 'root', children: [] }, criteria: {} },
    options: [],
    performances: [],
    judgmentMatrices: [],
    derivedScales: [],
    approvedThreshold: 70,
    conditionalThreshold: 40,
    ...overrides,
  };
}

describe('Two-tier aggregation', () => {
  it('Tier 1 — gate failure vetos before scoring', () => {
    const valueTree: ValueTree = {
      root: { criterionId: 'root', children: [{ criterionId: 'g1', children: [] }] },
      criteria: { g1: { id: 'g1', label: 'Gate 1', type: 'gate' } },
    };
    const model = base({
      valueTree,
      options: [{ id: 'p1', label: 'P1', createdAt: '' }],
      performances: [{ optionId: 'p1', criterionId: 'g1', value: 'fail' }],
    });
    const result = aggregate(model);
    const r = result.optionResults[0];
    expect(r.verdict).toBe('rejected');
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
    const model = base({
      valueTree,
      options: [{ id: 'p1', label: 'P1', createdAt: '' }],
      performances: [
        { optionId: 'p1', criterionId: 'g1', value: 'pass' },
        { optionId: 'p1', criterionId: 'q1', value: 'high' },
      ],
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
    });
    const result = aggregate(model);
    const r = result.optionResults[0];
    expect(r.verdict).toBe('approved');
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
    const model = base({
      valueTree,
      options: [{ id: 'p1', label: 'P1', createdAt: '' }],
      performances: [{ optionId: 'p1', criterionId: 'q1', value: 'low' }],
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
    });
    const result = aggregate(model);
    const r = result.optionResults[0];
    expect(r.verdict).toBe('rejected');
    expect(r.vetoedByCriterion).toBe('q1');
  });

  it('classifies as "conditional" when score is between thresholds', () => {
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
    const model = base({
      valueTree,
      options: [{ id: 'p1', label: 'P1', createdAt: '' }],
      performances: [{ optionId: 'p1', criterionId: 'q1', value: 'low' }],
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
      approvedThreshold: 70,
      conditionalThreshold: 40,
    });
    const result = aggregate(model);
    expect(result.optionResults[0].verdict).toBe('conditional');
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
    const model = base({
      valueTree,
      options: [{ id: 'p1', label: 'P1', createdAt: '' }],
      performances: [
        { optionId: 'p1', criterionId: 'q1', value: 'h' },
        { optionId: 'p1', criterionId: 'q2', value: 'h' },
      ],
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
      approvedThreshold: 70,
      conditionalThreshold: 40,
    });
    const result = aggregate(model);
    const r = result.optionResults[0];
    expect(r.globalValue).toBeCloseTo(68, 1);
    expect(r.verdict).toBe('conditional'); // 68 < 70
  });
});
