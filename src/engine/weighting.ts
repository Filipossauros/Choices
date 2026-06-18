/**
 * MACBETH swing-weighting.
 *
 * The weighting matrix compares fictitious reference options:
 *   - one per qualification criterion: Bom on that criterion, Neutro on all others
 *   - plus the all-Neutro option (weight = 0, the normalization anchor)
 *
 * The LP structure is identical to the consistency/scale LP,
 * with criterion ids as "alternatives" and the all-Neutro as the fixed anchor.
 *
 * After solving, raw weights are normalised to Σwᵢ = 1.
 *
 * MULTI-ASSESSOR EXTENSION POINT:
 *   Future aggregateAssessments(matrices: JudgmentMatrix[]): Weights
 *   would aggregate per-assessor weighting matrices before normalization.
 */

import type { Weights, CriterionWeight, MacbethJudgment } from '../domain/types';
import { solveLP, type LPConstraint, type LPBound } from './lp';
import { catLo, catHi } from './consistency';

export const ALL_NEUTRAL = 'all_neutral_ref';

function safeVar(id: string): string {
  return `w__${id.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

function sName(k: number): string {
  return `sw_${k}`;
}

export async function deriveWeights(
  criterionIds: string[],
  judgments: Record<string, MacbethJudgment>,
): Promise<Weights> {
  if (criterionIds.length === 0) {
    return { weights: [], consistencyMargin: 0, derivedAt: new Date().toISOString() };
  }

  const allIds = [...criterionIds, ALL_NEUTRAL];
  const constraints: LPConstraint[] = [];
  const bounds: LPBound[] = [];

  for (const id of allIds) {
    bounds.push({ name: safeVar(id), type: 'FR' });
  }
  for (let k = 1; k <= 6; k++) {
    bounds.push({ name: sName(k), type: 'FR' });
  }
  bounds.push({ name: 'z', type: 'LO', lb: 0 });

  // Anchor: all-Neutro = 0
  constraints.push({
    name: 'anchor_neutral',
    vars: [{ name: safeVar(ALL_NEUTRAL), coef: 1 }],
    type: 'EQ',
    rhs: 0,
  });

  // Normalization: Σ wᵢ = 1 (bounds the LP; weights extracted directly without re-scaling)
  constraints.push({
    name: 'normalization',
    vars: criterionIds.map((id) => ({ name: safeVar(id), coef: 1 })),
    type: 'EQ',
    rhs: 1,
  });

  // All criterion weights ≥ 0
  for (const id of criterionIds) {
    constraints.push({
      name: `nonneg_${safeVar(id)}`,
      vars: [{ name: safeVar(id), coef: 1 }],
      type: 'GE',
      rhs: 0,
    });
  }

  // Judgment constraints
  let idx = 0;
  for (const [key, jRaw] of Object.entries(judgments)) {
    const [idA, idB] = key.split('__');
    const judgment = jRaw as MacbethJudgment;
    const kLo = catLo(judgment);
    const kHi = catHi(judgment);
    const vA = safeVar(idA);
    const vB = safeVar(idB);

    if (kLo === 0 && kHi === 0) {
      constraints.push({
        name: `weq_${idx}`,
        vars: [
          { name: vA, coef: 1 },
          { name: vB, coef: -1 },
        ],
        type: 'EQ',
        rhs: 0,
      });
    } else {
      constraints.push({
        name: `wlb_${idx}`,
        vars: [
          { name: vA, coef: 1 },
          { name: vB, coef: -1 },
          { name: sName(kLo), coef: -1 },
          { name: 'z', coef: -1 },
        ],
        type: 'GE',
        rhs: 0,
      });
      if (kHi < 6) {
        constraints.push({
          name: `wub_${idx}`,
          vars: [
            { name: sName(kHi + 1), coef: 1 },
            { name: vA, coef: -1 },
            { name: vB, coef: 1 },
            { name: 'z', coef: -1 },
          ],
          type: 'GE',
          rhs: 0,
        });
      }
    }
    idx++;
  }

  // Threshold ordering
  for (let k = 1; k <= 5; k++) {
    constraints.push({
      name: `wthresh_${k}`,
      vars: [
        { name: sName(k + 1), coef: 1 },
        { name: sName(k), coef: -1 },
        { name: 'z', coef: -1 },
      ],
      type: 'GE',
      rhs: 0,
    });
  }
  constraints.push({
    name: 'wthresh_first',
    vars: [
      { name: sName(1), coef: 1 },
      { name: 'z', coef: -1 },
    ],
    type: 'GE',
    rhs: 0,
  });

  const result = await solveLP({
    name: 'weighting',
    direction: 'MAX',
    objective: [{ name: 'z', coef: 1 }],
    constraints,
    bounds,
  });

  // Extract and normalise
  const rawWeights: Record<string, number> = {};
  let total = 0;
  for (const id of criterionIds) {
    const w = Math.max(0, result.vars[safeVar(id)] ?? 0);
    rawWeights[id] = w;
    total += w;
  }

  const weights: CriterionWeight[] = criterionIds.map((id) => ({
    criterionId: id,
    weight: total > 0 ? rawWeights[id] / total : 1 / criterionIds.length,
    admissibleRange: [0, 1] as [number, number],
  }));

  return {
    weights,
    consistencyMargin: result.status === 'optimal' ? result.objectiveValue : -1,
    derivedAt: new Date().toISOString(),
  };
}
