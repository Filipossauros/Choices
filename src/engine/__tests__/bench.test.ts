import { describe, it, expect } from 'vitest';
import { runScenario, runScenarios } from '../bench';
import type { EvaluationModel, TestScenario, ValueTree } from '../../domain/types';
import { MODEL_VERSION } from '../../domain/types';

/** Two leaves 60/40, each Bom=100 / Neutro=0, plus one gate. */
function model(): EvaluationModel {
  const levels = [
    { id: 'hi', label: 'Alto' },
    { id: 'mid', label: 'Médio' },
    { id: 'lo', label: 'Baixo' },
  ];
  const valueTree: ValueTree = {
    root: {
      criterionId: 'root',
      children: [{ criterionId: 'a', children: [] }, { criterionId: 'b', children: [] }, { criterionId: 'g', children: [] }],
    },
    criteria: {
      a: { id: 'a', type: 'qualification', label: 'A', descriptor: { levels, neutralIndex: 2, goodIndex: 0 } },
      b: { id: 'b', type: 'qualification', label: 'B', descriptor: { levels, neutralIndex: 2, goodIndex: 0 } },
      g: { id: 'g', type: 'gate', label: 'Porta' },
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
    derivedScales: [
      { criterionId: 'a', consistencyMargin: 0.1, derivedAt: '', values: [
        { levelId: 'hi', value: 100, admissibleRange: [100, 100] },
        { levelId: 'mid', value: 50, admissibleRange: [50, 50] },
        { levelId: 'lo', value: 0, admissibleRange: [0, 0] },
      ] },
      { criterionId: 'b', consistencyMargin: 0.1, derivedAt: '', values: [
        { levelId: 'hi', value: 100, admissibleRange: [100, 100] },
        { levelId: 'mid', value: 50, admissibleRange: [50, 50] },
        { levelId: 'lo', value: 0, admissibleRange: [0, 0] },
      ] },
    ],
    weights: {
      consistencyMargin: 0.1,
      derivedAt: '',
      weights: [
        { criterionId: 'a', weight: 0.6, admissibleRange: [0.6, 0.6] },
        { criterionId: 'b', weight: 0.4, admissibleRange: [0.4, 0.4] },
      ],
    },
    decisionScale: [
      { id: 'top', label: 'Aceitável', minScore: 70, color: '#0a0' },
      { id: 'mid', label: 'Degradado', minScore: 20, color: '#fa0' },
      { id: 'bot', label: 'Mau', minScore: 0, color: '#a00' },
    ],
  };
}

function scenario(id: string, perf: { criterionId: string; value: string }[]): TestScenario {
  return { id, label: id, updatedAt: '', performances: perf.map((p) => ({ optionId: id, ...p })) };
}

describe('bench', () => {
  it('traces observed → level → value → weight → contribution, and the parts sum to the index', () => {
    const r = runScenario(model(), scenario('s1', [
      { criterionId: 'a', value: 'hi' },
      { criterionId: 'b', value: 'mid' },
      { criterionId: 'g', value: 'pass' },
    ]));
    const a = r.rows.find((x) => x.criterionId === 'a')!;
    expect(a.levelLabel).toBe('Alto');
    expect(a.value).toBe(100);
    expect(a.weight).toBeCloseTo(0.6, 5);
    expect(a.contribution).toBeCloseTo(60, 5);

    const sum = r.rows.reduce((s, x) => s + (x.contribution ?? 0), 0);
    expect(sum).toBeCloseTo(r.globalValue!, 5);
    expect(r.globalValue).toBeCloseTo(80, 5);
    expect(r.band?.label).toBe('Aceitável');
  });

  it('withholds the index when a criterion is blank, and names it — no renormalisation', () => {
    const r = runScenario(model(), scenario('s2', [{ criterionId: 'a', value: 'hi' }, { criterionId: 'g', value: 'pass' }]));
    expect(r.globalValue).toBeNull();
    expect(r.band).toBeNull();
    expect(r.missing.map((m) => m.criterionId)).toEqual(['b']);
    expect(r.rows.find((x) => x.criterionId === 'b')!.blank).toBe(true);
  });

  it('a failed gate blocks the band but still reports what it would have scored', () => {
    const r = runScenario(model(), scenario('s3', [
      { criterionId: 'a', value: 'hi' },
      { criterionId: 'b', value: 'hi' },
      { criterionId: 'g', value: 'fail' },
    ]));
    expect(r.blocked).toBe(true);
    expect(r.blockedBy).toEqual({ kind: 'gate', criterionId: 'g', label: 'Porta' });
    expect(r.globalValue).toBeNull();
    expect(r.band).toBeNull();
    expect(r.indicativeValue).toBeCloseTo(100, 5);
    expect(r.wouldBeBand?.label).toBe('Aceitável');
  });

  it('an unanswered gate leaves the classification provisional without blocking it', () => {
    const r = runScenario(model(), scenario('s4', [
      { criterionId: 'a', value: 'lo' },
      { criterionId: 'b', value: 'lo' },
    ]));
    expect(r.blocked).toBe(false);
    expect(r.globalValue).toBeCloseTo(0, 5);
    expect(r.pendingGates.map((g) => g.criterionId)).toEqual(['g']);
  });

  it('every criterion at its neutral level scores exactly 0 — the normalisation test', () => {
    const r = runScenario(model(), scenario('s5', [
      { criterionId: 'a', value: 'lo' },
      { criterionId: 'b', value: 'lo' },
      { criterionId: 'g', value: 'pass' },
    ]));
    expect(r.globalValue).toBe(0);
  });

  it('runs several scenarios against one model and keeps them apart', () => {
    const rs = runScenarios(model(), [
      scenario('s1', [{ criterionId: 'a', value: 'hi' }, { criterionId: 'b', value: 'hi' }, { criterionId: 'g', value: 'pass' }]),
      scenario('s2', [{ criterionId: 'a', value: 'lo' }, { criterionId: 'b', value: 'lo' }, { criterionId: 'g', value: 'pass' }]),
    ]);
    expect(rs.map((r) => r.globalValue)).toEqual([100, 0]);
  });

  it('re-stamps optionId, so a scenario copied from another still scores as itself', () => {
    const copied: TestScenario = {
      id: 'fresh',
      label: 'Cópia',
      updatedAt: '',
      performances: [
        { optionId: 'original', criterionId: 'a', value: 'hi' },
        { optionId: 'original', criterionId: 'b', value: 'hi' },
        { optionId: 'original', criterionId: 'g', value: 'pass' },
      ],
    };
    expect(runScenario(model(), copied).globalValue).toBeCloseTo(100, 5);
  });
});
