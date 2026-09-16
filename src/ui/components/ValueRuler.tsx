/**
 * Direct positioning of performance levels on the value axis.
 *
 * This is an alternative *input surface* for MACBETH judgments, not a way round
 * them. Dragging a level does not write a value into the model: it produces the
 * same C0–C6 judgment record the guided questions produce, which then goes
 * through the same consistency LP. Every pair — not only adjacent ones, which
 * is what the method requires — is translated live and shown beside the ruler,
 * so the assessor always sees the judgment they are building.
 *
 * Exists because some people reason in magnitudes ("this is about 40 out of
 * 100") more readily than in category names.
 */
import { useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { QualificationCriterion, MacbethJudgment } from '../../domain/types';
import { CATEGORIES, categoryForRatio } from '../../domain/categories';

/**
 * Base drawing domain. It widens to fit the data — a level below Neutro or
 * above Bom extrapolates legitimately past 0/100, and a fixed window would
 * either hide it or pin it to the edge with no room to drag.
 */
const BASE_MIN = -25;
const BASE_MAX = 125;

export type LevelValues = Record<string, number>;

/**
 * Even spread between the anchors — the starting point before any dragging.
 * Levels outside the anchors extrapolate past 0 or 100, which is what MACBETH
 * means by "worse than Neutro"; the ruler's domain stretches to show them.
 */
export function defaultLevelValues(criterion: QualificationCriterion): LevelValues {
  const { levels, neutralIndex, goodIndex } = criterion.descriptor;
  const out: LevelValues = {};
  const span = Math.abs(goodIndex - neutralIndex) || 1;
  levels.forEach((l, i) => {
    out[l.id] = Math.round(((neutralIndex - i) / span) * 100);
  });
  out[levels[neutralIndex].id] = 0;
  out[levels[goodIndex].id] = 100;
  return out;
}

/**
 * The MACBETH judgment each pair of positions implies. The widest gap on the
 * scale sets the reference against which every other gap is categorised, which
 * is what makes the mapping scale-invariant.
 */
export function judgmentsFromLevelValues(
  criterion: QualificationCriterion,
  values: LevelValues,
): Record<string, MacbethJudgment> {
  const levels = criterion.descriptor.levels; // ordered most → least attractive
  const out: Record<string, MacbethJudgment> = {};
  const all = levels.map((l) => values[l.id] ?? 0);
  const span = Math.max(...all) - Math.min(...all);
  for (let i = 0; i < levels.length - 1; i++) {
    for (let j = i + 1; j < levels.length; j++) {
      const delta = (values[levels[i].id] ?? 0) - (values[levels[j].id] ?? 0);
      out[`${levels[i].id}__${levels[j].id}`] = {
        kind: 'exact',
        category: categoryForRatio(delta, span),
      };
    }
  }
  return out;
}

/**
 * The span a level can be dragged through without changing a single judgment.
 *
 * Categories come from bucketed ratios, so a level has slack: moving it a little
 * re-renders the number but asserts exactly the same thing. Showing that slack
 * turns "is 38 the right number?" — which nobody can answer — into "anywhere in
 * here says the same thing", which is the honest precision of the method.
 *
 * Found by scanning rather than solved: the mapping is a step function of one
 * variable, so walking outwards from the current value until the judgment record
 * changes is exact, and at ~1 unit per step it costs nothing at this size.
 */
export function stabilityRange(
  criterion: QualificationCriterion,
  values: LevelValues,
  levelId: string,
): [number, number] {
  const current = values[levelId] ?? 0;
  const key = JSON.stringify(judgmentsFromLevelValues(criterion, values));
  const unchangedAt = (v: number) =>
    JSON.stringify(judgmentsFromLevelValues(criterion, { ...values, [levelId]: v })) === key;

  const levels = criterion.descriptor.levels;
  const index = levels.findIndex((l) => l.id === levelId);
  const upper = index > 0 ? (values[levels[index - 1].id] ?? current) - 1 : current + 200;
  const lower = index < levels.length - 1 ? (values[levels[index + 1].id] ?? current) + 1 : current - 200;

  let lo = current;
  while (lo - 1 >= lower && unchangedAt(lo - 1)) lo -= 1;
  let hi = current;
  while (hi + 1 <= upper && unchangedAt(hi + 1)) hi += 1;
  return [lo, hi];
}

export default function ValueRuler({
  criterion,
  values,
  onChange,
}: {
  criterion: QualificationCriterion;
  values: LevelValues;
  onChange: (v: LevelValues) => void;
}) {
  const { t } = useTranslation();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const { levels, neutralIndex, goodIndex } = criterion.descriptor;
  const anchorIds = new Set([levels[neutralIndex]?.id, levels[goodIndex]?.id]);

  // The window only ever grows. Recomputing it from the live values would make
  // every chip jump while one is being dragged; growing on demand keeps the
  // axis stable and still guarantees nothing is ever out of reach.
  const domainRef = useRef<[number, number]>([BASE_MIN, BASE_MAX]);
  {
    const vals = levels.map((l) => values[l.id] ?? 0);
    const [lo, hi] = domainRef.current;
    domainRef.current = [
      Math.min(lo, Math.floor(Math.min(...vals) - 15)),
      Math.max(hi, Math.ceil(Math.max(...vals) + 15)),
    ];
  }
  const [DOMAIN_MIN, DOMAIN_MAX] = domainRef.current;

  // Gridlines: the two anchors always, plus the quarters that fall inside.
  const grid = [...new Set([100, 75, 50, 25, 0].filter((g) => g >= DOMAIN_MIN && g <= DOMAIN_MAX))];

  const toPct = (v: number) =>
    Math.max(0, Math.min(100, ((DOMAIN_MAX - v) / (DOMAIN_MAX - DOMAIN_MIN)) * 100));

  const startDrag = useCallback(
    (levelId: string, index: number) => (e: React.PointerEvent) => {
      if (anchorIds.has(levelId)) return;
      e.preventDefault();
      const track = trackRef.current;
      if (!track) return;

      const move = (ev: PointerEvent) => {
        const r = track.getBoundingClientRect();
        const ratio = (ev.clientY - r.top) / r.height;
        const raw = DOMAIN_MAX - ratio * (DOMAIN_MAX - DOMAIN_MIN);
        // A descriptor is ordered best → worst, so a level may never cross a
        // neighbour: doing so would invert the dominance the user declared.
        const upper = index > 0 ? values[levels[index - 1].id] ?? DOMAIN_MAX : DOMAIN_MAX;
        const lower = index < levels.length - 1 ? values[levels[index + 1].id] ?? DOMAIN_MIN : DOMAIN_MIN;
        const clamped = Math.round(Math.max(lower + 1, Math.min(upper - 1, raw)));
        onChange({ ...values, [levelId]: clamped });
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [values, levels, onChange, anchorIds],
  );

  /** Keyboard equivalent, so positioning is not pointer-only. */
  function nudge(levelId: string, index: number, delta: number) {
    if (anchorIds.has(levelId)) return;
    const upper = index > 0 ? values[levels[index - 1].id] ?? DOMAIN_MAX : DOMAIN_MAX;
    const lower = index < levels.length - 1 ? values[levels[index + 1].id] ?? DOMAIN_MIN : DOMAIN_MIN;
    const next = Math.max(lower + 1, Math.min(upper - 1, (values[levelId] ?? 0) + delta));
    onChange({ ...values, [levelId]: next });
  }

  return (
    <div className="flex gap-4">
      <div className="flex-1 relative pl-12 pr-2" style={{ height: 300 }} ref={trackRef}>
        {grid.map((g) => (
          <div key={g} className="absolute inset-x-0 flex items-center gap-2" style={{ top: `${toPct(g)}%` }}>
            <span
              className={`w-8 text-right font-mono text-[10px] tabular-nums ${
                g === 0 || g === 100 ? 'text-gray-700 font-bold' : 'text-gray-400'
              }`}
            >
              {g}
            </span>
            <span className={`flex-1 ${g === 0 || g === 100 ? 'h-0.5 bg-gray-300' : 'h-px bg-gray-200'}`} />
          </div>
        ))}

        {/* Stability bands: where each level can go without changing a judgment. */}
        {levels.map((level) => {
          if (anchorIds.has(level.id)) return null;
          const [lo, hi] = stabilityRange(criterion, values, level.id);
          if (hi <= lo) return null;
          const top = toPct(hi);
          const height = toPct(lo) - top;
          return (
            <div
              key={`band-${level.id}`}
              className="absolute left-[2.6rem] w-1.5 rounded-full bg-indigo-100 border border-indigo-200"
              style={{ top: `${top}%`, height: `${height}%` }}
              aria-hidden="true"
              title={t('Entre {{lo}} e {{hi}} os juízos não mudam', { lo, hi })}
            />
          );
        })}

        {levels.map((level, i) => {
          const v = values[level.id] ?? 0;
          const isAnchor = anchorIds.has(level.id);
          const isGood = i === goodIndex;
          return (
            <div
              key={level.id}
              role={isAnchor ? undefined : 'slider'}
              tabIndex={isAnchor ? undefined : 0}
              aria-label={isAnchor ? undefined : t('Posição de «{{label}}»', { label: level.label })}
              aria-valuenow={isAnchor ? undefined : v}
              aria-valuemin={isAnchor ? undefined : DOMAIN_MIN}
              aria-valuemax={isAnchor ? undefined : DOMAIN_MAX}
              onPointerDown={startDrag(level.id, i)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp') { e.preventDefault(); nudge(level.id, i, 1); }
                if (e.key === 'ArrowDown') { e.preventDefault(); nudge(level.id, i, -1); }
              }}
              className={`absolute left-12 -translate-y-1/2 flex items-center gap-2.5 px-3 py-1.5 rounded-full text-[13px] font-bold border-[1.5px] bg-white transition-shadow ${
                isAnchor
                  ? 'border-gray-300 text-gray-600'
                  : 'border-indigo-500 text-gray-800 cursor-grab active:cursor-grabbing shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-indigo-300'
              }`}
              style={{ top: `${toPct(v)}%` }}
            >
              {!isAnchor && <span className="text-gray-300 text-[11px] tracking-[-2px] leading-none">⠿</span>}
              <span className="truncate max-w-[13rem]">{level.label}</span>
              <span className={`font-mono text-[11px] tabular-nums ${isAnchor ? 'text-gray-400' : 'text-indigo-600'}`}>
                {v}
                {isAnchor && (isGood ? ` · ${t('Bom')}` : ` · ${t('Neutro')}`)}
              </span>
              {!isAnchor && (() => {
                const [lo, hi] = stabilityRange(criterion, values, level.id);
                return hi > lo ? (
                  <span className="font-mono text-[10px] text-gray-400 tabular-nums whitespace-nowrap">
                    [{lo} – {hi}]
                  </span>
                ) : null;
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Rows for the live readout: every pair, its gap, and the category it means. */
export function pairReadings(criterion: QualificationCriterion, values: LevelValues) {
  const levels = criterion.descriptor.levels;
  const judgments = judgmentsFromLevelValues(criterion, values);
  const rows: { key: string; from: string; to: string; delta: number; cat: number }[] = [];
  for (let i = 0; i < levels.length - 1; i++) {
    for (let j = i + 1; j < levels.length; j++) {
      const key = `${levels[i].id}__${levels[j].id}`;
      const j0 = judgments[key];
      rows.push({
        key,
        from: levels[j].label,
        to: levels[i].label,
        delta: (values[levels[i].id] ?? 0) - (values[levels[j].id] ?? 0),
        cat: j0?.kind === 'exact' ? j0.category : 0,
      });
    }
  }
  return rows.sort((a, b) => a.delta - b.delta).map((r) => ({ ...r, label: CATEGORIES[r.cat]?.label ?? '' }));
}
