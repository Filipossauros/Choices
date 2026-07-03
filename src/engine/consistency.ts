/**
 * MACBETH consistency engine.
 *
 * LP formulation (Bana e Costa & Vansnick 1994, simplified):
 *
 *   maximize z
 *   subject to:
 *     (1) Normalization: v[last] = 0,  v[i] ∈ [0, 1] for all i
 *     (2) For each pair (A,B) judged exactly C0: v[A] = v[B]
 *     (3) For each pair (A,B) with catLo ≥ 1: v[A] - v[B] ≥ z  (ordinal + positive)
 *         An interval starting at C0 ({lo:0, hi>0}) only requires v[A] - v[B] ≥ 0
 *         — indifference is still admissible, so no strict margin is imposed.
 *     (4) Cardinal: for all pairs (p1,p2) with catLo(p2) > catHi(p1):
 *           d(p2) - d(p1) ≥ z  i.e.  v[p2.A]-v[p2.B]-v[p1.A]+v[p1.B] ≥ z
 *         Interval judgments only dominate/are dominated when their category
 *         ranges do not overlap (lo of one strictly above hi of the other);
 *         overlapping intervals impose no relative ordering.
 *     z ∈ [0, 1]
 *
 *   z* > 0  ⟹ consistent (MACBETH cardinal + ordinal consistency)
 *   z* = 0  ⟹ inconsistent (no positive margin exists)
 *
 * Note: v[i] ∈ [0,1] provides the normalization that makes the LP bounded;
 * z ≤ 1 keeps the LP bounded even when no constraint involves z (e.g. a matrix
 * judged entirely C0), which is trivially consistent.
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

  // z ∈ [0, 1] — the upper bound keeps the LP bounded when no constraint
  // involves z (all-C0 matrices), which must solve as consistent.
  bounds.push({ name: 'z', type: 'DB', lb: 0, ub: 1 });

  // Fix least-attractive (last) to 0
  const last = ids[ids.length - 1];
  bounds[ids.indexOf(last)] = { name: vn(last), type: 'FX', lb: 0, ub: 0 };

  // ── Ordinal constraints ──────────────────────────────────────────────────
  for (let idx = 0; idx < entries.length; idx++) {
    const { idA, idB, judgment } = entries[idx];
    const kLo = catLo(judgment);
    const kHi = catHi(judgment);

    if (kLo === 0 && kHi === 0) {
      // Exactly C0 — equal attractiveness: v[A] = v[B]
      constraints.push({
        name: `eq_${idx}`,
        vars: [
          { name: vn(idA), coef: 1 },
          { name: vn(idB), coef: -1 },
        ],
        type: 'EQ',
        rhs: 0,
      });
    } else if (kLo === 0) {
      // Interval starting at C0 ("null to hi") — indifference still admissible,
      // so only weak dominance is required: v[A] - v[B] ≥ 0 (no z margin).
      constraints.push({
        name: `ord_${idx}`,
        vars: [
          { name: vn(idA), coef: 1 },
          { name: vn(idB), coef: -1 },
        ],
        type: 'GE',
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
  // A pair must have a strictly larger v-difference than another only when its
  // category range sits strictly above the other's: catLo(p1) > catHi(p2).
  // For exact judgments (lo = hi) this is the classic "different non-zero
  // categories" rule; overlapping intervals impose no relative ordering.
  for (let p = 0; p < entries.length; p++) {
    const ep = entries[p];
    // Exactly-C0 pairs are pinned to d = 0 by their EQ constraint; the ordinal
    // constraints already dominate them, so skip to avoid redundant rows.
    if (catLo(ep.judgment) === 0 && catHi(ep.judgment) === 0) continue;

    for (let q = p + 1; q < entries.length; q++) {
      const eq = entries[q];
      if (catLo(eq.judgment) === 0 && catHi(eq.judgment) === 0) continue;

      let lo: JudgmentEntry;
      let hi: JudgmentEntry;
      if (catLo(ep.judgment) > catHi(eq.judgment)) {
        lo = eq;
        hi = ep;
      } else if (catLo(eq.judgment) > catHi(ep.judgment)) {
        lo = ep;
        hi = eq;
      } else {
        continue; // category ranges overlap — no ordering implied
      }

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

  // Try all categories except the current one, nearest to the assessor's
  // original judgment first — the suggestion should disturb it minimally.
  const candidates: MacbethCategory[] = ([0, 1, 2, 3, 4, 5, 6] as MacbethCategory[])
    .filter((c) => c !== kCurrent)
    .sort((a, b) => Math.abs(a - kCurrent) - Math.abs(b - kCurrent));

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
