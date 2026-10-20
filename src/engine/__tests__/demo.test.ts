/**
 * The example model exists to prove the app computes. These tests check that
 * it actually does — and, just as important, that it ships *unsolved*: the
 * moment someone hard-codes a plausible scale into it, it stops being evidence
 * of anything.
 */
import { describe, it, expect } from 'vitest';
import { buildDemoSkeleton } from '../../domain/demoModel';
import { buildDemoModel } from '../demo';
import { normalizeModel } from '../../repository/indexeddb';
import { runScenarios } from '../bench';
import { modelReadiness, qualificationCriteria, weightingGroups } from '../../domain/tree';
import { ALL_NEUTRAL } from '../weighting';

describe('the example model', () => {
  it('ships judgments and no results', () => {
    const skeleton = buildDemoSkeleton();
    expect(skeleton.derivedScales).toEqual([]);
    expect(skeleton.weights).toBeUndefined();
    expect(skeleton.subWeights).toBeUndefined();
    expect(skeleton.judgmentMatrices.length).toBeGreaterThan(0);
    expect(modelReadiness(skeleton).ready).toBe(false);
  });

  it('judges every pair of every criterion, and every weighting group', () => {
    const skeleton = buildDemoSkeleton();
    for (const crit of qualificationCriteria(skeleton)) {
      const matrix = skeleton.judgmentMatrices.find((m) => m.kind === 'scale' && m.criterionId === crit.id);
      const n = crit.descriptor.levels.length;
      expect(Object.keys(matrix!.judgments)).toHaveLength((n * (n - 1)) / 2);
    }
    for (const g of weightingGroups(skeleton).filter((x) => x.childIds.length > 1)) {
      const matrix = skeleton.judgmentMatrices.find((m) => m.kind === 'weighting' && m.criterionId === g.parentId);
      const n = g.childIds.length;
      // every pair, plus each criterion against the all-neutro reference
      expect(Object.keys(matrix!.judgments)).toHaveLength((n * (n - 1)) / 2 + n);
      expect(Object.keys(matrix!.judgments).some((k) => k.endsWith(`__${ALL_NEUTRAL}`))).toBe(true);
    }
  });

  it('solves to a complete, consistent model', async () => {
    const { model, unsolvedScales, unsolvedGroups } = await buildDemoModel();
    expect(unsolvedScales).toEqual([]);
    expect(unsolvedGroups).toEqual([]);
    expect(modelReadiness(model).ready).toBe(true);
    for (const s of model.derivedScales) expect(s.consistencyMargin).toBeGreaterThan(0);
  });

  it('anchors every scale at neutro = 0 and bom = 100', async () => {
    const { model } = await buildDemoModel();
    for (const crit of qualificationCriteria(model)) {
      const scale = model.derivedScales.find((s) => s.criterionId === crit.id)!;
      const { levels, neutralIndex, goodIndex } = crit.descriptor;
      expect(scale.values.find((v) => v.levelId === levels[neutralIndex].id)!.value).toBeCloseTo(0, 6);
      expect(scale.values.find((v) => v.levelId === levels[goodIndex].id)!.value).toBeCloseTo(100, 6);
    }
  });

  it('derives the decision cut-offs from the reference profiles', async () => {
    const { model } = await buildDemoModel();
    const byId = new Map(model.decisionScale.map((b) => [b.id, b]));
    // "Bom em tudo" is the normalisation anchor, so this profile scores 100.
    expect(byId.get('demo-band-ok')!.minScore).toBeCloseTo(100, 4);
    // "Mínimo contratual em tudo" is the other anchor: exactly 0.
    expect(byId.get('demo-band-degraded')!.minScore).toBeCloseTo(0, 4);
  });

  it('every scenario behaves the way its description says it does', async () => {
    const { model } = await buildDemoModel();
    const results = runScenarios(model, model.scenarios ?? []);
    const by = (label: string) => results.find((r) => r.label === label)!;

    expect(by('Mês conforme').globalValue).toBeCloseTo(100, 4);
    expect(by('Mês conforme').band?.label).toBe('Conforme');

    expect(by('Tudo no mínimo contratual').globalValue).toBeCloseTo(0, 4);
    expect(by('Tudo no mínimo contratual').band?.label).toBe('Degradado');

    const degraded = by('Degradação de latência');
    expect(degraded.globalValue).not.toBeNull();
    expect(degraded.blocked).toBe(false);

    const blocked = by('Interrupção eliminatória');
    expect(blocked.blocked).toBe(true);
    expect(blocked.globalValue).toBeNull();
    expect(blocked.indicativeValue).toBeCloseTo(100, 4);

    const incomplete = by('Métrica em falta');
    expect(incomplete.globalValue).toBeNull();
    expect(incomplete.missing).toHaveLength(1);
  });

  it('prices the incidents, and the zone is what moves the money', async () => {
    const { model } = await buildDemoModel();
    const results = runScenarios(model, model.scenarios ?? []);
    const by = (label: string) => results.find((r) => r.label === label)!;

    // Conforme sits in a ×0 zone: the rules exist and still charge nothing.
    expect(by('Mês conforme').penalty!.total).toBe(0);

    const degraded = by('Degradação de latência').penalty!;
    expect(degraded.total).toBeGreaterThan(0);
    expect(degraded.zone!.multiplier).toBe(1.1);
    // INC-206 shares RC-17 with the more severe INC-205 and must not accumulate.
    expect(degraded.lines.find((l) => l.incidentId === 'demo-i-206')!.amount).toBe(0);
    expect(degraded.lines.find((l) => l.incidentId === 'demo-i-206')!.absorbedBy).toBe('demo-i-205');

    // A failed gate gets the fixed critical regime and no zone multiplier.
    const blocked = by('Interrupção eliminatória').penalty!;
    expect(blocked.total).toBe(3000);
    expect(blocked.zone).toBeNull();
  });

  it('survives the importer, which is how it reaches a second session', async () => {
    const { model } = await buildDemoModel();
    const back = normalizeModel(JSON.parse(JSON.stringify(model)));
    expect(back.scenarios).toHaveLength(5);
    expect(back.penaltyRules?.criterionRules).toHaveLength(4);
    expect(modelReadiness(back).ready).toBe(true);
    expect(runScenarios(back, back.scenarios!)[0].globalValue).toBeCloseTo(100, 4);
  });
});
