import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../store';
import type {
  MacbethJudgment, MacbethCategory, JudgmentMatrix, DerivedScale, QualificationCriterion,
} from '../../domain/types';
import { DEFAULT_ASSESSOR_ID } from '../../domain/types';
import { deriveScale, scaleFromValues, scalePoints, levelPosition } from '../../engine/scaling';
import { diagnoseScale, minimumCategoryFor, type ScaleDiagnosis } from '../../engine/diagnose';
import { sampleCurve } from '../../engine/interpolation';
import JudgmentMatrixEditor from '../components/JudgmentMatrixEditor';
import GuidedJudgments from '../components/GuidedJudgments';
import ScreenNav from '../components/ScreenNav';
import { ancestorLabels } from '../../domain/tree';
import { CATEGORIES } from '../../domain/categories';
import ValueRuler, { defaultLevelValues, judgmentsFromLevelValues, pairReadings, type LevelValues } from '../components/ValueRuler';
import { v4 as uuidv4 } from 'uuid';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
  ResponsiveContainer,
} from 'recharts';

/** Lower bound of a judgment's category — what an interval asserts at minimum. */
const catOf = (j: MacbethJudgment): MacbethCategory => (j.kind === 'exact' ? j.category : j.lo);

// ── Scale ruler ───────────────────────────────────────────────────────────────

