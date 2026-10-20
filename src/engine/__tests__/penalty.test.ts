import { describe, it, expect } from 'vitest';
import { computePenalties, severityBandFor, defaultPenaltyRules } from '../penalty';
import type { PenaltyRules, DecisionBand, TestIncident, EvaluationModel } from '../../domain/types';
import { MODEL_VERSION } from '../../domain/types';

const band: DecisionBand = { id: 'degraded', label: 'Degradado', minScore: 20, color: '#fa0' };

function rules(over: Partial<PenaltyRules> = {}): PenaltyRules {
  return {
    version: 'v2',
    currency: 'EUR',
    severityBands: [
      { id: 'light', label: 'Ligeira', minSeverity: 0, exempt: true },
      { id: 'moderate', label: 'Moderada', minSeverity: 40 },
      { id: 'serious', label: 'Grave', minSeverity: 70 },
      { id: 'critical', label: 'Crítica', minSeverity: 90 },
    ],
    zoneMultipliers: { degraded: 1.1, ok: 0 },
    criterionRules: [
      { criterionId: 'lat', baseAmount: 1000, minSeverityBandId: 'moderate', perIncidentCap: 2000, reference: '14.3 b)' },
    ],
    recurrence: { secondFactor: 1.25, furtherFactor: 1.5, windowDays: 90, enabled: true },
    commonCauseNoAccumulation: true,
    criticalRegime: { amount: 3000, enabled: true },
    periodCap: 8000,
    ...over,
  };
}

const labelOf = (id: string) => ({ lat: 'Latência p95', err: 'Erros 5xx' })[id] ?? id;

function incident(over: Partial<TestIncident> = {}): TestIncident {
  return { id: 'inc', label: 'Incidente', criterionId: 'lat', severity: 78, ...over };
}

