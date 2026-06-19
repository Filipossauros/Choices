/**
 * Sensitivity analysis: vary one criterion's weight from 0→1,
 * redistributing remaining weight proportionally to other criteria.
 */

import type { Evaluation, SensitivityScenario, SensitivityPoint } from '../domain/types';
import { aggregate } from './aggregation';

export function computeSensitivity(
  evaluation: Evaluation,
  variedCriterionId: string,
  steps = 21,
): SensitivityScenario {
  const weights = evaluation.model.weights?.weights ?? [];
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

    const modified: Evaluation = {
      ...evaluation,
      model: {
        ...evaluation.model,
        weights: { ...evaluation.model.weights!, weights: newWeights },
      },
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
