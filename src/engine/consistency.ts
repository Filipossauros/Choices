/**
 * MACBETH consistency engine.
 *
 * LP formulation (Bana e Costa & Vansnick 1994, simplified):
 *
 *   maximize z
 *   subject to:
 *     (1) Normalization: v[last] = 0,  v[i] ∈ [0, 1] for all i
 *     (2) For each pair (A,B) with c=0: v[A] = v[B]
 *     (3) For each pair (A,B) with c≥1: v[A] - v[B] ≥ z  (ordinal + positive)
 *     (4) Cardinal: for all pairs (p1,p2) with catLo(p1) < catLo(p2):
 *           d(p2) - d(p1) ≥ z  i.e.  v[p2.A]-v[p2.B]-v[p1.A]+v[p1.B] ≥ z
 *     z ≥ 0
 *
 *   z* > 0  ⟹ consistent (MACBETH cardinal + ordinal consistency)
 *   z* = 0  ⟹ inconsistent (no positive margin exists)
 *
 * Note: v[i] ∈ [0,1] provides the normalization that makes the LP bounded.
 * The empty-judgment case is handled as trivially consistent (z = 1).
 */

import type {
  MacbethCategory,
  MacbethJudgment,
  ConsistencyReport,
  InconsistentPair,
} from '../domain/types';
import { solveLP, type LPConstraint, type LPBound } from './lp';

export interface JudgmentEntry {
  idA: string;
  idB: string;
  judgment: MacbethJudgment;
}

export function catLo(j: MacbethJudgment): MacbethCategory {
  return j.kind === 'exact' ? j.category : j.lo;
}

export function catHi(j: MacbethJudgment): MacbethCategory {
  return j.kind === 'exact' ? j.category : j.hi;
}

