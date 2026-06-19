import { useMemo, useEffect } from 'react';
import { useApp } from '../store';
import { aggregate } from '../../engine/aggregation';
import { sortBands } from '../../domain/decision';
import type { DecisionBand } from '../../domain/types';
import ScreenNav from '../components/ScreenNav';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const REJECT_COLOR = '#9ca3af';

function exportEvaluation(evaluation: ReturnType<typeof useApp>['state']['evaluation']) {
  if (!evaluation) return;
  const blob = new Blob([JSON.stringify(evaluation, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `choices-avaliacao-${evaluation.id.slice(0, 8)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Results() {
  const { state, dispatch } = useApp();
  const evaluation = state.evaluation!;
  const model = evaluation.model;

  // Compute aggregate result fresh whenever options/performances change
  const freshResult = useMemo(() => {
    if (!model.weights || evaluation.options.length === 0) return null;
    return aggregate(evaluation);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluation.options, evaluation.performances, model]);

  // Persist fresh result to state so Sensitivity screen can use it
  useEffect(() => {
    if (freshResult) {
      dispatch({ type: 'UPDATE_EVALUATION', patch: { aggregationResult: freshResult } });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshResult]);

  const result = freshResult ?? evaluation.aggregationResult ?? null;

  const isStale =
    result != null &&
    (evaluation.options.length !== result.optionResults.length ||
      evaluation.options.some((o) => o.createdAt > result.computedAt));

  const qualCriteria = Object.values(model.valueTree.criteria).filter((c) => c.type === 'qualification');

  const optionNotes = evaluation.optionNotes ?? {};

  function setNote(optionId: string, note: string) {
    dispatch({
      type: 'UPDATE_EVALUATION',
      patch: { optionNotes: { ...optionNotes, [optionId]: note } },
    });
  }

  if (!model.weights) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-3">
        <p className="text-gray-500">Complete a ponderação no modelo para calcular resultados.</p>
      </div>
    );
  }

  if (evaluation.options.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-3">
        <p className="text-gray-500">Adicione propostas no separador «Análise e avaliação».</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <p className="text-gray-400 text-sm">A calcular resultados…</p>
      </div>
    );
  }

  const bands = sortBands(result.decisionScale);
  const bandMap = new Map(result.decisionScale.map((b) => [b.id, b] as const));
  function bandOf(bandId: string | null): DecisionBand | undefined {
    return bandId ? bandMap.get(bandId) : undefined;
  }

  const sorted = [...result.optionResults].sort((a, b) => (b.globalValue ?? -Infinity) - (a.globalValue ?? -Infinity));

  const chartData = sorted.map((r) => ({
    name: evaluation.options.find((o) => o.id === r.optionId)?.label ?? r.optionId,
    value: r.globalValue ?? 0,
    color: r.hardRejected ? REJECT_COLOR : bandOf(r.bandId)?.color ?? REJECT_COLOR,
    optionId: r.optionId,
  }));

  const minBand = bands.length ? bands[bands.length - 1].minScore : 0;

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-800">Resultados da Avaliação</h2>
          {isStale && <span className="text-xs text-amber-600 font-medium">⚠ Propostas alteradas — a recalcular…</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatch({ type: 'UPDATE_EVALUATION', patch: { aggregationResult: aggregate(evaluation) } })}
            className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            Recalcular
          </button>
          <button
            onClick={() => exportEvaluation(evaluation)}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            title="Exportar avaliação completa como JSON (pode ser reimportada)"
          >
            ↓ Exportar JSON
          </button>
        </div>
      </div>

      {/* Ranking chart */}
      <div className="border border-gray-200 rounded-xl p-4 bg-white">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Valor Global V(p) — Modelo Aditivo</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis
              domain={[
                (dataMin: number) => Math.floor(Math.min(dataMin, minBand) - 10),
                (dataMax: number) => Math.ceil(Math.max(dataMax, 100) + 5),
              ]}
              tick={{ fontSize: 11 }}
            />
            <Tooltip formatter={(v) => [`${v}`, 'V(p)']} />
            {bands.map((b) => (
              <ReferenceLine key={b.id} y={b.minScore} stroke={b.color} strokeDasharray="4 4" label={{ value: b.label, fontSize: 9, fill: b.color, position: 'insideTopRight' }} />
            ))}
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detail table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-gray-600 font-medium">#</th>
              <th className="px-4 py-2 text-left text-gray-600 font-medium">Proposta</th>
              <th className="px-4 py-2 text-right text-gray-600 font-medium">V(p)</th>
              <th className="px-4 py-2 text-center text-gray-600 font-medium">Decisão</th>
              <th className="px-4 py-2 text-left text-gray-600 font-medium">Observações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((r, i) => {
              const option = evaluation.options.find((o) => o.id === r.optionId);
              const band = bandOf(r.bandId);
              return (
                <tr key={r.optionId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 font-mono align-top">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-800 align-top">{option?.label ?? r.optionId}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-800 align-top">
                    {r.globalValue !== null ? r.globalValue.toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center align-top">
                    {r.hardRejected ? (
                      <div>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Reprovado</span>
                        {r.rejectedByGate && (
                          <p className="text-xs text-gray-400 mt-0.5">Porta: {model.valueTree.criteria[r.rejectedByGate]?.label}</p>
                        )}
                      </div>
                    ) : band ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: band.color }}>
                        {band.label}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 align-top">
                    <textarea
                      value={optionNotes[r.optionId] ?? ''}
                      onChange={(e) => setNote(r.optionId, e.target.value)}
                      placeholder="Observações…"
                      rows={2}
                      className="w-full text-xs text-gray-700 border border-gray-200 rounded px-2 py-1 resize-none focus:outline-none focus:border-blue-300 bg-transparent"
                      style={{ minWidth: 160 }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Per-criterion profile */}
      {qualCriteria.length > 0 && (
        <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Perfil por Critério</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-1.5 text-left text-gray-600 font-medium border border-gray-200">
                    Critério <span className="text-gray-400 font-normal">(peso)</span>
                  </th>
                  {sorted.map((r, rank) => (
                    <th key={r.optionId} className="px-3 py-1.5 text-center text-gray-600 font-medium border border-gray-200">
                      <span className="text-gray-400 text-xs mr-1">#{rank + 1}</span>
                      {evaluation.options.find((o) => o.id === r.optionId)?.label ?? r.optionId}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {qualCriteria.map((c) => {
                  const weight = model.weights?.weights.find((w) => w.criterionId === c.id);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 border border-gray-200 text-gray-700">
                        {c.label}
                        {weight && <span className="ml-1.5 text-xs text-gray-400 font-normal">{(weight.weight * 100).toFixed(1)}%</span>}
                      </td>
                      {sorted.map((r) => {
                        const score = r.criterionScores[c.id];
                        const contrib = weight && score != null ? weight.weight * score : null;
                        return (
                          <td
                            key={r.optionId}
                            className="px-3 py-1.5 border border-gray-200 text-center font-mono text-sm"
                            title={contrib != null ? `Contribuição: ${contrib.toFixed(2)}` : undefined}
                          >
                            {score !== null && score !== undefined ? score.toFixed(1) : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs">V(p) global</td>
                  {sorted.map((r) => (
                    <td key={r.optionId} className="px-3 py-1.5 border border-gray-200 text-center font-mono text-sm text-gray-800">
                      {r.globalValue !== null && r.globalValue !== undefined ? r.globalValue.toFixed(1) : '—'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ScreenNav
        next="sensitivity"
        nextLabel="Sensibilidade"
        hint="Analise a robustez dos resultados à variação dos pesos."
      />
    </div>
  );
}
