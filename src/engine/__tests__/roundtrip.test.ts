/**
 * The importer enumerates fields one by one, so anything added to the model is
 * dropped on load unless `normalizeModel` is taught about it. These tests pin
 * that down for the fields the bench and the penalty rules depend on: without
 * them an exported package would come back missing exactly the parts that make
 * it a package.
 */
import { describe, it, expect } from 'vitest';
import { normalizeModel } from '../../repository/indexeddb';
import { repository } from '../../repository';
import { buildPackage } from '../../domain/modelSpec';
import type { EvaluationModel, TestScenario, PenaltyRules } from '../../domain/types';

const scenario: TestScenario = {
  id: 's1',
  label: 'Tudo no mínimo',
  performances: [{ optionId: 's1', criterionId: 'q1', value: 'n' }],
  incidents: [{ id: 'i1', label: 'Latência', criterionId: 'q1', severity: 78, occurrence: 2, rootCauseId: 'rc-17' }],
  updatedAt: '2026-10-18T00:00:00.000Z',
};

const rules: PenaltyRules = {
  version: 'v2',
  currency: 'EUR',
  severityBands: [
    { id: 'sb-light', label: 'Ligeira', minSeverity: 0, exempt: true },
    { id: 'sb-mod', label: 'Moderada', minSeverity: 40 },
  ],
  zoneMultipliers: { 'b-ok': 0, 'b-bad': 1.1 },
  criterionRules: [{ criterionId: 'q1', baseAmount: 1000, minSeverityBandId: 'sb-mod', reference: '14.3 b)' }],
  recurrence: { secondFactor: 1.25, furtherFactor: 1.5, windowDays: 90, enabled: true },
  commonCauseNoAccumulation: true,
  criticalRegime: { amount: 3000, enabled: true },
  periodCap: 8000,
};

function raw(extra: Partial<EvaluationModel>): Record<string, unknown> {
  return {
    kind: 'model',
    id: 'm1',
    label: 'M',
    valueTree: { root: { criterionId: 'root', children: [] }, criteria: {} },
    judgmentMatrices: [],
    derivedScales: [],
    decisionScale: [{ id: 'b-bad', label: 'Mau', minScore: 0, color: '#000' }],
    ...extra,
  } as Record<string, unknown>;
}

describe('normalizeModel carries the package fields', () => {
  it('keeps scenarios, with their incidents', () => {
    const m = normalizeModel(raw({ scenarios: [scenario] }));
    expect(m.scenarios).toHaveLength(1);
    expect(m.scenarios![0].performances[0].criterionId).toBe('q1');
    expect(m.scenarios![0].incidents![0].rootCauseId).toBe('rc-17');
  });

  it('keeps the penalty rules whole', () => {
    const m = normalizeModel(raw({ penaltyRules: rules }));
    expect(m.penaltyRules).toEqual(rules);
  });

  it('survives a JSON round-trip, which is how a package actually travels', () => {
    const once = normalizeModel(raw({ scenarios: [scenario], penaltyRules: rules }));
    const twice = normalizeModel(JSON.parse(JSON.stringify(once)));
    expect(twice.scenarios).toEqual(once.scenarios);
    expect(twice.penaltyRules).toEqual(once.penaltyRules);
  });

  it('leaves both undefined for a model written before they existed', () => {
    const m = normalizeModel(raw({}));
    expect(m.scenarios).toBeUndefined();
    expect(m.penaltyRules).toBeUndefined();
  });
});

describe('the export package is importable', () => {
  it('unwraps a package back into the model it carries', () => {
    const model = normalizeModel(raw({ scenarios: [scenario], penaltyRules: rules }));
    const pkg = buildPackage(model, { schema: 'choices/test-vectors@1', vectors: [] });
    const back = repository.parseDocument(JSON.stringify(pkg));
    expect(back.kind).toBe('model');
    expect((back as EvaluationModel).id).toBe('m1');
    expect((back as EvaluationModel).penaltyRules).toEqual(rules);
    expect((back as EvaluationModel).scenarios).toEqual([scenario]);
  });

  it('still reads a bare model and a bare evaluation', () => {
    expect(repository.parseDocument(JSON.stringify(raw({}))).kind).toBe('model');
    const evaluation = { kind: 'evaluation', id: 'e', model: raw({}), options: [], performances: [] };
    expect(repository.parseDocument(JSON.stringify(evaluation)).kind).toBe('evaluation');
  });
});
