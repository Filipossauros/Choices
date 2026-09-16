/**
 * The two direct-input surfaces — value ruler and weight sliders.
 *
 * Both claim to be alternative ways of giving the *same* MACBETH judgments
 * rather than a way round them, so what these tests pin is exactly that: the
 * positions and weights a user drags must translate into a judgment record the
 * real LP accepts, covering every pair and preserving the order the user drew.
 */
import { describe, it, expect } from 'vitest';
import {
  defaultLevelValues,
  judgmentsFromLevelValues,
  pairReadings,
} from '../../ui/components/ValueRuler';
import { setWeightProportional, weightReadings } from '../../ui/components/WeightSliders';
import { deriveScale } from '../scaling';
import type { QualificationCriterion, JudgmentMatrix } from '../../domain/types';

const crit = (): QualificationCriterion => ({
  id: 'c',
  label: 'Autenticação',
  type: 'qualification',
  descriptor: {
    levels: [
      { id: 'forte', label: 'Forte (MFA + SSO)' },
      { id: 'basica', label: 'Básica (password)' },
      { id: 'nenhuma', label: 'Sem autenticação' },
    ],
    neutralIndex: 2, // Sem autenticação = 0
    goodIndex: 0,    // Forte = 100
  },
});

describe('value ruler', () => {
  it('seeds with the anchors pinned at 0 and 100', () => {
    const v = defaultLevelValues(crit());
    expect(v.nenhuma).toBe(0);
    expect(v.forte).toBe(100);
    expect(v.basica).toBeGreaterThan(0);
    expect(v.basica).toBeLessThan(100);
  });

  it('translates positions into a judgment for every pair, not just adjacent ones', () => {
    const j = judgmentsFromLevelValues(crit(), { forte: 100, basica: 42, nenhuma: 0 });
    expect(Object.keys(j).sort()).toEqual(
      ['basica__nenhuma', 'forte__basica', 'forte__nenhuma'].sort(),
    );
  });

  it('gives the widest gap the top category', () => {
    const j = judgmentsFromLevelValues(crit(), { forte: 100, basica: 42, nenhuma: 0 });
    const cat = (k: string) => { const x = j[k]; return x.kind === 'exact' ? x.category : x.lo; };
    expect(cat('forte__nenhuma')).toBe(6);
    // The two sub-gaps must both be smaller than the whole span.
    expect(cat('forte__basica')).toBeLessThan(6);
    expect(cat('basica__nenhuma')).toBeLessThan(6);
  });

  it('orders categories the same way the positions are ordered', () => {
    // basica sits close to nenhuma, so forte→basica is the bigger jump.
    const j = judgmentsFromLevelValues(crit(), { forte: 100, basica: 20, nenhuma: 0 });
    const cat = (k: string) => { const x = j[k]; return x.kind === 'exact' ? x.category : x.lo; };
    expect(cat('forte__basica')).toBeGreaterThan(cat('basica__nenhuma'));
  });

  it('reads two levels at the same position as indifferent', () => {
    const j = judgmentsFromLevelValues(crit(), { forte: 100, basica: 100, nenhuma: 0 });
    const x = j['forte__basica'];
    expect(x.kind === 'exact' && x.category).toBe(0);
  });

  it('produces judgments the real scale LP derives consistently', async () => {
    const matrix: JudgmentMatrix = {
      id: 'm', kind: 'scale', criterionId: 'c', assessorId: 'a', updatedAt: '',
      judgments: judgmentsFromLevelValues(crit(), { forte: 100, basica: 42, nenhuma: 0 }),
    };
    const scale = await deriveScale('c', crit().descriptor, matrix);
    expect(scale.consistencyMargin).toBeGreaterThan(0);
    const val = (id: string) => scale.values.find((v) => v.levelId === id)!.value;
    expect(val('forte')).toBe(100);
    expect(val('nenhuma')).toBe(0);
    // The dragged middle level must still land between the anchors.
    expect(val('basica')).toBeGreaterThan(0);
    expect(val('basica')).toBeLessThan(100);
  });

  it('lists readings smallest gap first, with labels', () => {
    const rows = pairReadings(crit(), { forte: 100, basica: 42, nenhuma: 0 });
    expect(rows).toHaveLength(3);
    expect(rows[0].delta).toBeLessThanOrEqual(rows[rows.length - 1].delta);
    expect(rows[rows.length - 1].label).toBe('Extrema');
    expect(rows[0].from).toBeTruthy();
  });
});