function vn(id: string): string {
  return `v__${id.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

function buildLP(
  ids: string[],
  entries: JudgmentEntry[],
): { constraints: LPConstraint[]; bounds: LPBound[] } {
  const constraints: LPConstraint[] = [];
  const bounds: LPBound[] = [];

  // All v ∈ [0, 1] — normalises the problem and bounds z ≤ 1
  for (const id of ids) {
    bounds.push({ name: vn(id), type: 'DB', lb: 0, ub: 1 });
  }

  // z ≥ 0
  bounds.push({ name: 'z', type: 'LO', lb: 0 });

  // Fix least-attractive (last) to 0
  const last = ids[ids.length - 1];
  bounds[ids.indexOf(last)] = { name: vn(last), type: 'FX', lb: 0, ub: 0 };

  // ── Ordinal constraints ──────────────────────────────────────────────────
  for (let idx = 0; idx < entries.length; idx++) {
    const { idA, idB, judgment } = entries[idx];
    const kLo = catLo(judgment);

    if (kLo === 0) {
      // Equal attractiveness: v[A] = v[B]
      constraints.push({
        name: `eq_${idx}`,
        vars: [
          { name: vn(idA), coef: 1 },
          { name: vn(idB), coef: -1 },
        ],
        type: 'EQ',
        rhs: 0,
      });
    } else {
      // Strictly more attractive: v[A] - v[B] ≥ z
      constraints.push({
        name: `ord_${idx}`,
        vars: [
          { name: vn(idA), coef: 1 },
          { name: vn(idB), coef: -1 },
          { name: 'z', coef: -1 },
        ],
        type: 'GE',
        rhs: 0,
      });
    }
  }

  // ── Cardinal consistency ─────────────────────────────────────────────────
  // For every pair of judgment entries with different (non-zero) categories,
  // the higher-category pair must have a strictly larger v-difference.
  for (let p = 0; p < entries.length; p++) {
    const ep = entries[p];
    const kp = catLo(ep.judgment);
    if (kp === 0) continue;

    for (let q = p + 1; q < entries.length; q++) {
      const eq = entries[q];
      const kq = catLo(eq.judgment);
      if (kq === 0 || kp === kq) continue;

      const [lo, hi] = kp < kq ? [ep, eq] : [eq, ep];

      // d(hi) - d(lo) ≥ z
      // (v[hi.A] - v[hi.B]) - (v[lo.A] - v[lo.B]) ≥ z
      // Deduplicate: pairs may share an alternative (e.g. A-B and A-C both contain A),
      // producing duplicate variable names that GLPK rejects. Collapse by summing coefs.
      const coefMap = new Map<string, number>();
      for (const [name, c] of [
        [vn(hi.idA), 1] as const,
        [vn(hi.idB), -1] as const,
        [vn(lo.idA), -1] as const,
        [vn(lo.idB), 1] as const,
        ['z', -1] as const,
      ]) {
        coefMap.set(name, (coefMap.get(name) ?? 0) + c);
      }
      const vars = Array.from(coefMap.entries())
        .filter(([, c]) => Math.abs(c) > 1e-10)
        .map(([name, coef]) => ({ name, coef }));

      constraints.push({
        name: `card_${p}_${q}`,
        vars,
        type: 'GE',
        rhs: 0,
      });
    }
  }

  return { constraints, bounds };
}

async function solveConsistencyLP(
  ids: string[],
  entries: JudgmentEntry[],
): Promise<{ margin: number; vars: Record<string, number> }> {
  // Trivially consistent when no judgments (or nothing to compare)
  if (entries.length === 0 || ids.length <= 1) {
    return { margin: 1, vars: {} };
  }

  const { constraints, bounds } = buildLP(ids, entries);

  const result = await solveLP({
    name: 'macbeth_consistency',
    direction: 'MAX',
    objective: [{ name: 'z', coef: 1 }],
    constraints,
    bounds,
  });

  return {
    margin: result.status === 'optimal' ? result.objectiveValue : -1,
    vars: result.vars,
  };
}

export async function checkConsistency(
  ids: string[],
  entries: JudgmentEntry[],
): Promise<ConsistencyReport> {
  const { margin } = await solveConsistencyLP(ids, entries);

  if (margin > 1e-9) {
    return {
      isConsistent: true,
      consistencyMargin: margin,
      inconsistentPairs: [],
    };
  }

  const inconsistentPairs = await findInconsistentPairs(ids, entries);

  return {
    isConsistent: false,
    consistencyMargin: margin,
    inconsistentPairs,
  };
}

async function findInconsistentPairs(
  ids: string[],
  entries: JudgmentEntry[],
): Promise<InconsistentPair[]> {
  const result: InconsistentPair[] = [];

  for (let i = 0; i < entries.length; i++) {
    const reduced = entries.filter((_, j) => j !== i);
    const { margin } = await solveConsistencyLP(ids, reduced);
    if (margin > 1e-9) {
      // Removing entry i restores consistency → it contributes to the conflict.
      // Only report it if we can also suggest a concrete correction.
      const entry = entries[i];
      const suggested = await suggestCorrection(ids, entries, i);
      if (suggested === null) continue;
      result.push({
        idA: entry.idA,
        idB: entry.idB,
        currentJudgment: entry.judgment,
        suggestedJudgment: suggested,
      });
    }
  }

  return result;
}

async function suggestCorrection(
  ids: string[],
  entries: JudgmentEntry[],
  idx: number,
): Promise<MacbethJudgment | null> {
  const current = entries[idx];
  const kCurrent = catLo(current.judgment);

  // Try all categories from 0 to 6, skipping the current one
  const candidates: MacbethCategory[] = ([0, 1, 2, 3, 4, 5, 6] as MacbethCategory[]).filter(
    (c) => c !== kCurrent,
  );

  for (const cat of candidates) {
    const candidate: MacbethJudgment = { kind: 'exact', category: cat };
    const modified = entries.map((e, j) =>
      j === idx ? { ...e, judgment: candidate } : e,
    );
    const { margin } = await solveConsistencyLP(ids, modified);
    if (margin > 1e-9) return candidate;
  }

  return null;
}
