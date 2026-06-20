/**
 * Sensitivity analysis: vary one criterion's weight from 0→1 *within its own
 * group*, redistributing the remaining weight proportionally to its siblings,
 * then re-aggregate the whole hierarchy. For a flat model the group is the root,
 * so this reduces to the classic single-level sensitivity.
 */

import type { Evaluation, SensitivityScenario, SensitivityPoint, Weights } from '../domain/types';
import { aggregate } from './aggregation';
import { parentOf, weightsForGroup, setGroupWeights } from '../domain/tree';

export function computeSensitivity(
  evaluation: Evaluation,
  variedCriterionId: string,
  steps = 21,
): SensitivityScenario {
  const model = evaluation.model;
  const parentId = parentOf(model.valueTree, variedCriterionId);
  const groupWeights = parentId ? weightsForGroup(model, parentId) : undefined;
  const weights = groupWeights?.weights ?? [];

  // Criterion not part of a weighted group (e.g. lone child) — nothing to vary.
  if (!parentId || weights.length === 0) {
    return { variedCriterionId, points: [], rankingChangePoints: [] };
  }

  const otherWeights = weights.filter((w) => w.criterionId !== variedCriterionId);
  const otherTotal = otherWeights.reduce((s, w) => s + w.weight, 0);

  const points: SensitivityPoint[] = [];
  const rankingChangePoints: number[] = [];
  let prevRanking: string[] | null = null;

  for (let step = 0; step < steps; step++) {
    const wVal = step / (steps - 1);

    const newWeights = weights.map((w) => {
      if (w.criterionId === variedCriterionId) return { ...w, weight: wVal };
      const scale = otherTotal > 0 ? (1 - wVal) / otherTotal : 0;
      return { ...w, weight: w.weight * scale };
    });

    const nextGroup: Weights = { ...(groupWeights as Weights), weights: newWeights };
    const modified: Evaluation = {
      ...evaluation,
      model: { ...model, ...setGroupWeights(model, parentId, nextGroup) },
    };

    const result = aggregate(modified);
    const optionValues: Record<string, number> = {};
    for (const or of result.optionResults) {
      optionValues[or.optionId] = or.globalValue ?? 0;
    }

    const ranking = Object.entries(optionValues)
      .sort(([, a], [, b]) => b - a)
      .map(([id]) => id);

    if (prevRanking !== null) {
      const changed = ranking.some((id, i) => id !== prevRanking![i]);
      if (changed) rankingChangePoints.push(wVal);
    }
    prevRanking = ranking;

    points.push({ weightValue: wVal, optionValues });
  }

  return { variedCriterionId, points, rankingChangePoints };
}
