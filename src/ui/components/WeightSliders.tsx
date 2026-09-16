/**
 * Direct weight entry — the weighting counterpart to the value ruler.
 *
 * Dragging a weight does not bypass MACBETH: the resulting distribution is
 * translated back into the pairwise judgments it implies, shown live, and saved
 * through the same LP as elicited answers. It exists for the case where someone
 * already knows roughly how the weight should split and finds answering the
 * pairwise questions a slower route to the same place.
 *
 * The remaining weight is redistributed proportionally among the other criteria
 * so the group always sums to 1 — the same rule the sensitivity analysis uses
 * when it varies one weight.
 */
import { useTranslation } from 'react-i18next';
import { CATEGORIES } from '../../domain/categories';
import { judgmentsFromWeights } from '../../engine/simulate';
import { ALL_NEUTRAL } from '../../engine/weighting';

export type WeightMap = Record<string, number>;

/** Set one weight and rescale the others so the group still sums to 1. */
export function setWeightProportional(weights: WeightMap, id: string, next: number): WeightMap {
  const clamped = Math.max(0, Math.min(1, next));
  const others = Object.keys(weights).filter((k) => k !== id);
  const otherTotal = others.reduce((s, k) => s + (weights[k] ?? 0), 0);
  const out: WeightMap = { [id]: clamped };
  for (const k of others) {
    // With nothing left to scale, share the remainder evenly rather than
    // leaving every other criterion pinned at zero forever.
    out[k] = otherTotal > 0
      ? (weights[k] ?? 0) * ((1 - clamped) / otherTotal)
      : (1 - clamped) / Math.max(1, others.length);
  }
  return out;
}

/** Pairwise readings for the live panel: the gap and the category it means. */
export function weightReadings(orderedIds: string[], weights: WeightMap, labelOf: (id: string) => string) {
  const judgments = judgmentsFromWeights(orderedIds, weights);
  return Object.entries(judgments)
    .filter(([key]) => !key.endsWith(`__${ALL_NEUTRAL}`))
    .map(([key, j]) => {
      const [a, b] = key.split('__');
      const cat = j.kind === 'exact' ? j.category : j.lo;
      return {
        key,
        more: labelOf(a),
        less: labelOf(b),
        delta: Math.abs((weights[a] ?? 0) - (weights[b] ?? 0)),
        cat,
        label: CATEGORIES[cat]?.label ?? '',
      };
    })
    .sort((x, y) => x.delta - y.delta);
}

export default function WeightSliders({
  orderedIds,
  weights,
  labelOf,
  onChange,
}: {
  orderedIds: string[];
  weights: WeightMap;
  labelOf: (id: string) => string;
  onChange: (w: WeightMap) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      {orderedIds.map((id) => {
        const v = weights[id] ?? 0;
        return (
          <div key={id} className="flex items-center gap-3">
            <span className="flex-[0_0_9rem] text-right text-sm text-gray-600 truncate" title={labelOf(id)}>
              {labelOf(id)}
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={v}
              onChange={(e) => onChange(setWeightProportional(weights, id, Number(e.target.value)))}
              aria-label={t('Peso de «{{label}}»', { label: labelOf(id) })}
              className="flex-1 accent-indigo-600"
            />
            <span className="flex-[0_0_3rem] text-right font-mono text-sm font-bold tabular-nums text-gray-700">
              {v.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
