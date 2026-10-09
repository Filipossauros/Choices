/**
 * The model, said out loud.
 *
 * Weighting ends with a set of percentages and an admissible range. Neither is
 * something a person can check against what they believe: nobody knows whether
 * 58% is their opinion. What they can check is a sentence ("segurança conta mais
 * do que tudo o resto junto") and a choice ("entre estas duas propostas, eu
 * escolhia a primeira"). This module turns the weights into both, so the step
 * can end with the respondent agreeing to something with content rather than
 * dismissing a banner.
 *
 * Everything here needs only the weights. Swing weighting fixes Neutro = 0 and
 * Bom = 100 on every criterion by construction, so the global value of an
 * alternative that is Bom on a set of leaves and Neutro on the rest is just
 * 100 × the sum of those leaves' global weights — no derived scales required,
 * which is what lets the check run at the end of this step rather than three
 * steps later.
 *
 * Claims are returned as data, not prose: the wording lives in the UI so it can
 * be translated and so the engine stays testable.
 */
import type { EvaluationModel } from '../domain/types';
import { ROOT_ID } from '../domain/types';
import { effectiveWeights, weightsForGroup, weightingGroups } from '../domain/tree';

export interface WeightedLeaf {
  criterionId: string;
  label: string;
  /** Global weight: the product of group weights down to this leaf. Sums to ~1. */
  weight: number;
  neutralLabel: string;
  goodLabel: string;
}

/** Qualification leaves with their global weight, heaviest first. */
export function weightedLeaves(model: EvaluationModel): WeightedLeaf[] {
  const { criteria } = model.valueTree;
  const out: WeightedLeaf[] = [];
  for (const [criterionId, weight] of effectiveWeights(model)) {
    const crit = criteria[criterionId];
    if (crit?.type !== 'qualification') continue;
    const { levels, neutralIndex, goodIndex } = crit.descriptor;
    out.push({
      criterionId,
      label: crit.label,
      weight,
      neutralLabel: levels[neutralIndex]?.label ?? '',
      goodLabel: levels[goodIndex]?.label ?? '',
    });
  }
  return out.sort((a, b) => b.weight - a.weight);
}

export type Claim =
  /** One child of a group outweighs all of its siblings put together. */
  | { kind: 'dominates'; groupId: string; groupLabel: string | null; winner: string; others: string[]; winnerPct: number; othersPct: number }
  /** One child is worth roughly N times another within the same group. */
  | { kind: 'ratio'; groupId: string; groupLabel: string | null; a: string; b: string; times: number }
  /** A leaf that barely moves the result at all. */
  | { kind: 'negligible'; criterionId: string; label: string; pct: number }
  /** Where a proposal lands when it is Bom everywhere except the heaviest leaf. */
  | { kind: 'ceiling'; criterionId: string; label: string; score: number };

const pct = (w: number) => Math.round(w * 100);

/** Children of one weighting group, with that group's local weights. */
function groupChildren(model: EvaluationModel, parentId: string) {
  const { criteria } = model.valueTree;
  const w = weightsForGroup(model, parentId);
  if (!w) return [];
  return w.weights
    .map((x) => ({ id: x.criterionId, label: criteria[x.criterionId]?.label ?? x.criterionId, weight: x.weight }))
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Up to four statements the respondent can accept or reject, strongest first.
 * Returns nothing while the model has no weights — there is nothing to claim.
 */
export function weightClaims(model: EvaluationModel): Claim[] {
  const { criteria } = model.valueTree;
  const groupClaims: Claim[] = [];
  const groups = weightingGroups(model).filter((g) => g.childIds.length > 1);

  for (const group of groups) {
    const children = groupChildren(model, group.parentId);
    if (children.length < 2) continue;
    const groupLabel = group.parentId === ROOT_ID ? null : criteria[group.parentId]?.label ?? null;
    const [top, second] = children;
    const rest = children.slice(1);
    const restSum = rest.reduce((s, c) => s + c.weight, 0);

    if (top.weight > restSum && rest.length > 0) {
      groupClaims.push({
        kind: 'dominates',
        groupId: group.parentId,
        groupLabel,
        winner: top.label,
        others: rest.map((c) => c.label),
        winnerPct: pct(top.weight),
        othersPct: pct(restSum),
      });
    } else if (second && second.weight > 0 && top.weight / second.weight >= 1.5) {
      groupClaims.push({
        kind: 'ratio',
        groupId: group.parentId,
        groupLabel,
        a: top.label,
        b: second.label,
        times: Math.round((top.weight / second.weight) * 10) / 10,
      });
    }
  }

  // Two group claims at most: a third "X outweighs Y" in a row reads as the same
  // sentence again and stops being read, which defeats the point of saying it.
  const claims: Claim[] = groupClaims.slice(0, 2);

  const leaves = weightedLeaves(model);
  if (leaves.length === 0) return claims;

  const faintest = leaves[leaves.length - 1];
  if (leaves.length > 1 && faintest.weight > 0 && faintest.weight <= 0.05) {
    claims.push({ kind: 'negligible', criterionId: faintest.criterionId, label: faintest.label, pct: pct(faintest.weight) });
  }

  const heaviest = leaves[0];
  if (leaves.length > 1 && heaviest.weight > 0) {
    claims.push({
      kind: 'ceiling',
      criterionId: heaviest.criterionId,
      label: heaviest.label,
      score: Math.round((1 - heaviest.weight) * 100),
    });
  }

  return claims;
}

export interface Showdown {
  /** Bom here, Neutro everywhere else. */
  solo: WeightedLeaf;
  /** Bom on all of these, Neutro on `solo`. */
  rest: WeightedLeaf[];
  soloScore: number;
  restScore: number;
  /** Which side the model picks. `'tie'` within half a point. */
  winner: 'solo' | 'rest' | 'tie';
}

/**
 * The sharpest test the weights permit: everything riding on the heaviest
 * criterion against everything riding on all the others. A respondent who looks
 * at the two and disagrees with the verdict has found a wrong weight — which no
 * amount of staring at a percentage would have told them.
 */
export function weightShowdown(model: EvaluationModel): Showdown | null {
  const leaves = weightedLeaves(model).filter((l) => l.weight > 0);
  if (leaves.length < 2) return null;
  const [solo, ...rest] = leaves;
  const soloScore = Math.round(solo.weight * 1000) / 10;
  const restScore = Math.round(rest.reduce((s, l) => s + l.weight, 0) * 1000) / 10;
  const winner = Math.abs(soloScore - restScore) < 0.5 ? 'tie' : soloScore > restScore ? 'solo' : 'rest';
  return { solo, rest, soloScore, restScore, winner };
}
