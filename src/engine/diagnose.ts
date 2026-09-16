/**
 * Turning "z ≤ 0" into something a person can act on.
 *
 * When a judgment matrix is inconsistent the LP says only that no positive
 * discrimination margin exists. That is true and useless: the screen showed
 * "margem: −1.000" and a scale of all zeros, and left the assessor to find the
 * contradiction among fifteen answers by inspection.
 *
 * Most real contradictions have the same shape and can be named exactly. A
 * descriptor is ordered, so the jump from a worse level to a better one is the
 * sum of the steps in between; a jump that *contains* another cannot therefore be
 * worth less than the one it contains. Saying "10–25 k€ → < 10 k€ is Extreme" and
 * "25–50 k€ → < 10 k€ is Low" asserts exactly that, and is the single most common
 * way these matrices break. `containmentConflicts` finds those pairs and says
 * which two answers disagree and why.
 *
 * Anything it does not catch falls back to the LP's own leave-one-out search,
 * which finds *a* judgment whose removal restores consistency and the nearest
 * category that would work — less specific, but never wrong.
 */
import type { Descriptor, MacbethJudgment, MacbethCategory } from '../domain/types';
import { catLo, catHi, checkConsistency, type JudgmentEntry } from './consistency';

/** One jump along the descriptor, as the user stated it. */
export interface Jump {
  key: string;
  /** Level moved *from* (the less attractive end). */
  fromId: string;
  /** Level moved *to* (the more attractive end). */
  toId: string;
  /** Indices in the descriptor, where 0 is the most attractive level. */
  toIndex: number;
  fromIndex: number;
  judgment: MacbethJudgment;
}

export interface ContainmentConflict {
  /** The wider jump — it spans the narrow one and was nonetheless rated lower. */
  wide: Jump;
  /** The narrower jump, contained in `wide`, rated strictly higher. */
  narrow: Jump;
}

/** Parse a judgment record into jumps positioned on the descriptor. */
export function jumpsOf(descriptor: Descriptor, judgments: Record<string, MacbethJudgment>): Jump[] {
  const indexOf = new Map(descriptor.levels.map((l, i) => [l.id, i] as const));
  const out: Jump[] = [];
  for (const [key, judgment] of Object.entries(judgments)) {
    const [idA, idB] = key.split('__');
    const toIndex = indexOf.get(idA);
    const fromIndex = indexOf.get(idB);
    if (toIndex == null || fromIndex == null) continue; // stale level id
    out.push({ key, fromId: idB, toId: idA, toIndex, fromIndex, judgment });
  }
  return out;
}

/**
 * Pairs where a jump that contains another was rated strictly below it.
 *
 * Containment is on descriptor indices: jump X spans [X.toIndex, X.fromIndex]
 * (best end first), and contains Y when it starts no later and ends no earlier.
 * Because values are monotone along the descriptor, d(X) ≥ d(Y) always holds, so
 * catLo(Y) > catHi(X) is a genuine contradiction and not merely a tight fit.
 */
export function containmentConflicts(
  descriptor: Descriptor,
  judgments: Record<string, MacbethJudgment>,
): ContainmentConflict[] {
  const jumps = jumpsOf(descriptor, judgments);
  const out: ContainmentConflict[] = [];
  for (const wide of jumps) {
    for (const narrow of jumps) {
      if (wide.key === narrow.key) continue;
      const contains =
        wide.toIndex <= narrow.toIndex &&
        narrow.fromIndex <= wide.fromIndex &&
        // A strictly wider span, not the same one written twice.
        wide.fromIndex - wide.toIndex > narrow.fromIndex - narrow.toIndex;
      if (!contains) continue;
      if (catLo(narrow.judgment) > catHi(wide.judgment)) out.push({ wide, narrow });
    }
  }
  return out;
}

/**
 * The smallest category that would make `wide` consistent with `narrow`: it must
 * reach at least the narrow jump's own lower category.
 */
export function minimumCategoryFor(conflict: ContainmentConflict): MacbethCategory {
  return catLo(conflict.narrow.judgment);
}

export interface ScaleDiagnosis {
  /** Contradictions that can be stated exactly, most-contained pair first. */
  conflicts: ContainmentConflict[];
  /**
   * Fallback when no containment conflict explains it: a judgment whose removal
   * restores consistency, with the nearest category that would work. Null when
   * the matrix is consistent or nothing could be suggested.
   */
  fallback: { key: string; suggested: MacbethCategory } | null;
}

/**
 * Diagnose an inconsistent scale matrix. Cheap path first: containment conflicts
 * are found by inspection, so the LP-based search only runs when nothing simpler
 * explains the failure.
 */
export async function diagnoseScale(
  descriptor: Descriptor,
  judgments: Record<string, MacbethJudgment>,
): Promise<ScaleDiagnosis> {
  const conflicts = containmentConflicts(descriptor, judgments).sort(
    // The most specific pair reads best: the narrowest contained jump makes the
    // "a bigger jump cannot be worth less" sentence most obviously true.
    (a, b) =>
      (a.narrow.fromIndex - a.narrow.toIndex) - (b.narrow.fromIndex - b.narrow.toIndex),
  );
  if (conflicts.length > 0) return { conflicts, fallback: null };

  const ids = descriptor.levels.map((l) => l.id);
  const entries: JudgmentEntry[] = Object.entries(judgments).map(([key, judgment]) => {
    const [idA, idB] = key.split('__');
    return { idA, idB, judgment };
  });
  const report = await checkConsistency(ids, entries);
  const first = report.inconsistentPairs[0];
  if (!first) return { conflicts: [], fallback: null };
  return {
    conflicts: [],
    fallback: {
      key: `${first.idA}__${first.idB}`,
      suggested: catLo(first.suggestedJudgment),
    },
  };
}