describe('penalty', () => {
  it('walks severity → factor → base → zone → recurrence, and the trace replays the amount', () => {
    const r = computePenalties({
      rules: rules(),
      incidents: [incident({ id: 'i1', occurrence: 2 })],
      band,
      gateFailed: false,
      labelOf,
    });
    const line = r.lines[0];
    // (78 − 40)/60 = 0.6333 → ×1000 = 633.33 → ×1.10 = 696.67 → ×1.25 = 870.83
    expect(line.amount).toBeCloseTo(870.83, 2);
    const amounts = line.steps.filter((s) => s.amount != null).map((s) => s.amount);
    expect(amounts).toEqual([633.33, 696.67, 870.83, 870.83]);
    expect(line.severityBand?.label).toBe('Grave');
  });

  it('keeps steps that were evaluated and did not fire', () => {
    const r = computePenalties({ rules: rules(), incidents: [incident({ id: 'i1' })], band, gateFailed: false, labelOf });
    const byLabel = new Map(r.lines[0].steps.map((s) => [s.label, s]));
    expect(byLabel.get('Reincidência')!.applied).toBe(false);
    expect(byLabel.get('Tecto por incidente')!.applied).toBe(false);
    // …but they are still in the trace.
    expect(byLabel.has('Reincidência')).toBe(true);
  });

  it('charges nothing below the criterion’s minimum severity band', () => {
    const r = computePenalties({ rules: rules(), incidents: [incident({ severity: 22 })], band, gateFailed: false, labelOf });
    expect(r.total).toBe(0);
    expect(r.lines[0].steps.some((s) => s.label === 'Faixa mínima' && s.applied)).toBe(true);
  });

  it('collapses incidents sharing a root cause onto the most severe one', () => {
    const r = computePenalties({
      rules: rules(),
      incidents: [
        incident({ id: 'i1', label: 'Latência', severity: 78, rootCauseId: 'rc17' }),
        incident({ id: 'i2', label: 'Erros', criterionId: 'lat', severity: 61, rootCauseId: 'rc17' }),
      ],
      band,
      gateFailed: false,
      labelOf,
    });
    expect(r.lines[1].amount).toBe(0);
    expect(r.lines[1].absorbedBy).toBe('i1');
    expect(r.total).toBeCloseTo(r.lines[0].amount, 2);
  });

  it('accumulates them when the rule is off', () => {
    const r = computePenalties({
      rules: rules({ commonCauseNoAccumulation: false }),
      incidents: [
        incident({ id: 'i1', severity: 78, rootCauseId: 'rc17' }),
        incident({ id: 'i2', severity: 61, rootCauseId: 'rc17' }),
      ],
      band,
      gateFailed: false,
      labelOf,
    });
    expect(r.lines.every((l) => l.amount > 0)).toBe(true);
  });

  it('applies the per-incident cap', () => {
    const r = computePenalties({
      rules: rules({ criterionRules: [{ criterionId: 'lat', baseAmount: 10000, minSeverityBandId: 'moderate', perIncidentCap: 2000 }] }),
      incidents: [incident()],
      band,
      gateFailed: false,
      labelOf,
    });
    expect(r.lines[0].amount).toBe(2000);
    expect(r.lines[0].steps.find((s) => s.label === 'Tecto por incidente')!.applied).toBe(true);
  });

  it('applies the period cap to the total, not to the lines', () => {
    const r = computePenalties({
      rules: rules({ periodCap: 1000 }),
      incidents: [incident({ id: 'i1' }), incident({ id: 'i2', criterionId: 'lat' })],
      band,
      gateFailed: false,
      labelOf,
    });
    expect(r.subtotal).toBeGreaterThan(1000);
    expect(r.total).toBe(1000);
    expect(r.capApplied).toBe(true);
  });

  it('a failed gate adds a fixed critical-regime line', () => {
    const r = computePenalties({ rules: rules(), incidents: [], band, gateFailed: true, gateLabel: 'Interrupção total', labelOf });
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].amount).toBe(3000);
    expect(r.lines[0].label).toContain('Interrupção total');
  });

  it('the critical regime does not suppress the period’s other incidents', () => {
    const r = computePenalties({
      rules: rules(),
      incidents: [incident({ id: 'i1', occurrence: 2 })],
      band,
      gateFailed: true,
      gateLabel: 'Interrupção total',
      labelOf,
    });
    expect(r.lines).toHaveLength(2);
    // 3 000 fixed + the latency incident priced as it would have been anyway.
    expect(r.lines[0].amount).toBe(3000);
    expect(r.lines[1].amount).toBeCloseTo(870.83, 2);
    expect(r.total).toBeCloseTo(3870.83, 2);
  });

  it('without a band, uses ×1 and says why instead of assuming a zone', () => {
    const r = computePenalties({ rules: rules(), incidents: [incident()], band: null, gateFailed: false, labelOf });
    expect(r.zone).toBeNull();
    expect(r.notes.map((n) => n.text).join(' ')).toContain('Sem zona');
    expect(r.lines[0].amount).toBeCloseTo(633.33, 2);
  });

  it('an incident on a criterion with no money rule is reported, not priced at zero in silence', () => {
    const r = computePenalties({ rules: rules(), incidents: [incident({ criterionId: 'err' })], band, gateFailed: false, labelOf });
    expect(r.total).toBe(0);
    expect(r.notes.map((n) => n.text).join(' ')).toContain('Erros 5xx');
  });

  it('severityBandFor picks the highest band reached', () => {
    expect(severityBandFor(95, rules())!.label).toBe('Crítica');
    expect(severityBandFor(70, rules())!.label).toBe('Grave');
    expect(severityBandFor(0, rules())!.label).toBe('Ligeira');
  });

  it('default rules cost nothing in the best band and never reference a band that does not exist', () => {
    const model = {
      kind: 'model', id: 'm', modelVersion: MODEL_VERSION, label: 'M', createdAt: '', updatedAt: '',
      valueTree: { root: { criterionId: 'root', children: [] }, criteria: {} },
      judgmentMatrices: [], derivedScales: [],
      decisionScale: [
        { id: 'a', label: 'Bom', minScore: 70, color: '#0a0' },
        { id: 'b', label: 'Médio', minScore: 20, color: '#fa0' },
        { id: 'c', label: 'Mau', minScore: 0, color: '#a00' },
      ],
    } as EvaluationModel;
    const d = defaultPenaltyRules(model);
    expect(d.zoneMultipliers.a).toBe(0);
    expect(d.zoneMultipliers.b).toBe(1);
    expect(d.zoneMultipliers.c).toBe(1.25);
    expect(Object.keys(d.zoneMultipliers).sort()).toEqual(['a', 'b', 'c']);
  });
});
