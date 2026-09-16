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
  ValueTree,
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

/** True when the subtree under `node` contains at least one qualification leaf. */
function hasScorableLeaf(node: ValueTreeNode, criteria: ValueTree['criteria']): boolean {
  const crit = criteria[node.criterionId];
  if (crit?.type === 'qualification') return true;
  if (crit?.type === 'gate') return false;
  return node.children.some((c) => hasScorableLeaf(c, criteria));
}

/**
 * Recursively aggregate the value tree under the additive MACBETH model.
 *
 * Leaf qualification criteria are scored by `leafScore`; composite (and root)
 * nodes are the weighted average of their scorable children using the group's
 * weights (`model.weights` for root, `model.subWeights[id]` for composites).
 * Gate criteria do not contribute to the value (handled separately as Tier 1).
 *
 * **A group with an unscored descendant has no value at all.** Averaging over
 * the answered subset would renormalise the weights, so an option missing its
 * heaviest criterion would be scored on a lighter model than its peers and the
 * two numbers would not be comparable — while still looking like a ranking. The
 * unscored leaves come back in `missing` so the caller can say what to fill in.
 *
 * Renormalisation over *structure* is still fine and still happens: a factor
 * containing nothing but gates can never contribute, so it is excluded from its
 * group before the weights are applied. That exclusion is the same for every
 * option, which is exactly what makes it harmless.
 *
 * Returns the global V(p) plus the value of every internal/leaf node (useful
 * for showing composite-factor scores), all on the [0,100] scale.
 */
export function treeValue(
  model: EvaluationModel,
  leafScore: LeafScore,
): { global: number | null; nodeScores: Record<string, number | null>; missing: string[] } {
  const { criteria } = model.valueTree;
  const nodeScores: Record<string, number | null> = {};
  const missing: string[] = [];

  function visit(node: ValueTreeNode): number | null {
    const id = node.criterionId;
    const crit = id === ROOT_ID ? undefined : criteria[id];

    if (crit?.type === 'gate') return null; // not part of the value
    if (crit?.type === 'qualification') {
      const s = leafScore(id, crit);
      nodeScores[id] = s;
      if (s === null) missing.push(id);
      return s;
    }

    // Root or composite — weighted average of the children that can hold a value.
    const w = weightsForGroup(model, id);
    const wmap = new Map((w?.weights ?? []).map((x) => [x.criterionId, x.weight]));
    const scorable = node.children.filter((c) => hasScorableLeaf(c, criteria));

    let weightedSum = 0;
    let totalWeight = 0;
    let incomplete = false;
    for (const child of scorable) {
      // Visit every child even after one comes back null: `missing` is meant to
      // list everything still to answer, not just the first gap found.
      const v = visit(child);
      if (v === null) {
        incomplete = true;
        continue;
      }
      // A single-child group weights its lone child at 1 (trivially 100%).
      const cw = scorable.length === 1 ? 1 : wmap.get(child.criterionId) ?? 0;
      weightedSum += cw * v;
      totalWeight += cw;
    }
    const val = incomplete || totalWeight <= 0 ? null : weightedSum / totalWeight;
    if (id !== ROOT_ID) nodeScores[id] = val;
    return val;
  }

  const global = visit(model.valueTree.root);
  return { global, nodeScores, missing };
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
  const scaleMap = new Map(model.derivedScales.map((s) => [s.criterionId, s]));
  return model.decisionScale.map((b) => {
    if (!b.referenceProfile) return b;
    // Complete = every qualification criterion has a level AND that level still
    // resolves in the criterion's derived scale. A dead level id (level deleted
    // or scale re-derived) must count as incomplete, otherwise scoreProfile
    // would silently renormalize the weights over the remaining criteria.
    const complete = qualIds.every((id) => {
      const levelId = b.referenceProfile![id];
      return !!levelId && !!scaleMap.get(id)?.values.some((v) => v.levelId === levelId);
    });
    if (!complete) return b;
    const s = scoreProfile(model, b.referenceProfile);
    return s == null ? b : { ...b, minScore: s };
  });
}

/**
 * Detect decision bands whose live-resolved cut-offs invert the order implied
 * by their stored `minScore`s (the last state the user accepted). This happens
 * when scales or weights change after profiles were set: a nominally higher
 * band's profile can drop below a lower band's, and `classify` would silently
 * swap their meaning. Pairs whose stored cut-offs tie are skipped (that is the
 * near-collision case, warned separately).
 */
export function bandOrderConflicts(
  model: EvaluationModel,
): { higher: DecisionBand; lower: DecisionBand }[] {
  const resolved = resolveBands(model);
  const stored = model.decisionScale;
  const conflicts: { higher: DecisionBand; lower: DecisionBand }[] = [];
  for (let i = 0; i < stored.length; i++) {
    for (let j = i + 1; j < stored.length; j++) {
      const storedDiff = stored[i].minScore - stored[j].minScore;
      if (Math.abs(storedDiff) < 1e-9) continue;
      const resolvedDiff = resolved[i].minScore - resolved[j].minScore;
      if (storedDiff > 0 && resolvedDiff < 0) {
        conflicts.push({ higher: resolved[i], lower: resolved[j] });
      } else if (storedDiff < 0 && resolvedDiff > 0) {
        conflicts.push({ higher: resolved[j], lower: resolved[i] });
      }
    }
  }
  return conflicts;
}

/**
 * The lowest V(p) this model can produce — every criterion at its least
 * attractive level. Used to detect a decision zone that nothing can reach:
 * a band whose cut-off sits at or below this is named, coloured, and dead.
 * Null when the model cannot score at all yet.
 */
export function worstPossibleScore(model: EvaluationModel): number | null {
  const scaleMap = new Map(model.derivedScales.map((s) => [s.criterionId, s]));
  const { global } = treeValue(model, (critId, crit) => {
    const scale = scaleMap.get(critId);
    if (!scale) return null;
    const worstId = crit.descriptor.levels[crit.descriptor.levels.length - 1]?.id;
    return scale.values.find((v) => v.levelId === worstId)?.value ?? null;
  });
  return global === null ? null : round2(global);
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

    const { global, nodeScores, missing } = treeValue(model, leafScore);

    // Veto: a qualification leaf scoring below its veto level rejects upstream.
    // Checked before completeness: a triggered veto is decisive on its own, so
    // an option can be rejected without every other criterion being answered.
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

    // Unanswered gates make the classification provisional — any of them
    // failing later would hard-reject the option regardless of its score.
    const pendingGates = gateResults
      .filter((g) => g.verdict === 'pending')
      .map((g) => g.criterionId);

    // Unscored qualification criteria mean no value at all, not a partial one.
    if (missing.length > 0) {
      return {
        optionId: option.id,
        globalValue: null,
        bandId: null,
        hardRejected: false,
        gateResults,
        criterionScores: nodeScores,
        missingCriteria: missing,
        ...(pendingGates.length > 0 ? { pendingGates } : {}),
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
      ...(pendingGates.length > 0 ? { pendingGates } : {}),
    };
  });

  return {
    optionResults,
    decisionScale,
    computedAt: new Date().toISOString(),
  };
}
