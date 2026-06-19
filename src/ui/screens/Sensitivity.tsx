import { useState } from 'react';
import { useApp } from '../store';
import { computeSensitivity } from '../../engine/sensitivity';
import { sortBands } from '../../domain/decision';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import ScreenNav from '../components/ScreenNav';

const COLORS = ['#3b82f6', '#16a34a', '#d97706', '#dc2626', '#8b5cf6', '#ec4899'];

export default function Sensitivity() {
  const { state } = useApp();
  const evaluation = state.evaluation!;
  const model = evaluation.model;

  const qualCriteria = Object.values(model.valueTree.criteria).filter((c) => c.type === 'qualification');

  // Multi-criteria: start with first criterion active
  const [activeIds, setActiveIds] = useState<Set<string>>(
    () => new Set(qualCriteria[0]?.id ? [qualCriteria[0].id] : []),
  );

  if (!evaluation.aggregationResult || !model.weights) {
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

  function toggleCriterion(id: string) {
    setActiveIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id); // keep at least one selected
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const bands = sortBands(model.decisionScale);
  const optionIds = evaluation.options.map((o) => o.id);
  const optionLabels = new Map(evaluation.options.map((o) => [o.id, o.label]));

  // Compute scenario per active criterion
  const scenarios = [...activeIds].map((id) => ({
    criterionId: id,
    criterion: model.valueTree.criteria[id],
    scenario: computeSensitivity(evaluation, id),
    currentWeight: (model.weights!.weights.find((w) => w.criterionId === id)?.weight ?? 0) * 100,
  }));

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      {/* Criterion selector */}
      <div className="flex items-start gap-4 flex-wrap">
        <span className="text-sm font-medium text-gray-700 mt-1 shrink-0">Critérios activos:</span>
        <div className="flex flex-wrap gap-2">
          {qualCriteria.map((c) => {
            const isActive = activeIds.has(c.id);
            const w = model.weights!.weights.find((w) => w.criterionId === c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCriterion(c.id)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  isActive
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                }`}
              >
                {c.label}
                {w && (
                  <span className={`ml-1.5 text-xs ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>
                    {(w.weight * 100).toFixed(0)}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <span className="text-xs text-gray-400 mt-1.5">clique para activar/desactivar</span>
      </div>

      {/* One chart panel per active criterion */}
      {scenarios.map(({ criterionId, criterion, scenario, currentWeight }, si) => {
        const chartData = scenario.points.map((pt) => ({
          weight: (pt.weightValue * 100).toFixed(0) + '%',
          ...Object.fromEntries(optionIds.map((id) => [id, pt.optionValues[id] ?? 0])),
        }));

        const allValues = scenario.points.flatMap((pt) => optionIds.map((id) => pt.optionValues[id] ?? 0));
        const minBand = bands.length ? bands[bands.length - 1].minScore : 0;
        const yMin = allValues.length ? Math.floor(Math.min(...allValues, minBand) - 10) : -20;
        const yMax = allValues.length ? Math.ceil(Math.max(...allValues, 100) + 5) : 110;
        const currentWeightLabel = `${currentWeight.toFixed(0)}%`;

        return (
          <div key={criterionId} className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: COLORS[si % COLORS.length] }}
              />
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
                <XAxis dataKey="weight" tick={{ fontSize: 11 }} />
                <YAxis domain={[yMin, yMax]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, name) => [Number(v).toFixed(1), optionLabels.get(String(name)) ?? name]} />
                <Legend formatter={(value) => optionLabels.get(value) ?? value} />
                {bands.map((b) => (
                  <ReferenceLine
                    key={b.id}
                    y={b.minScore}
                    stroke={b.color}
                    strokeDasharray="4 4"
                    label={{ value: b.label, position: 'insideTopRight', fontSize: 9, fill: b.color }}
                  />
                ))}
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
                {optionIds.map((id, i) => (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={id}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>

            {scenario.rankingChangePoints.length > 0 ? (
              <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-xs text-amber-800">
                <p className="font-medium mb-1">⚡ Mudanças de ordenação detectadas:</p>
                <ul className="space-y-0.5">
                  {scenario.rankingChangePoints.map((w, idx) => {
                    const prev = idx === 0 ? scenario.points[0] : scenario.points.find((pt) => pt.weightValue >= scenario.rankingChangePoints[idx - 1]);
                    const next = scenario.points.find((pt) => pt.weightValue >= w);
                    const before = prev ? [...optionIds].sort((a, b) => (prev.optionValues[b] ?? 0) - (prev.optionValues[a] ?? 0)) : [];
                    const after = next ? [...optionIds].sort((a, b) => (next.optionValues[b] ?? 0) - (next.optionValues[a] ?? 0)) : [];
                    const swaps = before
                      .map((id, rank) => ({ id, rank, newRank: after.indexOf(id) }))
                      .filter((x) => x.rank !== x.newRank)
                      .slice(0, 2);
                    return (
                      <li key={idx}>
                        <span className="font-mono text-amber-900">{criterion?.label} = {(w * 100).toFixed(1)}%</span>
                        {swaps.length > 0 && (
                          <span className="text-amber-700"> — {swaps.map((s) => optionLabels.get(s.id)).join(' ↔ ')} trocam posição</span>
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
      })}

      <ScreenNav next="report" nextLabel="Relatório" hint="Gere e exporte o relatório de decisão." />
    </div>
  );
}
