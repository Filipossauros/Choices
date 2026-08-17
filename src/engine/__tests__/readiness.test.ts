/**
 * Model readiness — the guard that stops an evaluation being started from (or
 * stranded on) a model that can never be aggregated.
 */
import { describe, it, expect } from 'vitest';
import { modelReadiness } from '../../domain/tree';
import type { EvaluationModel, ValueTree } from '../../domain/types';
import { MODEL_VERSION, ROOT_ID } from '../../domain/types';

const descriptor = () => ({
  levels: [{ id: 'high', label: 'High' }, { id: 'low', label: 'Low' }],
  neutralIndex: 1,
  goodIndex: 0,
});

function model(over: Partial<EvaluationModel> = {}): EvaluationModel {
  const valueTree: ValueTree = {
    root: {
      criterionId: ROOT_ID,
      children: [
        { criterionId: 'q1', children: [] },
        { criterionId: 'q2', children: [] },
      ],
    },
    criteria: {
      q1: { id: 'q1', label: 'Q1', type: 'qualification', descriptor: descriptor() },
      q2: { id: 'q2', label: 'Q2', type: 'qualification', descriptor: descriptor() },
    },
  };
  return {
    kind: 'model',
    id: 'm',
    modelVersion: MODEL_VERSION,
    label: 'M',
    createdAt: '',
    updatedAt: '',
    valueTree,
    judgmentMatrices: [],
    derivedScales: [],
    decisionScale: [],
    ...over,
  };
}

const scale = (criterionId: string, margin = 1) => ({
  criterionId,
  values: [
    { levelId: 'high', value: 100, admissibleRange: [100, 100] as [number, number] },
    { levelId: 'low', value: 0, admissibleRange: [0, 0] as [number, number] },
  ],
  consistencyMargin: margin,
  derivedAt: '',
});

const weights = () => ({
  weights: [
    { criterionId: 'q1', weight: 0.5, admissibleRange: [0.5, 0.5] as [number, number] },
    { criterionId: 'q2', weight: 0.5, admissibleRange: [0.5, 0.5] as [number, number] },
  ],
  consistencyMargin: 1,
  derivedAt: '',
});

describe('modelReadiness', () => {
  it('a bare model is not ready and names every pending scale', () => {
    const r = modelReadiness(model());
    expect(r.ready).toBe(false);
    expect(r.scalesReady).toBe(false);
    expect(r.weightsReady).toBe(false);
    expect(r.pendingScales.sort()).toEqual(['Q1', 'Q2']);
  });

  it('scales alone are not enough — weights are still missing', () => {
    const r = modelReadiness(model({ derivedScales: [scale('q1'), scale('q2')] }));
    expect(r.scalesReady).toBe(true);
    expect(r.weightsReady).toBe(false);
    expect(r.ready).toBe(false);
  });

  it('weights alone are not enough — scales are still missing', () => {
    const r = modelReadiness(model({ weights: weights() }));
    expect(r.weightsReady).toBe(true);
    expect(r.scalesReady).toBe(false);
    expect(r.ready).toBe(false);
  });

  it('an inconsistent scale counts as pending', () => {
    const r = modelReadiness(
      model({ derivedScales: [scale('q1'), scale('q2', -1)], weights: weights() }),
    );
    expect(r.pendingScales).toEqual(['Q2']);
    expect(r.ready).toBe(false);
  });

  it('scales plus weights make the model ready', () => {
    const r = modelReadiness(
      model({ derivedScales: [scale('q1'), scale('q2')], weights: weights() }),
    );
    expect(r.ready).toBe(true);
    expect(r.pendingScales).toEqual([]);
  });

  it('a model with no qualification criteria can never score', () => {
    const gatesOnly = model({
      valueTree: {
        root: { criterionId: ROOT_ID, children: [{ criterionId: 'g', children: [] }] },
        criteria: { g: { id: 'g', label: 'Gate', type: 'gate' } },
      },
    });
    const r = modelReadiness(gatesOnly);
    expect(r.hasCriteria).toBe(false);
    expect(r.ready).toBe(false);
  });
});
