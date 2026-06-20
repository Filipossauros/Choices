import { describe, it, expect } from 'vitest';
import { buildModelSpec, buildCapabilitiesManifest, MODEL_SPEC_SCHEMA } from '../../domain/modelSpec';
import type { EvaluationModel, ValueTree } from '../../domain/types';
import { MODEL_VERSION } from '../../domain/types';

const valueTree: ValueTree = {
  root: {
    criterionId: 'root',
    children: [
      { criterionId: 'health', children: [
        { criterionId: 'lat', children: [] },
        { criterionId: 'sat', children: [] },
      ] },
      { criterionId: 'crit', children: [] },
    ],
  },
  criteria: {
    health: { id: 'health', label: 'HealthStatus', type: 'composite' },
    lat: { id: 'lat', label: 'Latência', type: 'qualification', descriptor: { levels: [{ id: 'f', label: 'Rápido' }, { id: 's', label: 'Lento' }], neutralIndex: 1, goodIndex: 0 } },
    sat: { id: 'sat', label: 'Saturação', type: 'qualification', descriptor: { levels: [{ id: 'l', label: 'Baixa' }, { id: 'h', label: 'Alta' }], neutralIndex: 1, goodIndex: 0 } },
    crit: { id: 'crit', label: 'Criticidade', type: 'qualification', descriptor: { levels: [{ id: 'lo', label: 'Baixa' }, { id: 'hi', label: 'Alta' }], neutralIndex: 1, goodIndex: 0 } },
  },
};

const model: EvaluationModel = {
  kind: 'model', id: 'm', modelVersion: MODEL_VERSION, label: 'Risco', createdAt: '', updatedAt: '',
  valueTree, judgmentMatrices: [], derivedScales: [],
  weights: { weights: [
    { criterionId: 'health', weight: 0.4, admissibleRange: [0.4, 0.4] },
    { criterionId: 'crit', weight: 0.6, admissibleRange: [0.6, 0.6] },
  ], consistencyMargin: 1, derivedAt: '' },
  subWeights: { health: { weights: [
    { criterionId: 'lat', weight: 0.6, admissibleRange: [0.6, 0.6] },
    { criterionId: 'sat', weight: 0.4, admissibleRange: [0.4, 0.4] },
  ], consistencyMargin: 1, derivedAt: '' } },
  decisionScale: [{ id: 'b', label: 'Sanção', minScore: 0, color: '#000' }],
};

describe('buildModelSpec', () => {
  const spec = buildModelSpec(model);

  it('tags the schema and method', () => {
    expect(spec.schema).toBe(MODEL_SPEC_SCHEMA);
    expect(spec.method.name).toBe('MACBETH');
  });

  it('expands per-group formulas with weights and right symbols', () => {
    const root = spec.formula.perGroup.find((f) => f.target === 'V(p)');
    const health = spec.formula.perGroup.find((f) => f.target === 'V[HealthStatus]');
    expect(root?.expression).toBe('0.40·V[HealthStatus] + 0.60·v[Criticidade]');
    expect(health?.expression).toBe('0.60·v[Latência] + 0.40·v[Saturação]');
  });

  it('computes effective leaf weights as path products', () => {
    const eff = Object.fromEntries(spec.weighting.effectiveLeafWeights.map((e) => [e.criterionId, e.weight]));
    expect(eff.lat).toBeCloseTo(0.24, 5); // 0.4 * 0.6
    expect(eff.sat).toBeCloseTo(0.16, 5); // 0.4 * 0.4
    expect(eff.crit).toBeCloseTo(0.6, 5);
  });

  it('reports readiness diagnostics', () => {
    expect(spec.diagnostics.factorCount).toBe(1);
    expect(spec.diagnostics.leafCount).toBe(3);
    expect(spec.diagnostics.weightsComplete).toBe(true);
  });
});

describe('buildCapabilitiesManifest', () => {
  it('lists flows, criterion types and example use cases', () => {
    const m = buildCapabilitiesManifest();
    expect(m.flows.map((f) => f.id)).toEqual(['create', 'apply']);
    expect(m.criterionTypes.map((t) => t.type)).toContain('composite');
    expect(m.exampleUseCases.length).toBe(2);
  });
});
