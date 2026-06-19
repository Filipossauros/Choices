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
  const [variedId, setVariedId] = useState<string>(qualCriteria[0]?.id ?? '');

  if (!evaluation.aggregationResult || !model.weights) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 text-center text-gray-400">
        <p>Execute a agregação no ecrã de Resultados para activar a análise de sensibilidade.</p>
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

  const bands = sortBands(model.decisionScale);
  const scenario = variedId ? computeSensitivity(evaluation, variedId) : null;
  const currentWeight = (model.weights.weights.find((w) => w.criterionId === variedId)?.weight ?? 0) * 100;

  const optionIds = evaluation.options.map((o) => o.id);
  const optionLabels = new Map(evaluation.options.map((o) => [o.id, o.label]));

  const chartData =
    scenario?.points.map((pt) => ({
      weight: (pt.weightValue * 100).toFixed(0) + '%',
      ...Object.fromEntries(optionIds.map((id) => [id, pt.optionValues[id] ?? 0])),
    })) ?? [];

  const allValues = (scenario?.points ?? []).flatMap((pt) => optionIds.map((id) => pt.optionValues[id] ?? 0));
  const minBand = bands.length ? bands[bands.length - 1].minScore : 0;
  const yMin = allValues.length ? Math.floor(Math.min(...allValues, minBand) - 10) : -20;
  const yMax = allValues.length ? Math.ceil(Math.max(...allValues, 100) + 5) : 110;

  const currentWeightLabel = `${currentWeight.toFixed(0)}%`;
  const variedCrit = model.valueTree.criteria[variedId];

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <label className="text-sm font-medium text-gray-700">Variar peso de:</label>
        <select value={variedId} onChange={(e) => setVariedId(e.target.value)} className="border border-gray-200 rounded px-3 py-1.5 text-sm">
          {qualCriteria.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400">
          peso actual: <strong>{currentWeight.toFixed(1)}%</strong> (marcado na linha azul tracejada)
        </span>
      </div>

      {scenario && (
        <>
          <div className="border border-gray-200 rounded-xl p-4 bg-white">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Sensibilidade de V(p) ao peso de «{variedCrit?.label}»
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="weight" tick={{ fontSize: 11 }} />
                <YAxis domain={[yMin, yMax]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, name) => [Number(v).toFixed(1), optionLabels.get(String(name)) ?? name]} />
                <Legend formatter={(value) => optionLabels.get(value) ?? value} />
                {bands.map((b) => (
                  <ReferenceLine key={b.id} y={b.minScore} stroke={b.color} strokeDasharray="4 4"
                    label={{ value: b.label, position: 'insideTopRight', fontSize: 9, fill: b.color }} />
                ))}
                <ReferenceLine x={currentWeightLabel} stroke="#3b82f6" strokeDasharray="3 3"
                  label={{ value: 'atual', position: 'top', fontSize: 9, fill: '#3b82f6' }} />
                {scenario.rankingChangePoints.map((w) => {
                  const xLabel = `${(w * 100).toFixed(0)}%`;
                  return (
                    <ReferenceLine key={xLabel} x={xLabel} stroke="#f59e0b" strokeWidth={1.5}
                      label={{ value: '⚡', position: 'top', fontSize: 11 }} />
                  );
                })}
                {optionIds.map((id, i) => (
                  <Line key={id} type="monotone" dataKey={id} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {scenario.rankingChangePoints.length > 0 ? (
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-medium mb-2">⚡ Mudanças de ordenação detectadas:</p>
              <ul className="space-y-1">
                {scenario.rankingChangePoints.map((w, i) => {
                  const prev = i === 0 ? scenario.points[0] : scenario.points.find((pt) => pt.weightValue >= scenario.rankingChangePoints[i - 1]);
                  const next = scenario.points.find((pt) => pt.weightValue >= w);
                  const before = prev ? [...optionIds].sort((a, b) => (prev.optionValues[b] ?? 0) - (prev.optionValues[a] ?? 0)) : [];
                  const after = next ? [...optionIds].sort((a, b) => (next.optionValues[b] ?? 0) - (next.optionValues[a] ?? 0)) : [];
                  const swaps = before
                    .map((id, rank) => ({ id, rank, newRank: after.indexOf(id) }))
                    .filter((x) => x.rank !== x.newRank)
                    .slice(0, 2);
                  return (
                    <li key={i} className="flex items-start gap-2">
                      <span className="font-mono text-amber-900 shrink-0">{variedCrit?.label} = {(w * 100).toFixed(1)}%</span>
                      {swaps.length > 0 && (
                        <span className="text-amber-700">— {swaps.map((s) => optionLabels.get(s.id)).join(' ↔ ')} trocam de posição</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="border border-green-200 bg-green-50 rounded-xl p-3 text-sm text-green-800">
              ✓ A ordenação das propostas é robusta a qualquer variação do peso de «{variedCrit?.label}».
            </div>
          )}
        </>
      )}

      <ScreenNav next="report" nextLabel="Relatório" hint="Gere e exporte o relatório de decisão." />
    </div>
  );
}