describe('weight sliders', () => {
  const w3 = { a: 0.5, b: 0.3, c: 0.2 };

  it('keeps the group summing to 1 after a drag', () => {
    const next = setWeightProportional(w3, 'a', 0.8);
    expect(next.a).toBeCloseTo(0.8, 10);
    expect(Object.values(next).reduce((s, x) => s + x, 0)).toBeCloseTo(1, 10);
  });

  it('redistributes proportionally, preserving the ratio between the others', () => {
    const next = setWeightProportional(w3, 'a', 0.6);
    // b was 1.5x c before, and must stay 1.5x c after.
    expect(next.b / next.c).toBeCloseTo(w3.b / w3.c, 8);
  });

  it('clamps out-of-range input', () => {
    expect(setWeightProportional(w3, 'a', 5).a).toBe(1);
    expect(setWeightProportional(w3, 'a', -2).a).toBe(0);
  });

  it('shares the remainder evenly when every other weight is zero', () => {
    const next = setWeightProportional({ a: 1, b: 0, c: 0 }, 'a', 0.4);
    expect(next.b).toBeCloseTo(0.3, 8);
    expect(next.c).toBeCloseTo(0.3, 8);
  });

  it('reads weights back as pairwise judgments, excluding the reference', () => {
    const rows = weightReadings(['a', 'b', 'c'], w3, (id) => id.toUpperCase());
    expect(rows).toHaveLength(3); // 3 criterion pairs; the all-neutral rows are dropped
    expect(rows.every((r) => r.label.length > 0)).toBe(true);
    // Sorted by gap, so the widest pair (a vs c) comes last.
    expect(rows[rows.length - 1].more).toBe('A');
    expect(rows[rows.length - 1].less).toBe('C');
  });
});

describe('value ruler — anchors that are not the extremes', () => {
  /** Neutro sits in the middle, so the worst level extrapolates below zero. */
  const midAnchor = (): QualificationCriterion => ({
    id: 'c', label: 'Autenticação', type: 'qualification',
    descriptor: {
      levels: [
        { id: 'forte', label: 'Forte' },
        { id: 'basica', label: 'Básica' },
        { id: 'nenhuma', label: 'Sem autenticação' },
      ],
      neutralIndex: 1,
      goodIndex: 0,
    },
  });

  it('extrapolates a below-Neutro level past zero rather than clamping it', () => {
    // Bom sits one index above Neutro, so the third level is one equal step
    // below — genuinely worse than Neutro, which is what negative values mean.
    // The ruler's domain stretches to show it instead of pinning it to an edge.
    const v = defaultLevelValues(midAnchor());
    expect(v.nenhuma).toBe(-100);
  });

  it('still pins the anchors and keeps the descriptor order strict', () => {
    const v = defaultLevelValues(midAnchor());
    expect(v.basica).toBe(0);
    expect(v.forte).toBe(100);
    expect(v.forte).toBeGreaterThan(v.basica);
    expect(v.basica).toBeGreaterThan(v.nenhuma);
  });

  it('derives a consistent scale from the clamped seed', async () => {
    const c = midAnchor();
    const matrix: JudgmentMatrix = {
      id: 'm', kind: 'scale', criterionId: 'c', assessorId: 'a', updatedAt: '',
      judgments: judgmentsFromLevelValues(c, defaultLevelValues(c)),
    };
    const scale = await deriveScale('c', c.descriptor, matrix);
    expect(scale.consistencyMargin).toBeGreaterThan(0);
    const val = (id: string) => scale.values.find((x) => x.levelId === id)!.value;
    expect(val('basica')).toBe(0);
    expect(val('forte')).toBe(100);
    expect(val('nenhuma')).toBeLessThan(0); // genuinely worse than Neutro
  });
});
