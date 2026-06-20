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
  ValueTreeNode,
  QualificationCriterion,
  DecisionBand,
} from '../domain/types';
import { ROOT_ID } from '../domain/types';
import { classify } from '../domain/decision';
import { weightsForGroup } from '../domain/tree';
import { scoreAtPosition } from './scaling';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A function giving the value of a qualification leaf, or null if unscored. */
type LeafScore = (criterionId: string, crit: QualificationCriterion) => number | null;

/**
 * Recursively aggregate the value tree under the additive MACBETH model.
 *
 * Leaf qualification criteria are scored by `leafScore`; composite (and root)
 * nodes are the weighted average of their non-gate children using the group's
 * weights (`model.weights` for root, `model.subWeights[id]` for composites).
 * Gate criteria do not contribute to the value (handled separately as Tier 1).
 *
 * Returns the global V(p) plus the value of every internal/leaf node (useful
 * for showing composite-factor scores), all on the [0,100] scale.
 */
export function treeValue(
  model: EvaluationModel,
  leafScore: LeafScore,
): { global: number | null; nodeScores: Record<string, number | null> } {
  const { criteria } = model.valueTree;
  const nodeScores: Record<string, number | null> = {};

  function visit(node: ValueTreeNode): number | null {
    const id = node.criterionId;
    const crit = id === ROOT_ID ? undefined : criteria[id];

    if (crit?.type === 'gate') return null; // not part of the value
    if (crit?.type === 'qualification') {
      const s = leafScore(id, crit);
      nodeScores[id] = s;
      return s;
    }

    // Root or composite — weighted average of non-gate children.
    const w = weightsForGroup(model, id);
    const wmap = new Map((w?.weights ?? []).map((x) => [x.criterionId, x.weight]));
    const nonGate = node.children.filter((c) => criteria[c.criterionId]?.type !== 'gate');

    let weightedSum = 0;
    let totalWeight = 0;
    for (const child of nonGate) {
      const v = visit(child);
      if (v === null) continue;
      // A single-child group weights its lone child at 1 (trivially 100%).
      const cw = nonGate.length === 1 ? 1 : wmap.get(child.criterionId) ?? 0;
      weightedSum += cw * v;
      totalWeight += cw;
    }
    const val = totalWeight > 0 ? weightedSum / totalWeight : null;
    if (id !== ROOT_ID) nodeScores[id] = val;
    return val;
  }

  const global = visit(model.valueTree.root);
  return { global, nodeScores };
}

/**
 * Global value V(p) of a *reference alternative* described by one performance
 * level per qualification criterion (`criterionId -> levelId`). Uses the model's
 * derived scales and weights — the same additive model as `aggregate` — so the
 * result is the MACBETH global impact of that profile (across the full
 * hierarchy). Used to turn a decision reference profile into a band cut-off on
 * the [0,100] axis.
 *
 * Returns null when the model has no weights yet (cut-off cannot be derived).
 */
export function scoreProfile(
  model: EvaluationModel,
  performances: Record<string, string>,
): number | null {
  const scaleMap = new Map(model.derivedScales.map((s) => [s.criterionId, s]));
  const leafScore: LeafScore = (critId) => {
    const scale = scaleMap.get(critId);
    const levelId = performances[critId];
    if (!scale || !levelId) return null;
    return scale.values.find((v) => v.levelId === levelId)?.value ?? null;
  };
  const { global } = treeValue(model, leafScore);
  return global === null ? null : round2(global);
}

/**
 * Resolve every decision band's *effective* lower cut-off. A band with a
 * `referenceProfile` derives its cut-off from that profile's global V(p)
 * (recomputed live from the current scales + weights); a band without one keeps
 * its typed `minScore`. A profile that does not cover all qualification criteria
 * is incomplete — we fall back to the cached `minScore` rather than silently
 * averaging over a subset. Pure: never mutates the model.
 */
export function resolveBands(model: EvaluationModel): DecisionBand[] {
  const qualIds = Object.values(model.valueTree.criteria)
    .filter((c) => c.type === 'qualification')
    .map((c) => c.id);
  return model.decisionScale.map((b) => {
    if (!b.referenceProfile) return b;
    const complete = qualIds.every((id) => b.referenceProfile![id]);
    if (!complete) return b;
    const s = scoreProfile(model, b.referenceProfile);
    return s == null ? b : { ...b, minScore: s };
  });
}

export function aggregate(evaluation: Evaluation): AggregationResult {
  const { model, options, performances } = evaluation;
  const { valueTree, derivedScales } = model;
  const decisionScale = resolveBands(model);
  const { criteria } = valueTree;

  const perfMap = new Map<string, Map<string, { value: string; position?: number }>>();
  for (const p of performances) {
    if (!perfMap.has(p.optionId)) perfMap.set(p.optionId, new Map());
    perfMap.get(p.optionId)!.set(p.criterionId, { value: p.value, position: p.position });
  }

  const scaleMap = new Map(derivedScales.map((s) => [s.criterionId, s]));

  const optionResults: OptionResult[] = options.map((option) => {
    const perf = perfMap.get(option.id) ?? new Map<string, { value: string; position?: number }>();
    const gateResults: GateResult[] = [];
    let rejectedByGate: string | undefined;

    // ── Tier 1: Gate checks (gates may sit anywhere in the tree) ─────────
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

    // ── Tier 2: MACBETH qualification (recursive over the hierarchy) ─────
    const leafScore: LeafScore = (critId, crit) => {
      const entry = perf.get(critId);
      const scale = scaleMap.get(critId);
      if (!entry || !scale) return null;
      if (entry.position != null) {
        // Continuous performance — read from the smooth curve.
        return scoreAtPosition(crit.descriptor, scale, entry.position);
      }
      if (entry.value) {
        // Discrete level.
        return scale.values.find((v) => v.levelId === entry.value)?.value ?? null;
      }
      return null;
    };

    const { global, nodeScores } = treeValue(model, leafScore);

    // Veto: a qualification leaf scoring below its veto level rejects upstream.
    let vetoedByCriterion: string | undefined;
    for (const [critId, crit] of Object.entries(criteria)) {
      if (crit.type !== 'qualification' || !crit.vetoLevelId) continue;
      const score = nodeScores[critId];
      if (score == null) continue;
      const vetoSv = scaleMap.get(critId)?.values.find((v) => v.levelId === crit.vetoLevelId);
      if (vetoSv && score < vetoSv.value) {
        vetoedByCriterion = critId;
        break;
      }
    }

    if (vetoedByCriterion) {
      return {
        optionId: option.id,
        globalValue: null,
        bandId: null,
        hardRejected: true,
        gateResults,
        criterionScores: nodeScores,
        vetoedByCriterion,
      };
    }

    const globalValue = global === null ? null : round2(global);
    const band = globalValue !== null ? classify(globalValue, decisionScale) : null;

    return {
      optionId: option.id,
      globalValue,
      bandId: band?.id ?? null,
      hardRejected: false,
      gateResults,
      criterionScores: nodeScores,
    };
  });

  return {
    optionResults,
    decisionScale,
    computedAt: new Date().toISOString(),
  };
}
