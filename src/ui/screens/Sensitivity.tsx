import { useState } from 'react';
import { useApp } from '../store';
import { computeSensitivity } from '../../engine/sensitivity';
import { displayBands, bandRangeLabel } from '../../domain/decision';
import { resolveBands } from '../../engine/aggregation';
import { allGroupsConsistent, parentOf, weightsForGroup } from '../../domain/tree';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts';
import ScreenNav from '../components/ScreenNav';

const OPTION_COLORS = ['#3b82f6', '#16a34a', '#d97706', '#dc2626', '#8b5cf6', '#ec4899'];

export default function Sensitivity() {
  const { state } = useApp();
  const evaluation = state.evaluation!;
  const model = evaluation.model;

  const qualCriteria = Object.values(model.valueTree.criteria).filter((c) => c.type === 'qualification');

  // Single-select: the sensitivity view analyses one criterion at a time so the
  // chart's option lines (and their crossing points) stay legible.
  const [activeCriterionId, setActiveCriterionId] = useState<string>(
    () => qualCriteria[0]?.id ?? '',
  );

  // Within-group weight of a criterion (what the sensitivity analysis varies).
  function groupWeightOf(criterionId: string): number | undefined {
    const pid = parentOf(model.valueTree, criterionId);
    const gw = pid ? weightsForGroup(model, pid) : undefined;
    return gw?.weights.find((w) => w.criterionId === criterionId)?.weight;
  }

  if (!evaluation.aggregationResult || !allGroupsConsistent(model)) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 text-center text-gray-400">
        <p>Navegue para «Resultados» para calcular a agregação e activar a análise de sensibilidade.</p>
      </div>
    );
  }

  if (qualCriteria.length < 2) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 text-center text-gray-400">
        <p>São necessários pelo menos 2 critérios de qualificação para a análise de sensibilidade.</p>
      </div>
    );
  }

  const resolvedScale = resolveBands(model);
  const bandViews = displayBands(resolvedScale);
  const options = evaluation.options;
  // Use safe indexed keys for recharts dataKey (avoid UUID issues)
  const optKeys = options.map((_, i) => `v${i}`);
  const optLabelOf = (key: string) => options[parseInt(key.slice(1))]?.label ?? key;

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      {/* Header + plain-language explanation */}
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Análise de sensibilidade</h2>
        <div className="mt-2 text-sm text-gray-600 bg-slate-50 border border-slate-200 rounded-xl p-4 leading-relaxed space-y-2">
          <p>
            <strong className="text-gray-700">O que mostra:</strong> cada linha é uma alternativa. O gráfico
            segue o seu valor global V(p) à medida que o <strong>peso do critério selecionado</strong> varia de
            0&nbsp;% a 100&nbsp;%. A linha vertical tracejada (azul) marca o <strong>peso atual</strong> e as
            faixas coloridas de fundo são as zonas da política de decisão.
          </p>
          <p>
            <strong className="text-gray-700">O que procurar:</strong> se as linhas se <strong>cruzam</strong>, a
            ordenação muda nesse peso&nbsp;<span className="text-amber-600 font-semibold">⚡</span> — a decisão é
            sensível a esse critério. Se <strong>nunca se cruzam</strong>, o resultado é robusto.
          </p>
        </div>
      </div>

      {/* Criterion selector — single-select (radio) */}
      <div className="flex items-start gap-4 flex-wrap">
        <span className="text-sm font-medium text-gray-700 mt-1 shrink-0">Critério analisado:</span>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {qualCriteria.map((c) => {
            const isActive = activeCriterionId === c.id;
            const w = groupWeightOf(c.id);
            return (
              <button
                key={c.id}
                role="radio"
                aria-checked={isActive}
                onClick={() => setActiveCriterionId(c.id)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  isActive
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                }`}
              >
                {c.label}
                {w != null && (
                  <span className={`ml-1.5 text-xs ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>
                    {(w * 100).toFixed(0)}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <span className="text-xs text-gray-400 mt-1.5">selecione para visualizar</span>
      </div>

      {/* Single chart panel for the selected criterion */}
      {(() => {
        const criterionId = activeCriterionId;
        const criterion = model.valueTree.criteria[criterionId];
        const scenario = computeSensitivity(evaluation, criterionId);
        const currentWeight = (groupWeightOf(criterionId) ?? 0) * 100;
        const currentWeightLabel = `${currentWeight.toFixed(0)}%`;

        // Build chartData using safe indexed keys
        const chartData = scenario.points.map((pt) => {
          const row: Record<string, string | number> = {
            weight: (pt.weightValue * 100).toFixed(0) + '%',
          };
          options.forEach((opt, i) => {
            row[optKeys[i]] = pt.optionValues[opt.id] ?? 0;
          });
          return row;
        });

        const allValues = scenario.points.flatMap((pt) => options.map((o) => pt.optionValues[o.id] ?? 0));
        const nonBaseLowers = bandViews.filter((v) => !v.isBase).map((v) => v.lower);
        const yMin = Math.floor(Math.min(0, ...allValues, ...nonBaseLowers) - 6);
        const yMax = Math.ceil(Math.max(100, ...allValues) + 6);

        return (
          <div key={criterionId} className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: '#3b82f6' }} />
              <h3 className="text-sm font-semibold text-gray-700">
                Sensibilidade de V(p) ao peso de «{criterion?.label}»
              </h3>
              <span className="text-xs text-gray-400 ml-auto">
                peso actual: <strong>{currentWeight.toFixed(1)}%</strong>
              </span>
            </div>

            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                {bandViews.map((v) => (
                  <ReferenceArea
                    key={v.band.id}
                    y1={v.isBase ? yMin : v.lower}
                    y2={v.upper ?? yMax}
                    fill={v.band.color}
                    fillOpacity={0.09}
                    stroke="none"
                    ifOverflow="extendDomain"
                  />
                ))}
                <XAxis dataKey="weight" tick={{ fontSize: 11 }} />
                <YAxis domain={[yMin, yMax]} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value, key) => [Number(value).toFixed(1), optLabelOf(String(key))]}
                />
                <Legend formatter={(value) => optLabelOf(value)} />
                <ReferenceLine
                  x={currentWeightLabel}
                  stroke="#3b82f6"
                  strokeDasharray="3 3"
                  label={{ value: 'atual', position: 'top', fontSize: 9, fill: '#3b82f6' }}
                />
                {scenario.rankingChangePoints.map((w) => {
                  const xLabel = `${(w * 100).toFixed(0)}%`;
                  return (
                    <ReferenceLine
                      key={xLabel}
                      x={xLabel}
                      stroke="#f59e0b"
                      strokeWidth={1.5}
                      label={{ value: '⚡', position: 'top', fontSize: 11 }}
                    />
                  );
                })}
                {options.map((opt, i) => (
                  <Line
                    key={opt.id}
                    type="monotone"
                    dataKey={optKeys[i]}
                    name={optKeys[i]}
                    stroke={OPTION_COLORS[i % OPTION_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>

            {/* Plain-language axes + decision-zone legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-gray-500">
              <span>Eixo X: peso de «{criterion?.label}» (0→100%) · Eixo Y: valor global V(p)</span>
              <span className="flex flex-wrap items-center gap-2.5 ml-auto">
                {bandViews.map((v) => (
                  <span key={v.band.id} className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: v.band.color, opacity: 0.45 }} />
                    {v.band.label} {bandRangeLabel(v.band, resolvedScale)}
                  </span>
                ))}
              </span>
            </div>

            {scenario.rankingChangePoints.length > 0 ? (
              <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-xs text-amber-800">
                <p className="font-medium mb-1">⚡ Mudanças de ordenação detectadas:</p>
                <ul className="space-y-0.5">
                  {scenario.rankingChangePoints.map((w, idx) => {
                    const prev = idx === 0 ? scenario.points[0] : scenario.points.find((pt) => pt.weightValue >= scenario.rankingChangePoints[idx - 1]);
                    const next = scenario.points.find((pt) => pt.weightValue >= w);
                    const optIds = options.map((o) => o.id);
                    const before = prev ? [...optIds].sort((a, b) => (prev.optionValues[b] ?? 0) - (prev.optionValues[a] ?? 0)) : [];
                    const after = next ? [...optIds].sort((a, b) => (next.optionValues[b] ?? 0) - (next.optionValues[a] ?? 0)) : [];
                    const swaps = before
                      .map((id, rank) => ({ id, rank, newRank: after.indexOf(id) }))
                      .filter((x) => x.rank !== x.newRank)
                      .slice(0, 2);
                    const labelOf = (id: string) => options.find((o) => o.id === id)?.label ?? id;
                    return (
                      <li key={idx}>
                        <span className="font-mono text-amber-900">{criterion?.label} = {(w * 100).toFixed(1)}%</span>
                        {swaps.length > 0 && (
                          <span className="text-amber-700"> — {swaps.map((s) => labelOf(s.id)).join(' ↔ ')} trocam posição</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div className="border border-green-200 bg-green-50 rounded-lg p-2 text-xs text-green-800">
                ✓ A ordenação é robusta a qualquer variação do peso de «{criterion?.label}».
              </div>
            )}
          </div>
        );
      })()}

      <ScreenNav next="report" nextLabel="Relatório" hint="Gere e exporte o relatório de decisão." />
    </div>
  );
}
