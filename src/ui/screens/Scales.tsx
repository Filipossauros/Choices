import { useState } from 'react';
import { useApp } from '../store';
import type { MacbethJudgment, MacbethCategory, JudgmentMatrix, DerivedScale, QualificationCriterion } from '../../domain/types';
import { DEFAULT_ASSESSOR_ID } from '../../domain/types';
import { deriveScale, scalePoints } from '../../engine/scaling';
import { sampleCurve } from '../../engine/interpolation';
import JudgmentMatrixEditor from '../components/JudgmentMatrixEditor';
import ScreenNav from '../components/ScreenNav';
import { ancestorLabels } from '../../domain/tree';
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

// ── Scale ruler ───────────────────────────────────────────────────────────────

function ScaleRuler({
  scale,
  criterion,
}: {
  scale: DerivedScale;
  criterion: QualificationCriterion;
}) {
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
      <text x={LABEL_X} y={HDR_Y} fontSize="9" fill="#9ca3af" fontWeight="600" letterSpacing="0.8">
        PERFORMANCE
      </text>
      <text x={VAL_X} y={HDR_Y} fontSize="9" fill="#9ca3af" fontWeight="600" textAnchor="end" letterSpacing="0.8">
        PONTOS
      </text>
      <text x={RANGE_X} y={HDR_Y} fontSize="9" fill="#e5e7eb" letterSpacing="0">
        intervalo
      </text>
      {/* Header separator */}
      <line x1={AX} y1={SEP_Y} x2={VIEW_W - 4} y2={SEP_Y} stroke="#f3f4f6" strokeWidth={1} />

      {/* ── Axis ── */}
      <line x1={AX} y1={PAD_TOP} x2={AX} y2={PAD_TOP + H} stroke="#d1d5db" strokeWidth={1.5} />

      {sorted.map((sv, i) => {
        const iy = yOf(sv.value);
        const level = levelMap.get(sv.levelId);
        const isNeutral = sv.levelId === neutralId;
        const isGood = sv.levelId === goodId;
        const tickLen = isNeutral || isGood ? 14 : 8;
        const tickStroke = isGood ? '#16a34a' : isNeutral ? '#2563eb' : '#94a3b8';
        const labelFill = isGood ? '#15803d' : isNeutral ? '#1d4ed8' : '#374151';

        const next = sorted[i + 1];
        const gapVal = next ? sv.value - next.value : null;
        const nextY = next ? yOf(next.value) : null;
        const gapMidY = nextY != null ? (iy + nextY) / 2 : null;

        return (
          <g key={sv.levelId}>
            {/* ── Tick ── */}
            <line
              x1={AX} y1={iy}
              x2={AX + tickLen} y2={iy}
              stroke={tickStroke}
              strokeWidth={isNeutral || isGood ? 2.5 : 1.5}
            />

            {/* ── Level label (Performance column) ── */}
            <text
              x={LABEL_X} y={iy + 4}
              fontSize="11" fill={labelFill}
              fontWeight={isNeutral || isGood ? '600' : '400'}
            >
              {level?.label}
            </text>

            {/* ── Score value (Pontos column) ── */}
            <text
              x={VAL_X} y={iy + 4}
              fontSize="10.5" fill="#374151"
              textAnchor="end"
              fontFamily="monospace"
              fontWeight={isNeutral || isGood ? '700' : '400'}
            >
              {sv.value.toFixed(1)}
            </text>

            {/* ── Admissible range ── */}
            <text
              x={RANGE_X} y={iy + 4}
              fontSize="8.5" fill="#d1d5db"
            >
              [{sv.admissibleRange[0].toFixed(0)}, {sv.admissibleRange[1].toFixed(0)}]
            </text>

            {/* ── Bom / Neutro pill ── */}
            {isGood && (
              <g>
                <rect x={PILL_X} y={iy - 8} width={PILL_W} height={14} rx={4} fill="#dcfce7" />
                <text x={PILL_MID} y={iy + 3} fontSize="9" fill="#16a34a" fontWeight="bold" textAnchor="middle">
                  Bom
                </text>
              </g>
            )}
            {isNeutral && (
              <g>
                <rect x={PILL_X} y={iy - 8} width={PILL_W} height={14} rx={4} fill="#dbeafe" />
                <text x={PILL_MID} y={iy + 3} fontSize="9" fill="#2563eb" fontWeight="bold" textAnchor="middle">
                  Neutro
                </text>
              </g>
            )}

            {/* ── Gap bracket (left of axis, fully inside viewBox) ── */}
            {gapVal !== null && gapMidY !== null && nextY !== null && gapVal > 0.5 && (
              <g>
                {/* Bracket vertical line */}
                <line x1={AX - 10} y1={iy + 3} x2={AX - 10} y2={nextY - 3} stroke="#e5e7eb" strokeWidth={1} />
                {/* Bracket top cap */}
                <line x1={AX - 13} y1={iy + 3} x2={AX - 10} y2={iy + 3} stroke="#e5e7eb" strokeWidth={1} />
                {/* Bracket bottom cap */}
                <line x1={AX - 13} y1={nextY - 3} x2={AX - 10} y2={nextY - 3} stroke="#e5e7eb" strokeWidth={1} />
                {/* Gap value label, right-aligned so it never overflows left edge */}
                <text
                  x={AX - 16} y={gapMidY + 4}
                  fontSize="9" fill="#9ca3af"
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
  const levels = criterion.descriptor.levels;
  const levelMap = new Map(levels.map((l) => [l.id, l]));

  // Nodes on the normalized position axis (0 = least attractive, 1 = most),
  // then a smooth monotone-cubic curve sampled densely through them.
  const nodes = scalePoints(criterion.descriptor, scale); // [{x: pos, y: value}] ascending
  const labelByPos = new Map(
    levels.map((l) => {
      const pos = nodes.find((p) =>
        scale.values.some((v) => v.levelId === l.id && Math.abs(v.value - p.y) < 1e-9),
      )?.x;
      return [l.id, pos] as const;
    }),
  );
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

  const tickPositions = levels
    .map((l) => labelByPos.get(l.id))
    .filter((x): x is number => x != null)
    .sort((a, b) => a - b);

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
          Escala cardinal — curva suave (interpolação monótona) do nível menos atrativo (esquerda) ao mais atrativo (direita)
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={curve} margin={{ top: 8, right: 16, left: 0, bottom: 32 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
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
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 2" label={{ value: 'Neutro', fontSize: 10, fill: '#94a3b8' }} />
            <ReferenceLine y={100} stroke="#16a34a" strokeDasharray="4 2" label={{ value: 'Bom', fontSize: 10, fill: '#16a34a' }} />
            <Line type="linear" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
            {/* Mark the exact derived nodes the curve passes through */}
            {nodes.map((nd, i) => (
              <ReferenceDot key={i} x={nd.x} y={nd.y} r={3.5} fill="#1d4ed8" stroke="#fff" strokeWidth={1} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Node values */}
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-1">Valores cardinais derivados (a curva passa exatamente por estes pontos):</p>
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
          A escala de valor é a interpolação monótona-cúbica (PCHIP) que passa por todos os pontos
          derivados — suave (sem pontos de corte) e sem oscilações. Âncoras: Neutro = 0, Bom = 100.
          Desempenhos contínuos são lidos diretamente desta curva.
        </p>
      </div>
    </div>
  );
}

// ── Guided-mode pair-by-pair judgment entry ───────────────────────────────────

const GUIDE_CATS: { value: MacbethCategory; label: string; bg: string; text: string; hint: string }[] = [
  { value: 0, label: 'Indiferente', bg: 'bg-gray-100 hover:bg-gray-200 border-gray-300', text: 'text-gray-700', hint: 'C0 — a diferença não tem relevância prática' },
  { value: 1, label: 'Muito fraca', bg: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300', text: 'text-emerald-800', hint: 'C1 — diferença quase imperceptível' },
  { value: 2, label: 'Fraca', bg: 'bg-teal-50 hover:bg-teal-100 border-teal-300', text: 'text-teal-800', hint: 'C2 — diferença pequena mas perceptível' },
  { value: 3, label: 'Moderada', bg: 'bg-yellow-50 hover:bg-yellow-100 border-yellow-400', text: 'text-yellow-800', hint: 'C3 — diferença claramente sentida' },
  { value: 4, label: 'Forte', bg: 'bg-orange-50 hover:bg-orange-100 border-orange-400', text: 'text-orange-800', hint: 'C4 — diferença significativa' },
  { value: 5, label: 'Muito forte', bg: 'bg-red-50 hover:bg-red-100 border-red-400', text: 'text-red-800', hint: 'C5 — diferença muito marcada' },
  { value: 6, label: 'Extrema', bg: 'bg-red-100 hover:bg-red-200 border-red-600', text: 'text-red-900', hint: 'C6 — diferença máxima concebível' },
];

interface GuidedModeProps {
  criterion: QualificationCriterion;
  judgments: Record<string, MacbethJudgment>;
  onChange: (j: Record<string, MacbethJudgment>) => void;
}

function GuidedMode({ criterion, judgments, onChange }: GuidedModeProps) {
  const levels = criterion.descriptor.levels;
  const [pairIdx, setPairIdx] = useState(0);

  // Build all upper-triangle pairs (row=more attractive, col=less attractive).
  // Same order as JudgmentMatrixEditor.
  const pairs: { idA: string; idB: string }[] = [];
  for (let ri = 0; ri < levels.length - 1; ri++) {
    for (let ci = ri + 1; ci < levels.length; ci++) {
      pairs.push({ idA: levels[ri].id, idB: levels[ci].id });
    }
  }

  const total = pairs.length;
  if (total === 0) return <p className="text-sm text-gray-400 italic">São necessários pelo menos 2 níveis.</p>;

  const safeIdx = Math.min(pairIdx, total - 1);
  const { idA, idB } = pairs[safeIdx];
  const labelA = levels.find((l) => l.id === idA)?.label ?? idA;
  const labelB = levels.find((l) => l.id === idB)?.label ?? idB;

  const key = `${idA}__${idB}`;
  const currentJ = judgments[key];
  const currentCat: MacbethCategory | null = currentJ
    ? currentJ.kind === 'exact'
      ? currentJ.category
      : currentJ.lo
    : null;

  function pick(cat: MacbethCategory) {
    onChange({ ...judgments, [key]: { kind: 'exact', category: cat } });
    // Auto-advance to next unanswered pair
    const nextUnanswered = pairs.findIndex((p, i) => i > safeIdx && !judgments[`${p.idA}__${p.idB}`]);
    if (nextUnanswered !== -1) setPairIdx(nextUnanswered);
    else if (safeIdx < total - 1) setPairIdx(safeIdx + 1);
  }

  const answered = pairs.filter((p) => judgments[`${p.idA}__${p.idB}`] !== undefined).length;

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Par {safeIdx + 1} de {total}</span>
          <span>{answered}/{total} respondidos</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(answered / total) * 100}%` }} />
        </div>
      </div>

      {/* Pair overview dots */}
      <div className="flex flex-wrap gap-1">
        {pairs.map((p, i) => {
          const done = !!judgments[`${p.idA}__${p.idB}`];
          const active = i === safeIdx;
          return (
            <button
              key={i}
              onClick={() => setPairIdx(i)}
              title={`${levels.find((l) => l.id === p.idA)?.label} vs ${levels.find((l) => l.id === p.idB)?.label}`}
              className={`w-5 h-5 rounded-full border text-[9px] font-bold transition-all ${
                active
                  ? 'bg-blue-600 border-blue-700 text-white scale-110'
                  : done
                  ? 'bg-green-500 border-green-600 text-white'
                  : 'bg-gray-100 border-gray-300 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Question card */}
      <div className="border border-blue-200 rounded-2xl bg-blue-50 p-5 space-y-4">
        <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Diferença de atratividade</p>
        <p className="text-base font-medium text-gray-800 leading-snug">
          Qual a diferença de atratividade de passar de{' '}
          <span className="inline-block bg-white border border-gray-300 rounded-lg px-2 py-0.5 font-semibold text-gray-700">{labelB}</span>
          {' '}para{' '}
          <span className="inline-block bg-white border border-blue-400 rounded-lg px-2 py-0.5 font-semibold text-blue-700">{labelA}</span>
          ?
        </p>

        {/* Category buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {GUIDE_CATS.map((cat) => {
            const active = currentCat === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => pick(cat.value)}
                title={cat.hint}
                className={`flex flex-col items-center gap-0.5 px-3 py-2.5 border rounded-xl text-xs font-semibold transition-all ${cat.bg} ${cat.text} ${
                  active ? 'ring-2 ring-blue-500 ring-offset-1 scale-105 shadow-sm' : ''
                }`}
              >
                <span className="text-[10px] font-normal opacity-60">C{cat.value}</span>
                {cat.label}
              </button>
            );
          })}
        </div>

        {currentJ && (
          <p className="text-xs text-blue-700 font-medium">
            ✓ Juízo registado: <strong>{GUIDE_CATS.find((c) => c.value === currentCat)?.label}</strong>
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setPairIdx(Math.max(0, safeIdx - 1))}
          disabled={safeIdx === 0}
          className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 text-gray-600"
        >
          ← Anterior
        </button>
        <button
          onClick={() => setPairIdx(Math.min(total - 1, safeIdx + 1))}
          disabled={safeIdx === total - 1}
          className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 text-gray-600"
        >
          Próximo →
        </button>
      </div>

      {/* MACBETH reference */}
      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer hover:text-gray-700 font-medium">Referência MACBETH — categorias C0–C6</summary>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1">
          {GUIDE_CATS.map((c) => (
            <span key={c.value} className="px-2 py-1 bg-gray-50 border border-gray-100 rounded-lg">
              <strong>C{c.value}</strong> — {c.label}
            </span>
          ))}
        </div>
        <p className="mt-2 text-gray-400 leading-relaxed">
          As categorias são ordinais: a diferença C4 (Forte) deve ser maior que C3 (Moderada), e assim por diante.
          O LP de consistência verifica que a ordenação cardinal dos juízos não contém contradições.
        </p>
      </details>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Scales() {
  const { state, dispatch } = useApp();
  const model = state.model!;
  const [derivingId, setDerivingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [guided, setGuided] = useState(false);

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

  async function handleDerive(criterionId: string) {
    const crit = model.valueTree.criteria[criterionId];
    if (crit?.type !== 'qualification') return;
    const matrix = getMatrix(criterionId);
    setDerivingId(criterionId);
    try {
      const scale = await deriveScale(criterionId, crit.descriptor, matrix);
      dispatch({
        type: 'UPDATE_MODEL',
        patch: {
          derivedScales: [
            ...model.derivedScales.filter((s) => s.criterionId !== criterionId),
            scale,
          ],
        },
      });
    } finally {
      setDerivingId(null);
    }
  }

  function getScale(criterionId: string): DerivedScale | undefined {
    return model.derivedScales.find((s) => s.criterionId === criterionId);
  }

  if (qualCriteria.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 text-center text-gray-400">
        <p>Sem critérios de qualificação definidos.</p>
      </div>
    );
  }

  const activeCrit = selected
    ? qualCriteria.find((c) => c.id === selected) ?? qualCriteria[0]
    : qualCriteria[0];

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      <div className="flex gap-6">
      {/* Sidebar */}
      <div className="w-48 shrink-0 space-y-1">
        {qualCriteria.map((c) => {
          const scale = getScale(c.id);
          const isActive = activeCrit?.id === c.id;
          const path = ancestorLabels(model, c.id);
          return (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-100 text-blue-800 font-medium'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              {path.length > 0 && (
                <span className="block text-[10px] text-gray-400 truncate">{path.join(' › ')} ›</span>
              )}
              <span className="block truncate">{c.label}</span>
              {scale ? (
                <span className={`text-xs ${scale.consistencyMargin > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {scale.consistencyMargin > 0 ? '✓ Derivada' : '✗ Inconsistente'}
                </span>
              ) : (
                <span className="text-xs text-gray-400">Por derivar</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main area */}
      {activeCrit && (
        <div className="flex-1 space-y-6 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="font-semibold text-gray-800">{activeCrit.label}</h2>
            <div className="flex items-center gap-2">
              {/* Mode toggle */}
              <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs">
                <button
                  onClick={() => setGuided(false)}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${!guided ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Avançado
                </button>
                <button
                  onClick={() => setGuided(true)}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${guided ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Guiado
                </button>
              </div>
              <button
                onClick={() => handleDerive(activeCrit.id)}
                disabled={derivingId === activeCrit.id}
                className="px-4 py-1.5 text-sm bg-blue-700 text-white rounded hover:bg-blue-800 disabled:opacity-50"
              >
                {derivingId === activeCrit.id ? 'A derivar…' : 'Derivar escala'}
              </button>
            </div>
          </div>

          {guided ? (
            <GuidedMode
              criterion={activeCrit}
              judgments={getMatrix(activeCrit.id).judgments}
              onChange={(j) => updateMatrix(activeCrit.id, j)}
            />
          ) : (
            <JudgmentMatrixEditor
              items={activeCrit.descriptor.levels}
              judgments={getMatrix(activeCrit.id).judgments}
              onChange={(j) => updateMatrix(activeCrit.id, j)}
            />
          )}

          {/* Scale display */}
          {(() => {
            const scale = getScale(activeCrit.id);
            if (!scale) return null;
            return (
              <div className="border border-gray-200 rounded-xl p-5 bg-white space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">Escala Derivada</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${scale.consistencyMargin > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    margem: {scale.consistencyMargin.toFixed(3)}
                  </span>
                </div>

                {scale.consistencyMargin <= 0 && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                    <span className="mt-0.5 shrink-0">⚠</span>
                    <span>
                      Escala inconsistente — os juízos contêm contradições cardinais. Revise a matriz acima: corrija pares de diferença de atratividade que violem a ordenação cardinal (p.ex. uma diferença «Forte» numa distância menor do que uma «Fraca»).
                    </span>
                  </div>
                )}

                {/* Ruler / Thermometer */}
                <div>
                  <p className="text-xs text-gray-500 mb-3">
                    Régua de valor — níveis posicionados proporcionalmente ao seu valor cardinal
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
      )}
      </div>

      <ScreenNav
        next="weighting"
        nextLabel="Ponderação"
        hint="Derive as escalas de todos os critérios antes de avançar."
        blockedBy={
          qualCriteria.some((c) => !model.derivedScales.find((s) => s.criterionId === c.id && s.consistencyMargin > 0))
            ? 'Derive e valide a escala de todos os critérios antes de avançar.'
            : undefined
        }
      />
    </div>
  );
}
