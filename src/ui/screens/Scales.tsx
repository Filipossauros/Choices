import { useState } from 'react';
import { useApp } from '../store';
import type { MacbethJudgment, JudgmentMatrix, DerivedScale, QualificationCriterion } from '../../domain/types';
import { DEFAULT_ASSESSOR_ID } from '../../domain/types';
import { deriveScale, scalePoints } from '../../engine/scaling';
import { sampleCurve } from '../../engine/interpolation';
import JudgmentMatrixEditor from '../components/JudgmentMatrixEditor';
import ScreenNav from '../components/ScreenNav';
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

// ── Scale ruler (thermometer) ─────────────────────────────────────────────────

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

  // Sort descending: highest value at top of ruler
  const sorted = [...scale.values].sort((a, b) => b.value - a.value);
  const maxVal = sorted[0]?.value ?? 100;
  const minVal = sorted[sorted.length - 1]?.value ?? 0;
  const range = maxVal - minVal || 1;

  const RULER_H = 320;
  const TOP_PAD = 16;
  const AXIS_X = 72; // px from left edge to axis line

  return (
    <div className="relative select-none" style={{ height: RULER_H + TOP_PAD + 24 }}>
      {/* Filled axis bar */}
      <div
        className="absolute bg-gradient-to-b from-blue-500 to-blue-200 rounded-full"
        style={{ left: AXIS_X - 1, top: TOP_PAD, width: 4, height: RULER_H }}
      />

      {sorted.map((sv, i) => {
        const level = levelMap.get(sv.levelId);
        const isNeutral = sv.levelId === neutralId;
        const isGood = sv.levelId === goodId;
        const topPx = TOP_PAD + ((maxVal - sv.value) / range) * RULER_H;

        // Gap annotation between this tick and the one below
        const next = sorted[i + 1];
        const gapDiff = next ? sv.value - next.value : null;
        const nextTopPx = next
          ? TOP_PAD + ((maxVal - next.value) / range) * RULER_H
          : null;
        const gapMidPx = nextTopPx !== null ? (topPx + nextTopPx) / 2 : null;

        const tickColor = isNeutral ? '#2563eb' : isGood ? '#16a34a' : '#94a3b8';
        const labelColor = isNeutral
          ? 'text-blue-700 font-semibold'
          : isGood
          ? 'text-green-700 font-semibold'
          : 'text-gray-700';

        return (
          <div key={sv.levelId}>
            {/* Tick row */}
            <div
              className="absolute flex items-center"
              style={{ top: topPx - 9, left: 0, right: 0 }}
            >
              {/* Value */}
              <span
                className="font-mono text-xs text-gray-500 text-right shrink-0"
                style={{ width: AXIS_X - 10 }}
              >
                {sv.value.toFixed(1)}
              </span>
              {/* Tick mark */}
              <div
                style={{
                  width: isNeutral || isGood ? 14 : 8,
                  height: 2,
                  backgroundColor: tickColor,
                  marginLeft: 6,
                  flexShrink: 0,
                }}
              />
              {/* Level name */}
              <span className={`ml-2 text-sm ${labelColor}`} title={level?.label}>
                {level?.label}
                {isNeutral && <span className="ml-1 text-xs text-blue-400 font-normal">(Neutro)</span>}
                {isGood && <span className="ml-1 text-xs text-green-400 font-normal">(Bom)</span>}
              </span>
              {/* Admissible range */}
              <span className="ml-auto mr-2 text-xs text-gray-400 whitespace-nowrap">
                [{sv.admissibleRange[0].toFixed(1)}, {sv.admissibleRange[1].toFixed(1)}]
              </span>
            </div>

            {/* Gap annotation */}
            {gapDiff !== null && gapMidPx !== null && gapDiff > 0.01 && (
              <div
                className="absolute flex items-center gap-1"
                style={{ top: gapMidPx - 7, left: AXIS_X + 18 }}
              >
                <span className="text-[10px] text-gray-400 italic">+{gapDiff.toFixed(1)}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
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

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Scales() {
  const { state, dispatch } = useApp();
  const model = state.model!;
  const [derivingId, setDerivingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

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
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">{activeCrit.label}</h2>
            <button
              onClick={() => handleDerive(activeCrit.id)}
              disabled={derivingId === activeCrit.id}
              className="px-4 py-1.5 text-sm bg-blue-700 text-white rounded hover:bg-blue-800 disabled:opacity-50"
            >
              {derivingId === activeCrit.id ? 'A derivar…' : 'Derivar escala'}
            </button>
          </div>

          <JudgmentMatrixEditor
            items={activeCrit.descriptor.levels}
            judgments={getMatrix(activeCrit.id).judgments}
            onChange={(j) => updateMatrix(activeCrit.id, j)}
          />

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
