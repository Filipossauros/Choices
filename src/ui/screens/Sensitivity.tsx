import { useState } from 'react';
import { useApp } from '../store';
import { computeSensitivity } from '../../engine/sensitivity';
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

const COLORS = ['#3b82f6', '#16a34a', '#d97706', '#dc2626', '#8b5cf6', '#ec4899'];

export default function Sensitivity() {
  const { state } = useApp();
  const model = state.model!;

  const qualCriteria = Object.values(model.valueTree.criteria).filter(
    (c) => c.type === 'qualification',
  );
  const [variedId, setVariedId] = useState<string>(qualCriteria[0]?.id ?? '');

  if (!model.aggregationResult || !model.weights) {
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

  const scenario = variedId ? computeSensitivity(model, variedId) : null;

  const optionIds = model.options.map((o) => o.id);
  const optionLabels = new Map(model.options.map((o) => [o.id, o.label]));

  const chartData = scenario?.points.map((pt) => ({
    weight: (pt.weightValue * 100).toFixed(0) + '%',
    ...Object.fromEntries(
      optionIds.map((id) => [id, pt.optionValues[id] ?? 0]),
    ),
  })) ?? [];

  const variedCrit = model.valueTree.criteria[variedId];

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">Variar peso de:</label>
        <select
          value={variedId}
          onChange={(e) => setVariedId(e.target.value)}
          className="border border-gray-200 rounded px-3 py-1.5 text-sm"
        >
          {qualCriteria.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400">
          (peso actual: {(
            (model.weights.weights.find((w) => w.criterionId === variedId)?.weight ?? 0) * 100
          ).toFixed(1)}%)
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
                <YAxis domain={[-20, 110]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, name) => [Number(v).toFixed(1), optionLabels.get(String(name)) ?? name]} />
                <Legend formatter={(value) => optionLabels.get(value) ?? value} />
                <ReferenceLine y={model.approvedThreshold} stroke="#16a34a" strokeDasharray="4 4" />
                <ReferenceLine y={model.conditionalThreshold} stroke="#d97706" strokeDasharray="4 4" />
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
          </div>

          {scenario.rankingChangePoints.length > 0 && (
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-medium mb-1">Mudanças de ordenação detectadas:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {scenario.rankingChangePoints.map((w, i) => (
                  <li key={i}>Peso de «{variedCrit?.label}» = {(w * 100).toFixed(1)}%</li>
                ))}
              </ul>
            </div>
          )}

          {scenario.rankingChangePoints.length === 0 && (
            <div className="border border-green-200 bg-green-50 rounded-xl p-3 text-sm text-green-800">
              ✓ A ordenação das propostas é robusta à variação do peso de «{variedCrit?.label}».
            </div>
          )}
        </>
      )}
    </div>
  );
}
