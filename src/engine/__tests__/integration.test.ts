import { describe, it, expect } from 'vitest';
import { deriveScale } from '../scaling';
import { deriveWeights, ALL_NEUTRAL } from '../weighting';
import { aggregate } from '../aggregation';
import { computeSensitivity } from '../sensitivity';
import type {
  EvaluationModel,
  Evaluation,
  JudgmentMatrix,
  MacbethJudgment,
  DecisionBand,
} from '../../domain/types';
import { MODEL_VERSION, DEFAULT_ASSESSOR_ID } from '../../domain/types';
import { classify } from '../../domain/decision';

const j = (category: 0 | 1 | 2 | 3 | 4 | 5 | 6): MacbethJudgment => ({ kind: 'exact', category });

/**
 * End-to-end smoke test of the full decision pipeline — the exact engine calls
 * the UI makes — exercised without a browser (browser binaries are blocked by
 * the sandbox egress policy):
 *
 *   build model → derive scales (GLPK) → derive weights (GLPK) →
 *   apply to proposals (discrete + continuous performances) → aggregate →
 *   classify by decision bands → sensitivity.
 */
describe('end-to-end decision pipeline', () => {
  it('runs the whole create→apply flow and classifies proposals correctly', async () => {
    // ── 1. Build the model (criteria + descriptors) ────────────────────────
    // q1: discrete quality, levels A>B>C (Neutro=C, Bom=A)
    // q2: continuous cost,  levels X>Y>Z (Neutro=Z, Bom=X)
    const model: EvaluationModel = {
      kind: 'model',
      id: 'm1',
      modelVersion: MODEL_VERSION,
      label: 'Modelo de teste',
      createdAt: '',
      updatedAt: '',
      valueTree: {
        root: {
          criterionId: 'root',
          children: [
            { criterionId: 'g1', children: [] },
            { criterionId: 'q1', children: [] },
            { criterionId: 'q2', children: [] },
          ],
        },
        criteria: {
          g1: { id: 'g1', label: 'Orçamento (porta)', type: 'gate' },
          q1: {
            id: 'q1',
            label: 'Qualidade',
            type: 'qualification',
            descriptor: {
              levels: [
                { id: 'A', label: 'Excelente' },
                { id: 'B', label: 'Bom' },
                { id: 'C', label: 'Fraco' },
              ],
              neutralIndex: 2,
              goodIndex: 0,
            },
          },
          q2: {
            id: 'q2',
            label: 'Custo',
            type: 'qualification',
            continuous: true,
            descriptor: {
              levels: [
                { id: 'X', label: 'Baixo' },
                { id: 'Y', label: 'Médio' },
                { id: 'Z', label: 'Alto' },
              ],
              neutralIndex: 2,
              goodIndex: 0,
            },
          },
        },
      },
      judgmentMatrices: [],
      derivedScales: [],
      decisionScale: [],
    };

    // ── 2. Derive value scales via GLPK ────────────────────────────────────
    const scaleMatrix = (criterionId: string, judgments: Record<string, MacbethJudgment>): JudgmentMatrix => ({
      id: `s-${criterionId}`,
      kind: 'scale',
      criterionId,
      assessorId: DEFAULT_ASSESSOR_ID,
      judgments,
      updatedAt: '',
    });

    const q1 = model.valueTree.criteria.q1;
    const q2 = model.valueTree.criteria.q2;
    if (q1.type !== 'qualification' || q2.type !== 'qualification') throw new Error('bad');

    const scaleQ1 = await deriveScale('q1', q1.descriptor, scaleMatrix('q1', {
      A__B: j(3), // Excelente vs Bom = Moderada
      B__C: j(3), // Bom vs Fraco = Moderada
      A__C: j(5), // Excelente vs Fraco = Muito forte (largest gap)
    }));
    const scaleQ2 = await deriveScale('q2', q2.descriptor, scaleMatrix('q2', {
      X__Y: j(3),
      Y__Z: j(3),
      X__Z: j(5),
    }));

    // Anchors and ordering must hold
    for (const [scale, neutral, good] of [
      [scaleQ1, 'C', 'A'],
      [scaleQ2, 'Z', 'X'],
    ] as const) {
      const v = (id: string) => scale.values.find((s) => s.levelId === id)!.value;
      expect(v(neutral)).toBeCloseTo(0, 5);
      expect(v(good)).toBeCloseTo(100, 5);
      expect(scale.consistencyMargin).toBeGreaterThan(0);
    }
    expect(scaleQ1.values.find((s) => s.levelId === 'B')!.value).toBeGreaterThan(0);
    expect(scaleQ1.values.find((s) => s.levelId === 'B')!.value).toBeLessThan(100);
    model.derivedScales = [scaleQ1, scaleQ2];

    // ── 3. Derive weights via GLPK (q1 preferred over q2) ──────────────────
    const weights = await deriveWeights(['q1', 'q2'], {
      [`q1__q2`]: j(2),
      [`q1__${ALL_NEUTRAL}`]: j(4),
      [`q2__${ALL_NEUTRAL}`]: j(2),
    });
    expect(weights.weights.reduce((s, w) => s + w.weight, 0)).toBeCloseTo(1, 5);
    const wq1 = weights.weights.find((w) => w.criterionId === 'q1')!.weight;
    const wq2 = weights.weights.find((w) => w.criterionId === 'q2')!.weight;
    expect(wq1).toBeGreaterThan(wq2);
    model.weights = weights;

    // ── 4. Decision scale (3 named bands) ──────────────────────────────────
    const bands: DecisionBand[] = [
      { id: 'aprovar', label: 'Aprovar', minScore: 70, color: '#16a34a' },
      { id: 'condicionado', label: 'Aprovar condicionado', minScore: 40, color: '#d97706' },
      { id: 'reprovar', label: 'Reprovar', minScore: 0, color: '#dc2626' },
    ];
    model.decisionScale = bands;

    // ── 5. Apply the model to proposals ────────────────────────────────────
    const evaluation: Evaluation = {
      kind: 'evaluation',
      id: 'e1',
      modelVersion: MODEL_VERSION,
      label: 'Avaliação de teste',
      createdAt: '',
      updatedAt: '',
      model,
      options: [
        { id: 'P1', label: 'Ótima', createdAt: '2026-01-01' },
        { id: 'P2', label: 'Fraca', createdAt: '2026-01-01' },
        { id: 'P3', label: 'Inelegível', createdAt: '2026-01-01' },
        { id: 'P4', label: 'Intermédia', createdAt: '2026-01-01' },
      ],
      performances: [
        // P1: passes gate, best on q1, best (continuous pos=1) on q2
        { optionId: 'P1', criterionId: 'g1', value: 'pass' },
        { optionId: 'P1', criterionId: 'q1', value: 'A' },
        { optionId: 'P1', criterionId: 'q2', value: 'X', position: 1 },
        // P2: passes gate, worst on q1, worst (pos=0) on q2
        { optionId: 'P2', criterionId: 'g1', value: 'pass' },
        { optionId: 'P2', criterionId: 'q1', value: 'C' },
        { optionId: 'P2', criterionId: 'q2', value: 'Z', position: 0 },
        // P3: fails the gate → hard reject
        { optionId: 'P3', criterionId: 'g1', value: 'fail' },
        { optionId: 'P3', criterionId: 'q1', value: 'A' },
        { optionId: 'P3', criterionId: 'q2', value: 'X', position: 1 },
        // P4: passes gate, mid on q1, continuous mid (pos=0.5) on q2
        { optionId: 'P4', criterionId: 'g1', value: 'pass' },
        { optionId: 'P4', criterionId: 'q1', value: 'B' },
        { optionId: 'P4', criterionId: 'q2', value: 'Y', position: 0.5 },
      ],
    };

    // ── 6. Aggregate and verify the decisions ──────────────────────────────
    const result = aggregate(evaluation);
    const byId = new Map(result.optionResults.map((r) => [r.optionId, r]));

    const p1 = byId.get('P1')!;
    const p2 = byId.get('P2')!;
    const p3 = byId.get('P3')!;
    const p4 = byId.get('P4')!;

    // P3 hard-rejected at the gate, no score
    expect(p3.hardRejected).toBe(true);
    expect(p3.rejectedByGate).toBe('g1');
    expect(p3.globalValue).toBeNull();

    // P1 best → ~100 → Aprovar
    expect(p1.globalValue).toBeCloseTo(100, 0);
    expect(p1.bandId).toBe('aprovar');

    // P2 worst → ~0 → Reprovar
    expect(p2.globalValue).toBeCloseTo(0, 0);
    expect(p2.bandId).toBe('reprovar');

    // P4 intermediate, strictly between the extremes
    expect(p4.globalValue).toBeGreaterThan(0);
    expect(p4.globalValue).toBeLessThan(100);

    // Continuous scoring on q2: P4's q2 score read from the smooth curve (pos 0.5)
    expect(p4.criterionScores.q2).toBeGreaterThan(0);
    expect(p4.criterionScores.q2).toBeLessThan(100);

    // Decision-band classification helper agrees with the engine
    expect(classify(p1.globalValue!, bands)?.id).toBe('aprovar');
    expect(classify(p4.globalValue!, bands)?.id).toBe(p4.bandId);

    // Ranking: P1 > P4 > P2 (P3 excluded)
    const ranked = result.optionResults
      .filter((r) => !r.hardRejected)
      .sort((a, b) => (b.globalValue ?? -Infinity) - (a.globalValue ?? -Infinity))
      .map((r) => r.optionId);
    expect(ranked).toEqual(['P1', 'P4', 'P2']);

    // ── 7. Sensitivity runs over the evaluation ────────────────────────────
    const scenario = computeSensitivity(evaluation, 'q1', 11);
    expect(scenario.points).toHaveLength(11);
    expect(scenario.points[0].optionValues.P1).toBeDefined();
  });
});
