/**
 * Two-tier MACBETH aggregation.
 *
 * Tier 1 (Gate): binary pass/fail — any fail vetos the proposal upstream.
 * Tier 2 (Qualification): additive model V(p) = Σᵢ kᵢ · vᵢ(p), scale [0,100].
 *
 * CONFORMITY MODULE EXTENSION POINT (deferred):
 *   The OptionResult shape is designed so that a future conformity module can
 *   compute ICO = U × Weight × Severity from criterionScores without changing
 *   the engine. Add it as a post-processing step on AggregationResult.
 */

import type {
  MacbethModel,
  OptionResult,
  AggregationResult,
  GateResult,
  OverallVerdict,
} from '../domain/types';

export function aggregate(model: MacbethModel): AggregationResult {
  const { valueTree, options, performances, derivedScales, weights } = model;
  const { criteria } = valueTree;

  const perfMap = new Map<string, Map<string, string>>();
  for (const p of performances) {
    if (!perfMap.has(p.optionId)) perfMap.set(p.optionId, new Map());
    perfMap.get(p.optionId)!.set(p.criterionId, p.value);
  }

  const scaleMap = new Map(derivedScales.map((s) => [s.criterionId, s]));
  const weightMap = new Map(
    (weights?.weights ?? []).map((w) => [w.criterionId, w.weight]),
  );

  const optionResults: OptionResult[] = options.map((option) => {
    const perf = perfMap.get(option.id) ?? new Map<string, string>();
    const gateResults: GateResult[] = [];
    let rejectedByGate: string | undefined;
    let vetoedByCriterion: string | undefined;

    // ── Tier 1: Gate checks ─────────────────────────────────────────────
    for (const [critId, crit] of Object.entries(criteria)) {
      if (crit.type !== 'gate') continue;
      const val = perf.get(critId) ?? 'pending';
      const verdict: GateVerdict =
        val === 'pass' ? 'pass' : val === 'fail' ? 'fail' : 'pending';
      gateResults.push({ criterionId: critId, optionId: option.id, verdict });
      if (verdict === 'fail' && !rejectedByGate) rejectedByGate = critId;
    }

    if (rejectedByGate) {
      return {
        optionId: option.id,
        globalValue: null,
        verdict: 'rejected',
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

      const levelId = perf.get(critId);
      const scale = scaleMap.get(critId);
      const w = weightMap.get(critId) ?? 0;

      if (!levelId || !scale) {
        criterionScores[critId] = null;
        continue;
      }

      const sv = scale.values.find((v) => v.levelId === levelId);
      if (!sv) {
        criterionScores[critId] = null;
        continue;
      }

      criterionScores[critId] = sv.value;

      if (crit.vetoLevelId) {
        const vetoSv = scale.values.find((v) => v.levelId === crit.vetoLevelId);
        if (vetoSv && sv.value < vetoSv.value && !vetoedByCriterion) {
          vetoedByCriterion = critId;
        }
      }

      weightedSum += w * sv.value;
      totalWeight += w;
    }

    if (vetoedByCriterion) {
      return {
        optionId: option.id,
        globalValue: null,
        verdict: 'rejected',
        gateResults,
        criterionScores,
        vetoedByCriterion,
      };
    }

    const globalValue =
      totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : null;

    let verdict: OverallVerdict = 'rejected';
    if (globalValue !== null) {
      if (globalValue >= model.approvedThreshold) verdict = 'approved';
      else if (globalValue >= model.conditionalThreshold) verdict = 'conditional';
    }

    return {
      optionId: option.id,
      globalValue,
      verdict,
      gateResults,
      criterionScores,
    };
  });

  return {
    optionResults,
    approvedThreshold: model.approvedThreshold,
    conditionalThreshold: model.conditionalThreshold,
    computedAt: new Date().toISOString(),
  };
}

type GateVerdict = 'pass' | 'fail' | 'pending';