function ScaleRuler({
  scale,
  criterion,
}: {
  scale: DerivedScale;
  criterion: QualificationCriterion;
}) {
  const { t } = useTranslation();
  const levels = criterion.descriptor.levels;
  const levelMap = new Map(levels.map((l) => [l.id, l]));
  const neutralId = levels[criterion.descriptor.neutralIndex]?.id;
  const goodId = levels[criterion.descriptor.goodIndex]?.id;

  const sorted = [...scale.values].sort((a, b) => b.value - a.value);
  const maxVal = sorted[0]?.value ?? 100;
  const minVal = sorted[sorted.length - 1]?.value ?? 0;
  const range = maxVal - minVal || 1;

  // Layout constants — all coordinates within [0, VIEW_W]
  const VIEW_W = 440;
  const PAD_TOP = 44; // space for column headers + separator
  const H = 260;
  const PAD_BOT = 20;
  const TOTAL_H = PAD_TOP + H + PAD_BOT;
  const AX = 72; // axis x (leaves 72px on the left for gap annotations)

  const yOf = (v: number) => PAD_TOP + ((maxVal - v) / range) * H;

  // Column x positions
  const LABEL_X = AX + 18;   // level name ("Performance" column)
  const VAL_X = 270;          // score value ("Pontos" column, right-aligned)
  const RANGE_X = 276;        // admissible range start
  const PILL_X = 368;         // Bom/Neutro pill left edge
  const PILL_W = 52;
  const PILL_MID = PILL_X + PILL_W / 2;

  // Header y
  const HDR_Y = 22;
  const SEP_Y = PAD_TOP - 6;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${VIEW_W} ${TOTAL_H}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ── Column headers ── */}
      <text x={LABEL_X} y={HDR_Y} fontSize="9" fill="currentColor" className="text-gray-400" fontWeight="600" letterSpacing="0.8">
        {t('PERFORMANCE')}
      </text>
      <text x={VAL_X} y={HDR_Y} fontSize="9" fill="currentColor" className="text-gray-400" fontWeight="600" textAnchor="end" letterSpacing="0.8">
        {t('PONTOS')}
      </text>
      <text x={RANGE_X} y={HDR_Y} fontSize="9" letterSpacing="0" fill="currentColor" className="text-gray-300">
        {t('intervalo')}
      </text>
      {/* Header separator */}
      <line x1={AX} y1={SEP_Y} x2={VIEW_W - 4} y2={SEP_Y} strokeWidth={1} className="stroke-gray-100" />

      {/* ── Axis ── */}
      <line x1={AX} y1={PAD_TOP} x2={AX} y2={PAD_TOP + H} strokeWidth={1.5} className="stroke-gray-300" />

      {sorted.map((sv, i) => {
        const iy = yOf(sv.value);
        const level = levelMap.get(sv.levelId);
        const isNeutral = sv.levelId === neutralId;
        const isGood = sv.levelId === goodId;
        const tickLen = isNeutral || isGood ? 14 : 8;
        // Classes, not hex: an SVG fill is exactly the kind of thing a
        // class-name remap never reached, and these have to follow the palette.
        const tickClass = isGood ? 'stroke-green-500' : isNeutral ? 'stroke-indigo-500' : 'stroke-gray-400';
        const labelClass = isGood ? 'text-green-700' : isNeutral ? 'text-indigo-700' : 'text-gray-700';

        const next = sorted[i + 1];
        const gapVal = next ? sv.value - next.value : null;
        const nextY = next ? yOf(next.value) : null;
        const gapMidY = nextY != null ? (iy + nextY) / 2 : null;

        return (
          <g key={sv.levelId}>
            {/* Each row is positioned by a transform rather than by absolute y
                coordinates, so a changed answer slides the level to its new place
                instead of teleporting it. Watching which level moved, and how
                far, is most of what makes the connection between the answer and
                the scale legible. */}
            <g
              style={{
                transform: `translateY(${iy}px)`,
                transition: 'transform 420ms cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}
            >
              {/* ── Tick ── */}
              <line
                x1={AX} y1={0}
                x2={AX + tickLen} y2={0}
                strokeWidth={isNeutral || isGood ? 2.5 : 1.5}
                className={tickClass}
              />

              {/* ── Level label (Performance column) ── */}
              <text
                x={LABEL_X} y={4}
                fontSize="11" fill="currentColor"
                fontWeight={isNeutral || isGood ? '600' : '400'}
                className={labelClass}
              >
                {level?.label}
              </text>

              {/* ── Score value (Pontos column) ── */}
              <text
                x={VAL_X} y={4}
                fontSize="10.5" fill="currentColor"
                textAnchor="end"
                fontFamily="monospace"
                fontWeight={isNeutral || isGood ? '700' : '400'}
                className="text-gray-700"
              >
                {sv.value.toFixed(1)}
              </text>

              {/* ── Admissible range ── */}
              <text
                x={RANGE_X} y={4}
                fontSize="8.5" fill="currentColor"
                className="text-gray-300"
              >
                [{sv.admissibleRange[0].toFixed(0)}, {sv.admissibleRange[1].toFixed(0)}]
              </text>

              {/* ── Bom / Neutro pill ── */}
              {isGood && (
                <g>
                  <rect x={PILL_X} y={-8} width={PILL_W} height={14} rx={4} className="fill-green-100" />
                  <text x={PILL_MID} y={3} fontSize="9" fontWeight="bold" textAnchor="middle" className="fill-green-700">
                    {t('Bom')}
                  </text>
                </g>
              )}
              {isNeutral && (
                <g>
                  <rect x={PILL_X} y={-8} width={PILL_W} height={14} rx={4} className="fill-indigo-100" />
                  <text x={PILL_MID} y={3} fontSize="9" fontWeight="bold" textAnchor="middle" className="fill-indigo-700">
                    {t('Neutro')}
                  </text>
                </g>
              )}
            </g>

            {/* ── Gap bracket (left of axis, fully inside viewBox) ── */}
            {gapVal !== null && gapMidY !== null && nextY !== null && gapVal > 0.5 && (
              <g>
                {/* Bracket vertical line */}
                <line x1={AX - 10} y1={iy + 3} x2={AX - 10} y2={nextY - 3} strokeWidth={1} className="stroke-gray-200" />
                {/* Bracket top cap */}
                <line x1={AX - 13} y1={iy + 3} x2={AX - 10} y2={iy + 3} strokeWidth={1} className="stroke-gray-200" />
                {/* Bracket bottom cap */}
                <line x1={AX - 13} y1={nextY - 3} x2={AX - 10} y2={nextY - 3} strokeWidth={1} className="stroke-gray-200" />
                {/* Gap value label, right-aligned so it never overflows left edge */}
                <text
                  x={AX - 16} y={gapMidY + 4}
                  fontSize="9" fill="currentColor" className="text-gray-400"
                  textAnchor="end" fontStyle="italic"
                >
                  +{gapVal.toFixed(1)}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Piecewise-linear formula display ─────────────────────────────────────────

function ScaleFormula({
  scale,
  criterion,
}: {
  scale: DerivedScale;
  criterion: QualificationCriterion;
}) {
  const { t } = useTranslation();
  const levels = criterion.descriptor.levels;
  const levelMap = new Map(levels.map((l) => [l.id, l]));

  // Nodes on the normalized position axis (0 = least attractive, 1 = most),
  // then a smooth monotone-cubic curve sampled densely through them.
  const nodes = scalePoints(criterion.descriptor, scale); // [{x: pos, y: value}] ascending
  // Position each level directly rather than reverse-matching a node by value:
  // two levels that derive to the same value would otherwise both claim the
  // same node, producing duplicate axis ticks (and duplicate React keys).
  const labelByPos = new Map(levels.map((l) => [l.id, levelPosition(criterion.descriptor, l.id)] as const));
  const curve = sampleCurve(nodes, 60).map((p) => ({ pos: p.x, value: p.y }));

  // Map a position back to the nearest level label for axis ticks / tooltip
  const nearestLabel = (pos: number): string => {
    let best = levels[0]?.label ?? '';
    let bestD = Infinity;
    for (const l of levels) {
      const lp = labelByPos.get(l.id);
      if (lp == null) continue;
      const d = Math.abs(lp - pos);
      if (d < bestD) { bestD = d; best = l.label; }
    }
    return best;
  };

  const tickPositions = [
    ...new Set(
      levels.map((l) => labelByPos.get(l.id)).filter((x): x is number => x != null),
    ),
  ].sort((a, b) => a - b);

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: { payload: { pos: number; value: number } }[];
  }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-gray-200 rounded px-2 py-1 text-xs shadow">
        <p className="font-medium text-gray-700">{nearestLabel(d.pos)}</p>
        <p className="text-blue-600">v = {d.value.toFixed(2)}</p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div>
        <p className="text-xs text-gray-500 mb-1">
          {t('Escala cardinal — curva suave (interpolação monótona) do nível menos atrativo (esquerda) ao mais atrativo (direita)')}
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={curve} margin={{ top: 8, right: 16, left: 0, bottom: 32 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--n-200))" />
            <XAxis
              dataKey="pos"
              type="number"
              domain={[0, 1]}
              ticks={tickPositions}
              tickFormatter={(v) => nearestLabel(Number(v))}
              tick={{ fontSize: 9, angle: -25, textAnchor: 'end' } as object}
              interval={0}
            />
            <YAxis tick={{ fontSize: 10 }} width={36} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="rgb(var(--n-400))" strokeDasharray="4 2" label={{ value: t('Neutro'), fontSize: 10, fill: 'rgb(var(--n-400))' }} />
            <ReferenceLine y={100} stroke="rgb(var(--m-500))" strokeDasharray="4 2" label={{ value: t('Bom'), fontSize: 10, fill: 'rgb(var(--m-500))' }} />
            <Line type="linear" dataKey="value" stroke="rgb(var(--v-500))" strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
            {/* Mark the exact derived nodes the curve passes through */}
            {nodes.map((nd, i) => (
              <ReferenceDot key={i} x={nd.x} y={nd.y} r={3.5} fill="rgb(var(--v-600))" stroke="rgb(var(--surface))" strokeWidth={1} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Node values */}
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-1">{t('Valores cardinais derivados (a curva passa exatamente por estes pontos):')}</p>
        <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs text-gray-700 grid grid-cols-2 sm:grid-cols-3 gap-1">
          {[...scale.values]
            .sort((a, b) => b.value - a.value)
            .map((sv) => (
              <span key={sv.levelId}>
                <strong>{levelMap.get(sv.levelId)?.label}</strong>: {sv.value.toFixed(1)}
              </span>
            ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-1">
          {t('A escala de valor é a interpolação monótona-cúbica (PCHIP) que passa por todos os pontos derivados — suave (sem pontos de corte) e sem oscilações. Âncoras: Neutro = 0, Bom = 100. Desempenhos contínuos são lidos diretamente desta curva.')}
        </p>
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Scales() {
  const { t } = useTranslation();
  const { state, dispatch } = useApp();
  const model = state.model!;
  const [derivingId, setDerivingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [activePairKey, setActivePairKey] = useState<string | null>(null);
  // Ruler mode is a second input surface for the same judgments, kept per
  // criterion so switching criteria does not carry a stale position map.
  const [rulerFor, setRulerFor] = useState<string | null>(null);
  const [rulerValues, setRulerValues] = useState<LevelValues>({});
  // Why the current criterion's matrix is inconsistent, in terms of the answers
  // given — recomputed whenever a derivation comes back with margin ≤ 0.
  const [diagnosis, setDiagnosis] = useState<Record<string, ScaleDiagnosis>>({});

  const qualCriteria = Object.values(model.valueTree.criteria).filter(
    (c) => c.type === 'qualification',
  ) as QualificationCriterion[];

  function getMatrix(criterionId: string): JudgmentMatrix {
    return (
      model.judgmentMatrices.find(
        (m) => m.kind === 'scale' && m.criterionId === criterionId,
      ) ?? {
        id: uuidv4(),
        kind: 'scale',
        criterionId,
        assessorId: DEFAULT_ASSESSOR_ID,
        judgments: {},
        updatedAt: new Date().toISOString(),
      }
    );
  }

  function updateMatrix(criterionId: string, judgments: Record<string, MacbethJudgment>) {
    const existing = model.judgmentMatrices.find(
      (m) => m.kind === 'scale' && m.criterionId === criterionId,
    );
    const updated: JudgmentMatrix = existing
      ? { ...existing, judgments, updatedAt: new Date().toISOString() }
      : {
          id: uuidv4(),
          kind: 'scale',
          criterionId,
          assessorId: DEFAULT_ASSESSOR_ID,
          judgments,
          updatedAt: new Date().toISOString(),
        };
    dispatch({
      type: 'UPDATE_MODEL',
      patch: {
        judgmentMatrices: [
          ...model.judgmentMatrices.filter(
            (m) => !(m.kind === 'scale' && m.criterionId === criterionId),
          ),
          updated,
        ],
      },
    });
  }

  function storeScale(criterionId: string, scale: DerivedScale) {
    dispatch({
      type: 'UPDATE_MODEL',
      patch: {
        derivedScales: [
          ...model.derivedScales.filter((s) => s.criterionId !== criterionId),
          scale,
        ],
      },
    });
  }

  async function handleDerive(criterionId: string) {
    const crit = model.valueTree.criteria[criterionId];
    if (crit?.type !== 'qualification') return;
    const matrix = getMatrix(criterionId);
    setDerivingId(criterionId);
    try {
      const scale = await deriveScale(criterionId, crit.descriptor, matrix);
      storeScale(criterionId, scale);
      // An inconsistent matrix is where the assessor most needs help, so work
      // out *which* answers disagree instead of only reporting that some do.
      if (scale.consistencyMargin <= 0) {
        const d = await diagnoseScale(crit.descriptor, matrix.judgments);
        setDiagnosis((prev) => ({ ...prev, [criterionId]: d }));
      } else {
        setDiagnosis((prev) => {
          const next = { ...prev };
          delete next[criterionId];
          return next;
        });
      }
    } finally {
      setDerivingId(null);
    }
  }

  /** Overwrite one judgment and re-derive — the one-click conflict resolution. */
  async function fixJudgment(criterionId: string, key: string, category: MacbethCategory) {
    const matrix = getMatrix(criterionId);
    updateMatrix(criterionId, { ...matrix.judgments, [key]: { kind: 'exact', category } });
    const crit = model.valueTree.criteria[criterionId];
    if (crit?.type !== 'qualification') return;
    const next = { ...matrix.judgments, [key]: { kind: 'exact' as const, category } };
    const scale = await deriveScale(criterionId, crit.descriptor, { ...matrix, judgments: next });
    storeScale(criterionId, scale);
    const d = scale.consistencyMargin > 0 ? null : await diagnoseScale(crit.descriptor, next);
    setDiagnosis((prev) => {
      const out = { ...prev };
      if (d) out[criterionId] = d;
      else delete out[criterionId];
      return out;
    });
  }

  function getScale(criterionId: string): DerivedScale | undefined {
    return model.derivedScales.find((s) => s.criterionId === criterionId);
  }

  const activeCrit = selected
    ? qualCriteria.find((c) => c.id === selected) ?? qualCriteria[0]
    : qualCriteria[0];

  /**
   * On arrival, derive any criterion that already has a full set of judgments
   * but no scale — a model opened from a template or an import carries the
   * answers without the solved scales, and making the user visit each criterion
   * in turn to trigger a calculation they did not ask for is busywork.
   * Criteria that already have a scale are left alone, so values placed on the
   * ruler are not quietly re-solved.
   */
  const backfilled = useRef(false);
  useEffect(() => {
    if (backfilled.current || qualCriteria.length === 0) return;
    backfilled.current = true;
    const pending = qualCriteria.filter((c) => {
      if (model.derivedScales.some((s) => s.criterionId === c.id)) return false;
      const n = c.descriptor.levels.length;
      return Object.keys(getMatrix(c.id).judgments).length >= (n * (n - 1)) / 2 && n > 1;
    });
    if (pending.length === 0) return;
    // One dispatch for all of them. Dispatching per criterion would have each
    // patch built from the same render's `model`, so every scale but the last
    // would be dropped on the floor.
    void (async () => {
      const solved = await Promise.all(
        pending.map((c) => deriveScale(c.id, c.descriptor, getMatrix(c.id))),
      );
      dispatch({
        type: 'UPDATE_MODEL',
        patch: {
          derivedScales: [
            ...model.derivedScales.filter((s) => !pending.some((c) => c.id === s.criterionId)),
            ...solved,
          ],
        },
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Derive as soon as this criterion's comparisons are all answered — same
   * reason as the weighting groups: a button sitting below the questions with no
   * visible link to them leaves the screen looking finished while the scale is
   * still stale. Keyed on the judgments so re-renders don't re-solve.
   */
  const activeJudgmentsKey = activeCrit ? JSON.stringify(getMatrix(activeCrit.id).judgments) : '';
  const lastDerived = useRef<string | null>(null);
  useEffect(() => {
    if (!activeCrit || rulerFor === activeCrit.id) return;
    const n = activeCrit.descriptor.levels.length;
    const pairCount = (n * (n - 1)) / 2;
    const judgments = getMatrix(activeCrit.id).judgments;
    if (Object.keys(judgments).length < pairCount) return;
    const key = `${activeCrit.id}:${activeJudgmentsKey}`;
    if (lastDerived.current === key) return;
    lastDerived.current = key;
    void handleDerive(activeCrit.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJudgmentsKey, activeCrit?.id, rulerFor]);

  if (qualCriteria.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 text-center text-gray-400">
        <p>{t('Sem critérios de qualificação definidos.')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
      {/* Sidebar — horizontal scroll strip on mobile, vertical list on ≥sm */}
      <div className="w-full sm:w-48 shrink-0 flex sm:flex-col gap-2 sm:gap-1 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
        {qualCriteria.map((c) => {
          const scale = getScale(c.id);
          const isActive = activeCrit?.id === c.id;
          const path = ancestorLabels(model, c.id);
          return (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`shrink-0 w-44 sm:w-full text-left px-3 py-2 rounded-lg text-sm transition-colors border sm:border-0 ${
                isActive
                  ? 'bg-blue-100 text-blue-800 font-medium border-blue-200'
                  : 'hover:bg-gray-100 text-gray-600 border-gray-200'
              }`}
            >
              {path.length > 0 && (
                <span className="block text-[10px] text-gray-400 truncate">{path.join(' › ')} ›</span>
              )}
              <span className="block truncate">{c.label}</span>
              {scale ? (
                <span className={`text-xs ${scale.consistencyMargin > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {scale.consistencyMargin > 0 ? t('✓ Derivada') : t('✗ Inconsistente')}
                </span>
              ) : (
                <span className="text-xs text-gray-400">{t('Por derivar')}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main area */}
      {activeCrit && (() => {
        /**
         * Judging a difference in the abstract is the hard part. Fixing the
         * first answered pair as an explicit reference turns every later
         * question into a comparison against something already decided, which
         * is a far easier judgment to make.
         */
        const levels = activeCrit.descriptor.levels;
        const labelOf = (id: string) => levels.find((l) => l.id === id)?.label ?? '';
        const answered = Object.entries(getMatrix(activeCrit.id).judgments)
          .map(([key, j]) => {
            const [a, b] = key.split('__');
            const cat = j.kind === 'exact' ? j.category : j.lo;
            return { key, from: labelOf(b), to: labelOf(a), cat };
          })
          .filter((x) => x.from && x.to);
        const reference = answered[0];
        const referenceJump = reference ? `${reference.from} → ${reference.to}` : '';

        const inRuler = rulerFor === activeCrit.id;
        /** Enter ruler mode seeded from the derived scale, else an even spread. */
        function openRuler() {
          const derived = model.derivedScales.find((s) => s.criterionId === activeCrit!.id);
          const seed: LevelValues = derived
            ? Object.fromEntries(derived.values.map((v) => [v.levelId, Math.round(v.value)]))
            : defaultLevelValues(activeCrit!);
          setRulerValues(seed);
          setRulerFor(activeCrit!.id);
        }
        /**
         * The positions are the scale. They are translated into the same C0–C6
         * judgments the questions produce and stored alongside, but the numbers
         * kept are the ones the assessor placed — the LP is used for the margin
         * and the admissible ranges, not to pick a different admissible scale.
         */
        async function applyRuler() {
          const crit = activeCrit!;
          const judgments = judgmentsFromLevelValues(crit, rulerValues);
          // Claim this judgment set before writing it, or the auto-derive effect
          // sees a freshly-completed matrix and re-solves — throwing away the
          // positions this mode exists to preserve.
          lastDerived.current = `${crit.id}:${JSON.stringify(judgments)}`;
          updateMatrix(crit.id, judgments);
          setRulerFor(null);
          setDerivingId(crit.id);
          try {
            storeScale(crit.id, await scaleFromValues(crit.id, crit.descriptor, rulerValues, judgments));
          } finally {
            setDerivingId(null);
          }
        }

        return (
        <div className="flex-1 space-y-6 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="font-semibold text-gray-800">{activeCrit.label}</h2>
            <button
              onClick={() => (inRuler ? setRulerFor(null) : openRuler())}
              className="px-3.5 py-1.5 text-sm rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              {inRuler ? t('⇄ Modo perguntas') : t('⇄ Modo régua')}
            </button>
            <span className="text-xs text-gray-400">
              {derivingId === activeCrit.id
                ? t('A calcular a escala…')
                : t('A escala calcula-se sozinha quando as comparações estiverem completas.')}
            </span>
          </div>

          {/* ── Contradiction, stated in terms of the answers that caused it ──
              Placed above the questions: it is what the assessor has to act on,
              and "margem: −1.000" under a collapsed matrix was neither findable
              nor actionable. */}
          {(() => {
            const scale = getScale(activeCrit.id);
            if (!scale || scale.consistencyMargin > 0) return null;
            const d = diagnosis[activeCrit.id];
            const labelOfLevel = (id: string) => levels.find((l) => l.id === id)?.label ?? id;
            const first = d?.conflicts[0];
            return (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5" role="status">
                <div className="flex items-start gap-3">
                  <span className="text-rose-600 text-lg leading-none mt-0.5" aria-hidden="true">⚠</span>
                  <div className="flex-1 min-w-0 space-y-2">
                    {first ? (
                      <>
                        <p className="font-bold text-rose-900 text-sm">{t('Duas respostas contradizem-se')}</p>
                        <p className="text-[13px] text-rose-900/90 leading-relaxed">
                          {t('Disse que o salto de')}{' '}
                          <strong>{labelOfLevel(first.narrow.fromId)} → {labelOfLevel(first.narrow.toId)}</strong>{' '}
                          {t('é')} <strong>{t(CATEGORIES[catOf(first.narrow.judgment)]?.label ?? '')}</strong>,{' '}
                          {t('mas o salto de')}{' '}
                          <strong>{labelOfLevel(first.wide.fromId)} → {labelOfLevel(first.wide.toId)}</strong>{' '}
                          — {t('que contém o primeiro e ainda mais')} — {t('é apenas')}{' '}
                          <strong>{t(CATEGORIES[catOf(first.wide.judgment)]?.label ?? '')}</strong>.{' '}
                          {t('Um salto maior não pode valer menos do que um dos seus troços.')}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            onClick={() => fixJudgment(activeCrit.id, first.wide.key, minimumCategoryFor(first))}
                            className="px-3.5 py-1.5 text-sm font-semibold bg-danger text-white rounded-lg hover:bg-danger-strong"
                          >
                            {t('Corrigir para «{{cat}}»', { cat: t(CATEGORIES[minimumCategoryFor(first)]?.label ?? '') })}
                          </button>
                          <span className="text-xs text-rose-800/70">
                            {t('A correção sugerida é a que menos se afasta do que respondeu.')}
                          </span>
                        </div>
                      </>
                    ) : d?.fallback ? (
                      <>
                        <p className="font-bold text-rose-900 text-sm">{t('As respostas não são compatíveis entre si')}</p>
                        <p className="text-[13px] text-rose-900/90 leading-relaxed">
                          {t('A contradição envolve várias respostas ao mesmo tempo, por isso não há um par único a apontar. Alterar')}{' '}
                          <strong>
                            {labelOfLevel(d.fallback.key.split('__')[1])} → {labelOfLevel(d.fallback.key.split('__')[0])}
                          </strong>{' '}
                          {t('para')} <strong>{t(CATEGORIES[d.fallback.suggested]?.label ?? '')}</strong>{' '}
                          {t('resolve-a.')}
                        </p>
                        <button
                          onClick={() => fixJudgment(activeCrit.id, d.fallback!.key, d.fallback!.suggested)}
                          className="px-3.5 py-1.5 text-sm font-semibold bg-danger text-white rounded-lg hover:bg-danger-strong"
                        >
                          {t('Aplicar esta correção')}
                        </button>
                      </>
                    ) : (
                      <p className="text-[13px] text-rose-900/90">
                        {t('As respostas contêm uma contradição. Reveja-as abaixo: um salto maior não pode valer menos do que um salto que ele contenha.')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {inRuler ? (
            <>
              <p className="text-sm text-gray-500 leading-relaxed">
                <strong className="text-gray-700">{t('Os valores que colocar são os que ficam.')}</strong>{' '}
                {t('Cada posição implica um juízo MACBETH (à direita) e a escala resultante é, por construção, coerente com esses juízos. A faixa clara ao lado de cada nível é o troço em que o pode arrastar sem mudar nenhum juízo. Neutro e Bom estão fixos em 0 e 100, e nenhum nível pode passar à frente de outro.')}
              </p>
              <div className="grid lg:grid-cols-[1fr_22rem] gap-5 items-start">
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <ValueRuler criterion={activeCrit} values={rulerValues} onChange={setRulerValues} />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    {t('Juízos MACBETH deduzidos')} <span className="text-indigo-600">· {t('ao vivo')}</span>
                  </p>
                  <p className="text-xs text-gray-400 leading-relaxed pb-1">
                    {t('Todos os pares, não só os adjacentes — é o que o método exige.')}
                  </p>
                  {pairReadings(activeCrit, rulerValues).map((r) => (
                    <div key={r.key} className="flex items-center gap-2.5 rounded-xl border border-gray-100 px-3 py-2">
                      <span
                        className="w-1.5 rounded-full bg-indigo-500 shrink-0"
                        style={{ height: 6 + r.cat * 4 }}
                        aria-hidden="true"
                      />
                      <span className="flex-1 min-w-0 truncate text-xs text-gray-600">{r.from} → {r.to}</span>
                      <span className="font-mono text-[11px] text-gray-400 tabular-nums">{r.delta}</span>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 shrink-0">
                        {t(r.label)}
                      </span>
                    </div>
                  ))}
                  <button
                    onClick={applyRuler}
                    className="w-full mt-3 px-4 py-2 bg-accent text-white rounded-full text-sm font-semibold hover:bg-accent-strong"
                  >
                    {t('Aplicar esta escala')}
                  </button>
                </div>
              </div>
            </>
          ) : (
          <>
          {/* Answers already given, as bars — the scale you are judging against
              stays visible instead of having to be held in memory. */}
          {answered.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {t('Juízos já dados — julgue por comparação')}
              </p>
              {answered.map((a, i) => (
                <div
                  key={a.key}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 border text-sm ${
                    i === 0 ? 'border-indigo-300 bg-indigo-50' : 'border-gray-100'
                  }`}
                >
                  <span
                    className="w-1.5 rounded-full bg-indigo-500 shrink-0"
                    style={{ height: CATEGORIES[a.cat]?.weight ? 6 + a.cat * 4 : 6 }}
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate text-gray-600">{a.from} → {a.to}</span>
                  {i === 0 && (
                    <span className="text-[9px] font-bold uppercase tracking-wide text-indigo-600">{t('referência')}</span>
                  )}
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 shrink-0">
                    {t(CATEGORIES[a.cat]?.label ?? '')}
                  </span>
                </div>
              ))}
            </div>
          )}

          <GuidedJudgments
            items={activeCrit.descriptor.levels.map((l) => ({ id: l.id, label: l.label }))}
            judgments={getMatrix(activeCrit.id).judgments}
            onChange={(j) => updateMatrix(activeCrit.id, j)}
            onActivePairChange={setActivePairKey}
            emptyHint="São necessários pelo menos 2 níveis."
            renderQuestion={(more, less) => (
              <>
                {t('Que ganho representa subir de')}{' '}
                <span className="inline-block bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 font-semibold text-gray-700">{less.label}</span>
                {' '}{t('para')}{' '}
                <span className="inline-block bg-indigo-50 border border-indigo-300 rounded-lg px-2 py-0.5 font-bold text-indigo-700">{more.label}</span>
                ?
                {referenceJump && (
                  <span className="block text-sm font-normal text-gray-500 mt-2">
                    {t('Comparado com o salto de referência ({{ref}}), este ganho é…', { ref: referenceJump })}
                  </span>
                )}
              </>
            )}
          />

          {/* Collapsed by default — the guided questions above collect the same
              judgments; the grid is the power-user view of them. */}
          <details className="border-t border-gray-100 pt-4 group">
            <summary className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 cursor-pointer select-none flex items-center gap-1.5 hover:text-gray-700">
              <span className="transition-transform group-open:rotate-90">▸</span> {t('Matriz de juízos')}
            </summary>
            <JudgmentMatrixEditor
              items={activeCrit.descriptor.levels}
              judgments={getMatrix(activeCrit.id).judgments}
              onChange={(j) => updateMatrix(activeCrit.id, j)}
              activePairKey={activePairKey ?? undefined}
            />
          </details>
          </>
          )}

          {/* Scale display — or, when the answers contradict, why they do ── */}
          {(() => {
            const scale = getScale(activeCrit.id);
            if (!scale) return null;

            // The inconsistency case is rendered above the answers instead —
            // it is the first thing to read, not a footnote under the matrix.
            if (scale.consistencyMargin <= 0) {
              return (
                <div className="border-2 border-dashed border-gray-200 rounded-2xl px-5 py-7 text-center space-y-1">
                  <p className="text-sm font-semibold text-gray-600">
                    {t('A escala aparece aqui quando as respostas forem coerentes.')}
                  </p>
                  <p className="text-xs text-gray-400">
                    {t('Não é mostrado nenhum valor até lá — um zero em todos os níveis não é uma escala, é a ausência de uma.')}
                  </p>
                </div>
              );
            }

            return (
              <div className="border border-gray-200 rounded-xl p-5 bg-white space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">{t('Escala derivada')}</h3>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700"
                    title={t('Margem de discriminação z = {{m}} — quanto maior, mais folgadamente as respostas se separam umas das outras.', { m: scale.consistencyMargin.toFixed(3) })}
                  >
                    ✓ {t('coerente')}
                  </span>
                </div>

                {/* Ruler / Thermometer */}
                <div>
                  <p className="text-xs text-gray-500 mb-3">
                    {t('Régua de valor — níveis posicionados proporcionalmente ao seu valor cardinal')}
                  </p>
                  <ScaleRuler scale={scale} criterion={activeCrit} />
                </div>

                {/* Formula + Chart */}
                <div className="border-t border-gray-100 pt-4">
                  <ScaleFormula scale={scale} criterion={activeCrit} />
                </div>
              </div>
            );
          })()}
        </div>
        );
      })()}
      </div>

      <ScreenNav
        next="decision"
        nextLabel="Perfis de decisão"
        hint="Com escalas e pesos definidos, construa os perfis de decisão (limiares MACBETH)."
        blockedBy={
          qualCriteria.some((c) => !model.derivedScales.find((s) => s.criterionId === c.id && s.consistencyMargin > 0))
            ? 'Derive e valide a escala de todos os critérios antes de avançar.'
            : undefined
        }
      />
    </div>
  );
}
