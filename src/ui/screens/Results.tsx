import { useMemo, useEffect, useState, Fragment } from 'react';
import { useApp } from '../store';
import { aggregate } from '../../engine/aggregation';
import { displayBands, bandRangeLabel } from '../../domain/decision';
import { subjectNoun } from '../../domain/subject';
import { effectiveWeights, allGroupsConsistent, weightingGroups } from '../../domain/tree';
import type { DecisionBand } from '../../domain/types';
import { ROOT_ID } from '../../domain/types';
import { IconExport } from '../components/icons';
import ScreenNav from '../components/ScreenNav';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceArea, ResponsiveContainer, Cell,
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
  const subj = subjectNoun(model);

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
        <p className="text-gray-500">Adicione {subj.many} no separador «Análise e avaliação».</p>
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

  const bandViews = displayBands(result.decisionScale);
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

  // Axis bounds ignore the base zone's (possibly sentinel) lower edge.
  const nonBaseLowers = bandViews.filter((v) => !v.isBase).map((v) => v.lower);
  const values = chartData.map((d) => d.value);
  const axisBottom = Math.floor(Math.min(0, ...nonBaseLowers, ...values) - 6);
  const axisTop = Math.ceil(Math.max(100, ...values) + 6);

  // "Why" panel data — top-level factors/criteria with contribution
  const topGroups = weightingGroups(model).filter((g) => g.parentId === ROOT_ID);
  const topCritIds = topGroups.length > 0
    ? topGroups.flatMap((g) => g.childIds)
    : qualCriteria.map((c) => c.id);

  const whyResult = result.optionResults.find((r) => r.optionId === (whyOptionId ?? sorted[0]?.optionId));
  const activeWhyId = whyOptionId ?? sorted[0]?.optionId ?? null;

  // ── Explainability: strengths, shortfalls, and the best lever to the next band ──
  const scaleMap = new Map(model.derivedScales.map((s) => [s.criterionId, s] as const));
  const explain = (() => {
    if (!whyResult || whyResult.hardRejected || whyResult.globalValue == null) return null;
    const global = whyResult.globalValue;

    // Per-leaf decomposition. Anchored Neutral=0, so contrib = w·v sums to V(p);
    // shortfall = w·(100−v) is the value still "on the table" toward Good.
    const leaves = qualCriteria
      .map((c) => {
        const v = whyResult.criterionScores[c.id];
        const w = effW.get(c.id);
        if (v == null || w == null) return null;
        return { id: c.id, label: c.label, contrib: w * v, shortfall: w * (100 - v) };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const strengths = [...leaves].sort((a, b) => b.contrib - a.contrib).filter((x) => x.contrib > 0.5).slice(0, 3);
    const weaknesses = [...leaves].sort((a, b) => b.shortfall - a.shortfall).filter((x) => x.shortfall > 0.5).slice(0, 3);

    // Next higher band (bandViews sorted desc by lower bound → index-1 is higher).
    const curIdx = bandViews.findIndex((bv) => bv.band.id === whyResult.bandId);
    const nextBand = curIdx > 0 ? bandViews[curIdx - 1] : null;

    // Best single-level improvement (discrete leaves only).
    const perf = new Map<string, string>();
    evaluation.performances.filter((p) => p.optionId === activeWhyId).forEach((p) => perf.set(p.criterionId, p.value));
    const levers = qualCriteria
      .map((c) => {
        if (c.type !== 'qualification' || c.continuous) return null;
        const levelId = perf.get(c.id);
        const scale = scaleMap.get(c.id);
        if (!levelId || !scale) return null;
        const levels = c.descriptor.levels;
        const idx = levels.findIndex((l) => l.id === levelId);
        if (idx <= 0) return null; // already at the best level (or not set)
        const vCur = scale.values.find((s) => s.levelId === levelId)?.value;
        const vNext = scale.values.find((s) => s.levelId === levels[idx - 1].id)?.value;
        const w = effW.get(c.id);
        if (vCur == null || vNext == null || w == null) return null;
        const delta = w * (vNext - vCur);
        if (delta <= 0.05) return null;
        return { id: c.id, label: c.label, from: levels[idx].label, to: levels[idx - 1].label, delta };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.delta - a.delta);

    return { strengths, weaknesses, nextBand, levers, global };
  })();

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
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1.5"
          >
            <IconExport className="w-4 h-4" /> JSON
          </button>
        </div>
      </div>

      {/* ── Decision policy (compact strip) ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Política de decisão</span>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 mt-2.5">
          {bandViews.map((v, i) => (
            <Fragment key={v.band.id}>
              {i > 0 && <span className="text-gray-300 select-none">·</span>}
              <span className="inline-flex items-center gap-2">
                <span className="text-xs font-bold rounded-full px-2.5 py-0.5 text-white" style={{ backgroundColor: v.band.color }}>
                  {v.band.label}
                </span>
                <span className="font-mono text-xs text-gray-500">{bandRangeLabel(v.band, result.decisionScale)}</span>
              </span>
            </Fragment>
          ))}
        </div>
      </div>

      {/* ── Ranking cards (one row each) ── */}
      <div className="space-y-2.5">
        {sorted.map((r) => {
          const option = evaluation.options.find((o) => o.id === r.optionId);
          const band = bandOf(r.bandId);
          const rejected = r.hardRejected;
          const accent = rejected ? '#dc2626' : band?.color ?? '#94a3b8';
          const isWhy = activeWhyId === r.optionId;

          return (
            <div
              key={r.optionId}
              className={`bg-white rounded-xl border p-3.5 transition-shadow ${isWhy ? 'ring-2 ring-indigo-300' : ''}`}
              style={{ borderColor: accent + '55', borderLeftWidth: '4px', borderLeftColor: accent }}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-800 flex-1 min-w-0 truncate">
                  {option?.label ?? r.optionId}
                </span>
                <span
                  className="font-mono text-base font-bold tabular-nums shrink-0"
                  style={{ color: rejected ? '#9ca3af' : '#334155' }}
                >
                  {rejected ? '—' : r.globalValue?.toFixed(1) ?? '—'}
                </span>
                <span
                  className="text-xs font-bold rounded-lg px-2.5 py-1 shrink-0 whitespace-nowrap"
                  style={{ backgroundColor: accent + '22', color: accent }}
                >
                  {rejected ? 'Reprovado' : band?.label ?? '—'}
                </span>
              </div>
              {rejected ? (
                <p className="text-xs text-red-600 mt-1.5">
                  ❌{' '}
                  {r.rejectedByGate
                    ? `Critério de habilitação «${model.valueTree.criteria[r.rejectedByGate]?.label ?? ''}» não cumprido — eliminado antes da pontuação.`
                    : r.vetoedByCriterion
                    ? `Veto: «${model.valueTree.criteria[r.vetoedByCriterion]?.label ?? ''}».`
                    : 'Eliminado antes da pontuação.'}
                </p>
              ) : (
                <button
                  onClick={() => setWhyOptionId(isWhy && whyOptionId !== null ? null : r.optionId)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-1.5"
                >
                  {isWhy ? '▴ Fechar' : '▾ Porquê? Alavancas de melhoria'}
                </button>
              )}
            </div>
          );
        })}
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

          {/* Strengths / shortfalls pills */}
          {explain && (explain.strengths.length > 0 || explain.weaknesses.length > 0) && (
            <div className="space-y-1.5">
              {explain.strengths.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500 shrink-0">Puxaram para cima:</span>
                  {explain.strengths.map((s) => (
                    <span key={s.id} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700"
                      title="Contribuição para V(p) = peso efetivo × valor (acima de Neutro)">
                      ▲ {s.label} +{s.contrib.toFixed(0)}
                    </span>
                  ))}
                </div>
              )}
              {explain.weaknesses.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500 shrink-0">Mais a ganhar:</span>
                  {explain.weaknesses.map((s) => (
                    <span key={s.id} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700"
                      title="Valor ainda por ganhar até «Bom» = peso efetivo × (100 − valor)">
                      ▼ {s.label} −{s.shortfall.toFixed(0)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

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
                    (c) => c.type === 'qualification' &&
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

          {/* Lever — what to change to reach the next decision band */}
          {explain && (
            !explain.nextBand ? (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-xs text-emerald-800">
                🏆 Já está no perfil mais alto da escala de decisão.
              </div>
            ) : explain.levers.length === 0 ? (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
                Todos os critérios já estão no nível máximo — só alterar pesos ou escalas mudaria o perfil «{explain.nextBand.band.label}».
              </div>
            ) : (() => {
              const best = explain.levers[0];
              const target = explain.nextBand.lower;
              const newGlobal = explain.global + best.delta;
              const reaches = newGlobal >= target;
              return (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-900 leading-relaxed">
                  🎯 <strong>Para subir a «{explain.nextBand.band.label}» (≥ {target.toFixed(1)}):</strong>{' '}
                  melhorar <strong>{best.label}</strong> de «{best.from}» → «{best.to}» soma{' '}
                  <strong>+{best.delta.toFixed(1)}</strong> → {newGlobal.toFixed(1)}
                  {reaches
                    ? ' — fecha a lacuna.'
                    : ` — faltam ainda ${(target - newGlobal).toFixed(1)} (combine vários critérios).`}
                  <span className="block text-amber-700/70 mt-0.5">Alavanca mais eficiente: maior ganho de V(p) por melhoria de um nível.</span>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* ── Bar chart ── */}
      <div className="border border-gray-200 rounded-xl p-4 bg-white">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Valor Global V(p) — Modelo Aditivo</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            {/* Decision zones as translucent background bands */}
            {bandViews.map((v) => (
              <ReferenceArea
                key={v.band.id}
                y1={v.isBase ? axisBottom : v.lower}
                y2={v.upper ?? axisTop}
                fill={v.band.color}
                fillOpacity={0.1}
                stroke="none"
                ifOverflow="extendDomain"
              />
            ))}
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis domain={[axisBottom, axisTop]} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => [`${v}`, 'V(p)']} />
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
          <h3 className="text-sm font-semibold text-gray-700">Observações por {subj.one}</h3>
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
