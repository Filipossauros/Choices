/**
 * MACBETH swing-weighting.
 *
 * The weighting matrix compares fictitious reference options:
 *   - one per qualification criterion: Bom on that criterion, Neutro on all others
 *   - plus the all-Neutro option (weight = 0, the normalization anchor)
 *
 * The LP adds Σwᵢ = 1 (normalization) so the problem is bounded and weights
 * are extracted directly. Admissible ranges are computed via parallel min/max
 * LPs using the same constraint set (identical approach to scaling.ts).
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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

  // Normalization: Σ wᵢ = 1 — bounds the LP so weights are already normalised
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

  const consistencyMargin = result.status === 'optimal' ? result.objectiveValue : -1;

  // Compute central weight + admissible [min, max] for each criterion via parallel LPs
  const weights: CriterionWeight[] = await Promise.all(
    criterionIds.map(async (id) => {
      const varName = safeVar(id);
      const centralValue = Math.max(0, result.vars[varName] ?? 0);

      const [minRes, maxRes] = await Promise.all([
        solveLP({
          name: `wmin_${id}`,
          direction: 'MIN',
          objective: [{ name: varName, coef: 1 }],
          constraints,
          bounds,
        }),
        solveLP({
          name: `wmax_${id}`,
          direction: 'MAX',
          objective: [{ name: varName, coef: 1 }],
          constraints,
          bounds,
        }),
      ]);

      const lo = minRes.status === 'optimal' ? Math.max(0, round2(minRes.objectiveValue)) : 0;
      const hi = maxRes.status === 'optimal' ? Math.min(1, round2(maxRes.objectiveValue)) : 1;

      return {
        criterionId: id,
        weight: round2(centralValue),
        admissibleRange: [lo, hi] as [number, number],
      };
    }),
  );

  return {
    weights,
    consistencyMargin,
    derivedAt: new Date().toISOString(),
  };
}
