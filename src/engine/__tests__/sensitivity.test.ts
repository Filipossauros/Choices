import { describe, it, expect } from 'vitest';
import { computeSensitivity } from '../sensitivity';
import type { MacbethModel } from '../../domain/types';
import { MODEL_VERSION } from '../../domain/types';

function makeModel(): MacbethModel {
  return {
    id: 'test',
    modelVersion: MODEL_VERSION,
    label: 'Test',
    createdAt: '',
    updatedAt: '',
    valueTree: {
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
          descriptor: {
            levels: [{ id: 'h', label: 'H' }, { id: 'l', label: 'L' }],
            neutralIndex: 1, goodIndex: 0,
          },
        },
        q2: {
          id: 'q2', label: 'Q2', type: 'qualification',
          descriptor: {
            levels: [{ id: 'h', label: 'H' }, { id: 'l', label: 'L' }],
            neutralIndex: 1, goodIndex: 0,
          },
        },
      },
    },
    options: [
      { id: 'p1', label: 'P1', createdAt: '' },
      { id: 'p2', label: 'P2', createdAt: '' },
    ],
    // p1 scores high on q1, low on q2; p2 is the inverse
    performances: [
      { optionId: 'p1', criterionId: 'q1', value: 'h' },
      { optionId: 'p1', criterionId: 'q2', value: 'l' },
      { optionId: 'p2', criterionId: 'q1', value: 'l' },
      { optionId: 'p2', criterionId: 'q2', value: 'h' },
    ],
    derivedScales: [
      {
        criterionId: 'q1',
        values: [
          { levelId: 'h', value: 100, admissibleRange: [100, 100] },
          { levelId: 'l', value: 0, admissibleRange: [0, 0] },
        ],
        consistencyMargin: 1, derivedAt: '',
      },
      {
        criterionId: 'q2',
        values: [
          { levelId: 'h', value: 100, admissibleRange: [100, 100] },
          { levelId: 'l', value: 0, admissibleRange: [0, 0] },
        ],
        consistencyMargin: 1, derivedAt: '',
      },
    ],
    weights: {
      weights: [
        { criterionId: 'q1', weight: 0.5, admissibleRange: [0.5, 0.5] },
        { criterionId: 'q2', weight: 0.5, admissibleRange: [0.5, 0.5] },
      ],
      consistencyMargin: 1, derivedAt: '',
    },
    judgmentMatrices: [],
    approvedThreshold: 70,
    conditionalThreshold: 40,
  };
}

describe('computeSensitivity', () => {
  it('returns the requested number of points', () => {
    const model = makeModel();
    const result = computeSensitivity(model, 'q1', 11);
    expect(result.points).toHaveLength(11);
    expect(result.variedCriterionId).toBe('q1');
  });

  it('first point has weightValue = 0, last has weightValue = 1', () => {
    const model = makeModel();
    const result = computeSensitivity(model, 'q1', 11);
    expect(result.points[0].weightValue).toBeCloseTo(0, 5);
    expect(result.points[10].weightValue).toBeCloseTo(1, 5);
  });

  it('detects ranking change when options cross over', () => {
    // p1 excels at q1; p2 excels at q2.
    // Sweeping q1 from 0→1: p2 leads when wq1≈0, p1 leads when wq1≈1.
    const model = makeModel();
    const result = computeSensitivity(model, 'q1', 21);
    expect(result.rankingChangePoints.length).toBeGreaterThan(0);
  });

  it('p2 leads when q1 weight = 0, p1 leads when q1 weight = 1', () => {
    const model = makeModel();
    const result = computeSensitivity(model, 'q1', 21);

    const first = result.points[0].optionValues;
    expect(first['p2']).toBeGreaterThan(first['p1']);

    const last = result.points[20].optionValues;
    expect(last['p1']).toBeGreaterThan(last['p2']);
  });

  it('default step count is 21', () => {
    const model = makeModel();
    const result = computeSensitivity(model, 'q1');
    expect(result.points).toHaveLength(21);
  });
});
