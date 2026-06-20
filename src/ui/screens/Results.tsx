import { useMemo, useEffect, useState } from 'react';
import { useApp } from '../store';
import { aggregate } from '../../engine/aggregation';
import { sortBands } from '../../domain/decision';
import { effectiveWeights, allGroupsConsistent, weightingGroups } from '../../domain/tree';
import type { DecisionBand } from '../../domain/types';
import { ROOT_ID } from '../../domain/types';
import ScreenNav from '../components/ScreenNav';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
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

  const weightsReady = allGroupsConsistent(model);
  const [whyOptionId, setWhyOptionId] = useState<string | null>(null);

  const freshResult = useMemo(() => {
    if (!weightsReady || evaluation.options.length === 0) return null;
    return aggregate(evaluation);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluation.options, evaluation.performances, model]);

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
  const effW = effectiveWeights(model);
  const optionNotes = evaluation.optionNotes ?? {};

  function setNote(optionId: string, note: string) {
    dispatch({
      type: 'UPDATE_EVALUATION',
      patch: { optionNotes: { ...optionNotes, [optionId]: note } },
    });
  }

  if (!weightsReady) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <p className="text-gray-500">Complete a ponderação (todos os grupos) no modelo para calcular resultados.</p>
      </div>
    );
  }
  if (evaluation.options.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
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

  const sorted = [...result.optionResults].sort(
    (a, b) => (b.globalValue ?? -Infinity) - (a.globalValue ?? -Infinity),
  );

  const chartData = sorted.map((r) => ({
    name: evaluation.options.find((o) => o.id === r.optionId)?.label ?? r.optionId,
    value: r.globalValue ?? 0,
    color: r.hardRejected ? REJECT_COLOR : bandOf(r.bandId)?.color ?? REJECT_COLOR,
    optionId: r.optionId,
  }));

  const minBand = bands.length ? bands[bands.length - 1].minScore : 0;

  // "Why" panel data — top-level factors/criteria with contribution
  const topGroups = weightingGroups(model).filter((g) => g.parentId === ROOT_ID);
  const topCritIds = topGroups.length > 0
    ? topGroups.flatMap((g) => g.childIds)
    : qualCriteria.map((c) => c.id);

  const whyResult = result.optionResults.find((r) => r.optionId === (whyOptionId ?? sorted[0]?.optionId));
  const activeWhyId = whyOptionId ?? sorted[0]?.optionId ?? null;

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-800">Resultados</h2>
          {isStale && (
            <span className="text-xs text-amber-600 font-medium">⚠ A recalcular…</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => dispatch({ type: 'UPDATE_EVALUATION', patch: { aggregationResult: aggregate(evaluation) } })}
            className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
          >
            ↺ Recalcular
          </button>
          <button
            onClick={() => exportEvaluation(evaluation)}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            ↓ JSON
          </button>
        </div>
      </div>

      {/* ── Ranking cards ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(sorted.length, 3)}, 1fr)` }}>
        {sorted.map((r, i) => {
          const option = evaluation.options.find((o) => o.id === r.optionId);
          const band = bandOf(r.bandId);
          const borderColor = r.hardRejected ? '#e5e7eb' : band?.color ?? '#e5e7eb';
          const isWhy = activeWhyId === r.optionId;

          return (
            <div
              key={r.optionId}
              className={`bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm transition-shadow ${isWhy ? 'ring-2 ring-indigo-400' : ''}`}
              style={{ borderTop: `4px solid ${borderColor}` }}
            >
              <div className="p-4">
                <p className="text-xs text-gray-400 font-medium mb-1">
                  {r.hardRejected ? '— · Reprovado (porta)' : `#${i + 1}${band ? ` · ${band.label}` : ''}`}
                </p>
                <p className="font-semibold text-gray-800 text-sm leading-snug">
                  {option?.label ?? r.optionId}
                </p>
                {r.hardRejected ? (
                  <>
                    <p className="text-3xl font-black text-gray-300 mt-2 mb-1">—</p>
                    <p className="text-xs text-red-500 font-medium">
                      ❌ {r.rejectedByGate ? model.valueTree.criteria[r.rejectedByGate]?.label : 'Porta eliminatória'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-black text-gray-900 mt-2 mb-1" style={{ color: band?.color }}>
                      {r.globalValue?.toFixed(1) ?? '—'}
                    </p>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-3">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.max(0, r.globalValue ?? 0)}%`, backgroundColor: band?.color ?? '#94a3b8' }}
                      />
                    </div>
                    <button
                      onClick={() => setWhyOptionId(isWhy && whyOptionId !== null ? null : r.optionId)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      {isWhy ? '▲ Fechar' : '▼ Porquê?'}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Decision policy bands ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 flex-wrap">
        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Política de decisão:</span>
        {bands.map((b) => (
          <span
            key={b.id}
            className="text-xs px-3 py-1 rounded-full font-semibold text-white"
            style={{ backgroundColor: b.color }}
          >
            {b.label} · V(p) ≥ {b.minScore.toFixed(0)}
          </span>
        ))}
      </div>

      {/* ── "Why" panel ── */}
      {whyResult && !whyResult.hardRejected && (
        <div className="bg-white rounded-xl border border-indigo-100 p-5 space-y-4">
          <h3 className="font-semibold text-gray-800 text-sm">
            Porquê — contribuições por fator ·{' '}
            <span className="text-indigo-600">
              {evaluation.options.find((o) => o.id === activeWhyId)?.label}
            </span>
          </h3>
          <div className="space-y-2">
            {topCritIds.map((critId) => {
              const crit = model.valueTree.criteria[critId];
              if (!crit || crit.type === 'gate') return null;
              const score = whyResult.criterionScores[critId];
              const isComposite = crit.type === 'composite';
              const w = effW.get(critId);

              // For composite, show children too
              const children = isComposite
                ? Object.values(model.valueTree.criteria).filter(
                    (c) => c.type === 'qualification' && (model.valueTree.order ?? []).includes(c.id) &&
                    weightingGroups(model).some((g) => g.parentId === critId && g.childIds.includes(c.id)),
                  )
                : [];

              return (
                <div key={critId} className={isComposite ? 'space-y-1' : ''}>
                  <div className="flex items-center gap-3">
                    <div className="w-36 shrink-0">
                      <span className="text-sm font-medium text-gray-700">{crit.label}</span>
                      {isComposite && <span className="ml-1 text-xs text-gray-400">(fator)</span>}
                    </div>
                    <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(0, score ?? 0)}%`,
                          backgroundColor: isComposite ? '#6366f1' : '#818cf8',
                        }}
                      />
                    </div>
                    <span className="font-mono text-sm font-bold text-gray-800 w-12 text-right">
                      {score != null ? score.toFixed(1) : '—'}
                    </span>
                    <span className="text-xs text-gray-400 w-10 text-right">
                      {w != null ? `${(w * 100).toFixed(0)}%` : ''}
                    </span>
                  </div>
                  {/* Composite children indented */}
                  {children.map((child) => {
                    if (child.type !== 'qualification') return null;
                    const cs = whyResult.criterionScores[child.id];
                    const cw = effW.get(child.id);
                    return (
                      <div key={child.id} className="flex items-center gap-3 pl-8">
                        <div className="w-28 shrink-0">
                          <span className="text-xs text-gray-500">↳ {child.label}</span>
                        </div>
                        <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-300" style={{ width: `${Math.max(0, cs ?? 0)}%` }} />
                        </div>
                        <span className="font-mono text-xs text-gray-600 w-12 text-right">
                          {cs != null ? cs.toFixed(1) : '—'}
                        </span>
                        <span className="text-xs text-gray-400 w-10 text-right">
                          {cw != null ? `${(cw * 100).toFixed(0)}%` : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400">Barras proporcionais ao valor v(p) de cada critério (0–100). Peso ef. = peso efetivo (produto dos pesos no caminho até à raiz).</p>
        </div>
      )}

      {/* ── Bar chart ── */}
      <div className="border border-gray-200 rounded-xl p-4 bg-white">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Valor Global V(p) — Modelo Aditivo</h3>
        <ResponsiveContainer width="100%" height={200}>
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
              <ReferenceLine key={b.id} y={b.minScore} stroke={b.color} strokeDasharray="4 4"
                label={{ value: b.label, fontSize: 9, fill: b.color, position: 'insideTopRight' }} />
            ))}
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Per-criterion profile table ── */}
      {qualCriteria.length > 0 && (
        <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
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
                  const w = effW.get(c.id);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 border border-gray-200 text-gray-700">
                        {c.label}
                        {w != null && <span className="ml-1.5 text-xs text-gray-400">{(w * 100).toFixed(1)}%</span>}
                      </td>
                      {sorted.map((r) => {
                        const score = r.criterionScores[c.id];
                        const contrib = w != null && score != null ? w * score : null;
                        return (
                          <td key={r.optionId} className="px-3 py-1.5 border border-gray-200 text-center font-mono text-sm"
                            title={contrib != null ? `Contribuição: ${contrib.toFixed(2)}` : undefined}>
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

      {/* ── Notes ── */}
      {sorted.some((r) => !r.hardRejected) && (
        <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Observações por proposta</h3>
          <div className="space-y-2">
            {sorted.filter((r) => !r.hardRejected).map((r) => {
              const option = evaluation.options.find((o) => o.id === r.optionId);
              return (
                <div key={r.optionId} className="flex items-start gap-3">
                  <span className="text-sm text-gray-600 font-medium w-40 shrink-0 pt-1">{option?.label}</span>
                  <textarea
                    value={optionNotes[r.optionId] ?? ''}
                    onChange={(e) => setNote(r.optionId, e.target.value)}
                    placeholder="Observações…"
                    rows={2}
                    className="flex-1 text-xs text-gray-700 border border-gray-200 rounded-lg px-2 py-1 resize-none focus:outline-none focus:border-blue-300"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ScreenNav next="sensitivity" nextLabel="Sensibilidade"
        hint="Analise a robustez dos resultados à variação dos pesos." />
    </div>
  );
}
