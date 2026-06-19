/**
 * Two-tier MACBETH aggregation over an Evaluation.
 *
 * Tier 1 (Gate): binary pass/fail — any fail vetos the proposal upstream.
 * Tier 2 (Qualification): additive model V(p) = Σᵢ kᵢ · vᵢ(p), scale [0,100].
 *
 * Proposals may score on a discrete level OR a continuous position (read from
 * the smooth value curve). The global value is then classified by the model's
 * decision scale (N named bands) rather than fixed thresholds.
 */

import type {
  Evaluation,
  EvaluationModel,
  OptionResult,
  AggregationResult,
  GateResult,
  GateVerdict,
} from '../domain/types';
import { classify } from '../domain/decision';
import { scoreAtPosition } from './scaling';

/**
 * Global value V(p) of a *reference alternative* described by one performance
 * level per qualification criterion (`criterionId -> levelId`). Uses the model's
 * derived scales and weights — the same additive model as `aggregate` — so the
 * result is the MACBETH global impact of that profile. Used to turn a decision
 * reference profile into a band cut-off on the [0,100] axis.
 *
 * Returns null when the model has no weights yet (cut-off cannot be derived).
 */
export function scoreProfile(
  model: EvaluationModel,
  performances: Record<string, string>,
): number | null {
  const scaleMap = new Map(model.derivedScales.map((s) => [s.criterionId, s]));
  const weightMap = new Map((model.weights?.weights ?? []).map((w) => [w.criterionId, w.weight]));

  let weightedSum = 0;
  let totalWeight = 0;
  for (const [critId, crit] of Object.entries(model.valueTree.criteria)) {
    if (crit.type !== 'qualification') continue;
    const scale = scaleMap.get(critId);
    const levelId = performances[critId];
    if (!scale || !levelId) continue;
    const sv = scale.values.find((v) => v.levelId === levelId);
    if (!sv) continue;
    const w = weightMap.get(critId) ?? 0;
    weightedSum += w * sv.value;
    totalWeight += w;
  }
  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : null;
}

export function aggregate(evaluation: Evaluation): AggregationResult {
  const { model, options, performances } = evaluation;
  const { valueTree, derivedScales, weights, decisionScale } = model;
  const { criteria } = valueTree;

  const perfMap = new Map<string, Map<string, { value: string; position?: number }>>();
  for (const p of performances) {
    if (!perfMap.has(p.optionId)) perfMap.set(p.optionId, new Map());
    perfMap.get(p.optionId)!.set(p.criterionId, { value: p.value, position: p.position });
  }

  const scaleMap = new Map(derivedScales.map((s) => [s.criterionId, s]));
  const weightMap = new Map(
    (weights?.weights ?? []).map((w) => [w.criterionId, w.weight]),
  );

  const optionResults: OptionResult[] = options.map((option) => {
    const perf = perfMap.get(option.id) ?? new Map<string, { value: string; position?: number }>();
    const gateResults: GateResult[] = [];
    let rejectedByGate: string | undefined;
    let vetoedByCriterion: string | undefined;

    // ── Tier 1: Gate checks ─────────────────────────────────────────────
    for (const [critId, crit] of Object.entries(criteria)) {
      if (crit.type !== 'gate') continue;
      const val = perf.get(critId)?.value ?? 'pending';
      const verdict: GateVerdict =
        val === 'pass' ? 'pass' : val === 'fail' ? 'fail' : 'pending';
      gateResults.push({ criterionId: critId, optionId: option.id, verdict });
      if (verdict === 'fail' && !rejectedByGate) rejectedByGate = critId;
    }

    if (rejectedByGate) {
      return {
        optionId: option.id,
        globalValue: null,
        bandId: null,
        hardRejected: true,
        gateResults,
        criterionScores: {},
        rejectedByGate,
      };
    }

    // ── Tier 2: MACBETH qualification ────────────────────────────────────
    const criterionScores: Record<string, number | null> = {};
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [critId, crit] of Object.entries(criteria)) {
      if (crit.type !== 'qualification') continue;

      const entry = perf.get(critId);
      const scale = scaleMap.get(critId);
      const w = weightMap.get(critId) ?? 0;

      if (!entry || !scale) {
        criterionScores[critId] = null;
        continue;
      }

      let score: number | null = null;
      if (entry.position != null) {
        // Continuous performance — read from the smooth curve.
        score = scoreAtPosition(crit.descriptor, scale, entry.position);
      } else if (entry.value) {
        // Discrete level.
        score = scale.values.find((v) => v.levelId === entry.value)?.value ?? null;
      }

      if (score === null) {
        criterionScores[critId] = null;
        continue;
      }

      criterionScores[critId] = score;

      if (crit.vetoLevelId) {
        const vetoSv = scale.values.find((v) => v.levelId === crit.vetoLevelId);
        if (vetoSv && score < vetoSv.value && !vetoedByCriterion) {
          vetoedByCriterion = critId;
        }
      }

      weightedSum += w * score;
      totalWeight += w;
    }

    if (vetoedByCriterion) {
      return {
        optionId: option.id,
        globalValue: null,
        bandId: null,
        hardRejected: true,
        gateResults,
        criterionScores,
        vetoedByCriterion,
      };
    }

    const globalValue =
      totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : null;

    const band = globalValue !== null ? classify(globalValue, decisionScale) : null;

    return {
      optionId: option.id,
      globalValue,
      bandId: band?.id ?? null,
      hardRejected: false,
      gateResults,
      criterionScores,
    };
  });

  return {
    optionResults,
    decisionScale,
    computedAt: new Date().toISOString(),
  };
}
