/**
 * MACBETH scale derivation.
 *
 * Same LP structure as consistency check but with fixed anchors:
 *   v[neutral] = 0,  v[good] = 100
 *
 * After deriving the central scale, compute admissible [min, max] for each
 * level by solving two additional LPs (minimize and maximize v[i]) with the
 * same constraint set.
 */

import type {
  Descriptor,
  DerivedScale,
  JudgmentMatrix,
  MacbethJudgment,
  ScaleValue,
} from '../domain/types';
import { solveLP, type LPConstraint, type LPBound } from './lp';
import { catLo, catHi } from './consistency';
import { monotoneCubic, type SplinePoint } from './interpolation';

function safeVar(id: string): string {
  return `v__${id.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

function sName(k: number): string {
  return `s_${k}`;
}

function buildScaleConstraints(
  descriptor: Descriptor,
  judgments: Record<string, MacbethJudgment>,
): { constraints: LPConstraint[]; bounds: LPBound[] } {
  const levels = descriptor.levels;
  const neutralId = levels[descriptor.neutralIndex].id;
  const goodId = levels[descriptor.goodIndex].id;

  const constraints: LPConstraint[] = [];
  const bounds: LPBound[] = [];

  for (const level of levels) {
    bounds.push({ name: safeVar(level.id), type: 'FR' });
  }
  for (let k = 1; k <= 6; k++) {
    bounds.push({ name: sName(k), type: 'FR' });
  }
  bounds.push({ name: 'z', type: 'LO', lb: 0 });

  // Anchors
  constraints.push({
    name: 'anchor_neutral',
    vars: [{ name: safeVar(neutralId), coef: 1 }],
    type: 'EQ',
    rhs: 0,
  });
  constraints.push({
    name: 'anchor_good',
    vars: [{ name: safeVar(goodId), coef: 1 }],
    type: 'EQ',
    rhs: 100,
  });

  // Monotone ordering along the descriptor (best to worst)
  for (let i = 0; i < levels.length - 1; i++) {
    constraints.push({
      name: `ord_${i}`,
      vars: [
        { name: safeVar(levels[i].id), coef: 1 },
        { name: safeVar(levels[i + 1].id), coef: -1 },
      ],
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
        name: `eq_${idx}`,
        vars: [
          { name: vA, coef: 1 },
          { name: vB, coef: -1 },
        ],
        type: 'EQ',
        rhs: 0,
      });
    } else {
      constraints.push({
        name: `lb_${idx}`,
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
          name: `ub_${idx}`,
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
      name: `thresh_${k}`,
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
    name: 'thresh_first',
    vars: [
      { name: sName(1), coef: 1 },
      { name: 'z', coef: -1 },
    ],
    type: 'GE',
    rhs: 0,
  });

  return { constraints, bounds };
}

export async function deriveScale(
  criterionId: string,
  descriptor: Descriptor,
  matrix: JudgmentMatrix,
): Promise<DerivedScale> {
  const { constraints, bounds } = buildScaleConstraints(
    descriptor,
    matrix.judgments,
  );

  // Primary solve: maximise z to find the consistent central solution
  const primary = await solveLP({
    name: `scale_${criterionId}`,
    direction: 'MAX',
    objective: [{ name: 'z', coef: 1 }],
    constraints,
    bounds,
  });

  // If inconsistent (z ≤ 0), still return whatever values we get
  const consistencyMargin =
    primary.status === 'optimal' ? primary.objectiveValue : -1;

  // Compute value + admissible range for each level
  const scaleValues: ScaleValue[] = await Promise.all(
    descriptor.levels.map(async (level) => {
      const varName = safeVar(level.id);
      const centralValue = primary.vars[varName] ?? 0;

      const [minRes, maxRes] = await Promise.all([
        solveLP({
          name: `rmin_${criterionId}_${level.id}`,
          direction: 'MIN',
          objective: [{ name: varName, coef: 1 }],
          constraints,
          bounds,
        }),
        solveLP({
          name: `rmax_${criterionId}_${level.id}`,
          direction: 'MAX',
          objective: [{ name: varName, coef: 1 }],
          constraints,
          bounds,
        }),
      ]);

      const lo =
        minRes.status === 'optimal' ? minRes.objectiveValue : centralValue;
      const hi =
        maxRes.status === 'optimal' ? maxRes.objectiveValue : centralValue;

      return {
        levelId: level.id,
        value: round2(centralValue),
        admissibleRange: [round2(lo), round2(hi)] as [number, number],
      };
    }),
  );

  return {
    criterionId,
    values: scaleValues,
    consistencyMargin,
    derivedAt: new Date().toISOString(),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Continuous scoring ────────────────────────────────────────────────────────
//
// A derived scale gives a cardinal value at each discrete descriptor level. To
// score a *continuous* performance we place the levels on a normalized position
// axis — 0 = least attractive level, 1 = most attractive — and read the value
// from a smooth monotone-cubic curve through those points.

/** Normalized position [0,1] of a descriptor level (0 = least attractive). */
export function levelPosition(descriptor: Descriptor, levelId: string): number {
  const n = descriptor.levels.length;
  if (n <= 1) return 0;
  const idx = descriptor.levels.findIndex((l) => l.id === levelId);
  if (idx < 0) return 0;
  // descriptor index 0 = most attractive, so invert to get position
  return (n - 1 - idx) / (n - 1);
}

/** (position, value) nodes for a derived scale, ascending by position. */
export function scalePoints(descriptor: Descriptor, scale: DerivedScale): SplinePoint[] {
  const valueByLevel = new Map(scale.values.map((v) => [v.levelId, v.value]));
  return descriptor.levels
    .map((lvl) => ({
      x: levelPosition(descriptor, lvl.id),
      y: valueByLevel.get(lvl.id) ?? 0,
    }))
    .sort((a, b) => a.x - b.x);
}

/** Smooth value at a continuous position [0,1] along the descriptor. */
export function scoreAtPosition(
  descriptor: Descriptor,
  scale: DerivedScale,
  position: number,
): number {
  const f = monotoneCubic(scalePoints(descriptor, scale));
  return round2(f(position));
}
