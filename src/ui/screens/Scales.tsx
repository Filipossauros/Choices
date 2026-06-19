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

  const H = 260;
  const PAD = 20;
  const TOTAL_H = H + PAD * 2;
  const AX = 12; // x position of axis line
  const VIEW_W = 380;

  const yOf = (v: number) => PAD + ((maxVal - v) / range) * H;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${VIEW_W} ${TOTAL_H}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: 'visible' }}
    >
      {/* Axis */}
      <line x1={AX} y1={PAD} x2={AX} y2={PAD + H} stroke="#cbd5e1" strokeWidth={1.5} />

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
            {/* Tick */}
            <line
              x1={AX} y1={iy} x2={AX + tickLen} y2={iy}
              stroke={tickStroke}
              strokeWidth={isNeutral || isGood ? 2.5 : 1.5}
            />

            {/* Level label */}
            <text
              x={AX + tickLen + 6} y={iy + 4}
              fontSize="11" fill={labelFill}
              fontWeight={isNeutral || isGood ? '600' : '400'}
            >
              {level?.label}
            </text>

            {/* Value (monospace, right-aligned at x=230) */}
            <text
              x={235} y={iy + 4}
              fontSize="10" fill="#6b7280"
              textAnchor="end"
              fontFamily="monospace"
            >
              {sv.value.toFixed(1)}
            </text>

            {/* Admissible range */}
            <text
              x={240} y={iy + 4}
              fontSize="9" fill="#d1d5db"
            >
              [{sv.admissibleRange[0].toFixed(0)},{sv.admissibleRange[1].toFixed(0)}]
            </text>

            {/* Bom / Neutro pill */}
            {isGood && (
              <g>
                <rect x={333} y={iy - 8} width={38} height={14} rx={4} fill="#dcfce7" />
                <text x={352} y={iy + 3} fontSize="9" fill="#16a34a" fontWeight="bold" textAnchor="middle">
                  Bom
                </text>
              </g>
            )}
            {isNeutral && (
              <g>
                <rect x={321} y={iy - 8} width={52} height={14} rx={4} fill="#dbeafe" />
                <text x={347} y={iy + 3} fontSize="9" fill="#2563eb" fontWeight="bold" textAnchor="middle">
                  Neutro
                </text>
              </g>
            )}

            {/* Gap bracket between this level and the next */}
            {gapVal !== null && gapMidY !== null && nextY !== null && gapVal > 0.5 && (
              <g>
                {/* Bracket: left vertical + two horizontals ([ shape on left of axis) */}
                <line x1={AX - 8} y1={iy + 2} x2={AX - 8} y2={nextY - 2} stroke="#e2e8f0" strokeWidth={1} />
                <line x1={AX - 11} y1={iy + 2} x2={AX - 8} y2={iy + 2} stroke="#e2e8f0" strokeWidth={1} />
                <line x1={AX - 11} y1={nextY - 2} x2={AX - 8} y2={nextY - 2} stroke="#e2e8f0" strokeWidth={1} />
                <text
                  x={AX - 13} y={gapMidY + 4}
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
