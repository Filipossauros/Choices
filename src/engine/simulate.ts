/**
 * Automatic swing-weighting simulation.
 *
 * Eliciting every pairwise swing judgment is the slowest part of building a
 * model. But the importance *ranking* the user already gives in step 1 is
 * enough to produce a complete, internally consistent starting point: the Rank
 * Order Centroid (ROC) is the centre of gravity of every weight vector
 * compatible with that ranking, which makes it the least-committal choice among
 * them.
 *
 *   ROC:  wᵢ = (1/n) · Σ_{j=i..n} 1/j      (i = 1 is the most important)
 *
 * Simulated judgments are NOT elicited preferences, so every judgment this
 * module produces is reported as `suggested`. The caller is expected to keep
 * that distinction visible until the user confirms, exactly as manual decision
 * thresholds are flagged — an audit trail that silently blends the two would
 * undermine the point of the method.
 */
import type { MacbethJudgment, MacbethCategory } from '../domain/types';
import { categoryForRatio } from '../domain/categories';
import { ALL_NEUTRAL } from './weighting';

/** Rank Order Centroid weights for `n` criteria, most important first. */
export function rocWeights(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [1];
  const out: number[] = [];
  for (let i = 1; i <= n; i++) {
    let s = 0;
    for (let j = i; j <= n; j++) s += 1 / j;
    out.push(s / n);
  }
  return out;
}

export interface SimulatedWeighting {
  /** Judgment record keyed exactly like the elicited one (`idA__idB`). */
  judgments: Record<string, MacbethJudgment>;
  /** The ROC weights the judgments were built from, in the given order. */
  weights: number[];
  /** Keys in `judgments` that were generated rather than elicited. */
  suggestedKeys: string[];
}

/**
 * Build a full set of swing judgments from an importance ranking.
 *
 * `orderedIds` runs most-important first. Every criterion is also compared
 * against the all-neutral reference, which is what anchors the swing scale.
 */
export function simulateWeighting(orderedIds: string[]): SimulatedWeighting {
  const n = orderedIds.length;
  const weights = rocWeights(n);
  const judgments: Record<string, MacbethJudgment> = {};
  const suggestedKeys: string[] = [];

  if (n === 0) return { judgments, weights, suggestedKeys };

  // The largest swing sets the scale everything else is judged against.
  const span = weights[0];

  const put = (a: string, b: string, category: MacbethCategory) => {
    const key = `${a}__${b}`;
    judgments[key] = { kind: 'exact', category };
    suggestedKeys.push(key);
  };

  // Criterion vs criterion: the gap between their ROC weights.
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const cat = categoryForRatio(weights[i] - weights[j], span);
      // Distinct ranks must stay strictly ordered, or the LP reads the pair as
      // indifferent and the ranking the user gave is silently discarded.
      put(orderedIds[i], orderedIds[j], Math.max(1, cat) as MacbethCategory);
    }
  }

  // Criterion vs the all-neutral reference: the swing's own magnitude.
  for (let i = 0; i < n; i++) {
    const cat = categoryForRatio(weights[i], span);
    put(orderedIds[i], ALL_NEUTRAL, Math.max(1, cat) as MacbethCategory);
  }

  return { judgments, weights, suggestedKeys };
}

/**
 * Translate a set of weights the user dragged directly into the MACBETH
 * judgments they imply, so the direct-input mode reports in the method's own
 * vocabulary rather than replacing it.
 */
export function judgmentsFromWeights(
  orderedIds: string[],
  weightById: Record<string, number>,
): Record<string, MacbethJudgment> {
  const sorted = [...orderedIds].sort((a, b) => (weightById[b] ?? 0) - (weightById[a] ?? 0));
  const span = weightById[sorted[0]] ?? 1;
  const judgments: Record<string, MacbethJudgment> = {};
  for (let i = 0; i < sorted.length - 1; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const d = (weightById[sorted[i]] ?? 0) - (weightById[sorted[j]] ?? 0);
      judgments[`${sorted[i]}__${sorted[j]}`] = { kind: 'exact', category: categoryForRatio(d, span) };
    }
  }
  for (const id of sorted) {
    judgments[`${id}__${ALL_NEUTRAL}`] = {
      kind: 'exact',
      category: Math.max(1, categoryForRatio(weightById[id] ?? 0, span)) as MacbethCategory,
    };
  }
  return judgments;
}
