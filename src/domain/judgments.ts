/**
 * Judgment-key bookkeeping.
 *
 * A judgment is stored under `idA__idB` where `idA` is the *more attractive*
 * element — so the key carries the direction and the stored category carries
 * only the magnitude. MACBETH magnitudes are symmetric (|v(A) − v(B)|), which is
 * what makes re-orientation lossless: when the ranking changes, the same answer
 * stays valid, it just gets filed the other way round.
 *
 * That matters because the guided flow now lets the respondent contradict the
 * ranking in place ("afinal prefiro a outra") instead of sending them back to a
 * list to drag rows — see `moveBefore`.
 */
import type { MacbethJudgment } from './types';

/**
 * Re-file every judgment so that the first id in each key is the one that ranks
 * earlier in `orderedIds`. Ids missing from `orderedIds` rank last, keeping the
 * order they already had in the key (this is how the `ALL_NEUTRAL` pseudo-item
 * stays pinned to the bottom without this module having to know about it).
 */
export function reorientJudgments(
  orderedIds: string[],
  judgments: Record<string, MacbethJudgment>,
): Record<string, MacbethJudgment> {
  const rank = new Map(orderedIds.map((id, i) => [id, i] as const));
  const rankOf = (id: string) => rank.get(id) ?? Number.MAX_SAFE_INTEGER;
  const out: Record<string, MacbethJudgment> = {};
  for (const [key, value] of Object.entries(judgments)) {
    const [a, b] = key.split('__');
    if (b === undefined) continue;
    const [first, second] = rankOf(a) <= rankOf(b) ? [a, b] : [b, a];
    out[`${first}__${second}`] = value;
  }
  return out;
}

/**
 * Move `moveId` to sit immediately before `beforeId`.
 *
 * Insertion, not a swap: saying "I prefer B to A" when A outranks B means B now
 * beats A *and* everything between them, by transitivity. A swap would instead
 * push A below those middle elements, an assertion nobody made.
 */
export function moveBefore(orderedIds: string[], moveId: string, beforeId: string): string[] {
  const rest = orderedIds.filter((id) => id !== moveId);
  const at = rest.indexOf(beforeId);
  if (at === -1 || !orderedIds.includes(moveId)) return orderedIds;
  return [...rest.slice(0, at), moveId, ...rest.slice(at)];
}
