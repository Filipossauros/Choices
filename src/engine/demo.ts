/**
 * Solving the example model.
 *
 * `buildDemoSkeleton` ships structure and judgments; this runs the same LPs the
 * app runs when a user answers those judgments by hand. Nothing here writes a
 * scale value or a weight directly — if the solver cannot find one, the example
 * loads without it and says so, which is the honest outcome and also the one
 * that would expose a broken engine.
 */

import type { EvaluationModel, QualificationCriterion } from '../domain/types';
import { buildDemoSkeleton } from '../domain/demoModel';
import { qualificationCriteria, weightingGroups, setGroupWeights } from '../domain/tree';
import { deriveScale } from './scaling';
import { deriveWeights } from './weighting';
import { resolveBands } from './aggregation';

export interface DemoBuildResult {
  model: EvaluationModel;
  /** Criteria whose scale did not solve consistently, by label. */
  unsolvedScales: string[];
  /** Weighting groups that did not solve consistently, by label. */
  unsolvedGroups: string[];
}

/**
 * Build the example and derive everything the engine can derive.
 *
 * Scales first, then weights, then the decision cut-offs — in that order,
 * because a band's cut-off is the global value of its reference profile and
 * that value does not exist until both of the others do.
 */
export async function buildDemoModel(): Promise<DemoBuildResult> {
  const skeleton = buildDemoSkeleton();
  const unsolvedScales: string[] = [];
  const unsolvedGroups: string[] = [];

  const leaves = qualificationCriteria(skeleton);
  const scales = await Promise.all(
    leaves.map(async (crit: QualificationCriterion) => {
      const matrix = skeleton.judgmentMatrices.find(
        (m) => m.kind === 'scale' && m.criterionId === crit.id,
      );
      if (!matrix) return null;
      const scale = await deriveScale(crit.id, crit.descriptor, matrix);
      if (scale.consistencyMargin <= 0) unsolvedScales.push(crit.label);
      return scale;
    }),
  );

  let model: EvaluationModel = {
    ...skeleton,
    derivedScales: scales.filter((s): s is NonNullable<typeof s> => s != null),
  };

  // Weights are per group and each group's LP is independent, but the patches
  // are folded one at a time: `setGroupWeights` reads `subWeights` off the
  // model it is given, so applying them from a stale snapshot would keep only
  // the last group.
  for (const group of weightingGroups(model)) {
    if (group.childIds.length < 2) continue;
    const matrix = model.judgmentMatrices.find(
      (m) => m.kind === 'weighting' && m.criterionId === group.parentId,
    );
    if (!matrix) continue;
    const weights = await deriveWeights(group.childIds, matrix.judgments);
    if (weights.consistencyMargin <= 0) {
      unsolvedGroups.push(model.valueTree.criteria[group.parentId]?.label ?? 'Critérios de topo');
    }
    model = {
      ...model,
      ...setGroupWeights(model, group.parentId, {
        ...weights,
        provenance: 'elicited',
        confirmed: true,
      }),
    };
  }

  // Bands carrying a reference profile get their cut-off from that profile's
  // global value. `resolveBands` computes it live; storing it keeps the model
  // self-consistent for anything that reads `minScore` directly.
  model = { ...model, decisionScale: resolveBands(model) };

  return { model, unsolvedScales, unsolvedGroups };
}
