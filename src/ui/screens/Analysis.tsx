import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../store';
import type {
  Criterion, EvaluationModel, Option, Performance, QualificationCriterion, ValueTreeNode,
} from '../../domain/types';
import { modelReadiness } from '../../domain/tree';
import { v4 as uuidv4 } from 'uuid';
import ScreenNav from '../components/ScreenNav';
import ModelNotReady from '../components/ModelNotReady';
import { IconGate, IconQualification } from '../components/icons';

/** A scored column plus the composite factor it belongs to, in tree order. */
interface Column {
  crit: Criterion;
  groupId: string | null;
  groupLabel: string | null;
}

/**
 * Columns in value-tree order so criteria stay under the factor they were
 * grouped into — a flat alphabetical list would discard the structure the user
 * built on the Criteria screen.
 */
function tableColumns(model: EvaluationModel): Column[] {
  const { criteria } = model.valueTree;
  const out: Column[] = [];
  (function walk(node: ValueTreeNode, groupId: string | null, groupLabel: string | null) {
    for (const child of node.children) {
      const c = criteria[child.criterionId];
      if (!c) continue;
      if (c.type === 'composite') walk(child, c.id, c.label);
      else out.push({ crit: c, groupId, groupLabel });
    }
  })(model.valueTree.root, null, null);
  return out;
}

/** Consecutive columns sharing a factor, for the spanning header row. */
function headerSpans(cols: Column[]): { label: string | null; span: number }[] {
  const spans: { label: string | null; span: number }[] = [];
  for (const col of cols) {
    const last = spans[spans.length - 1];
    if (last && last.label === col.groupLabel && col.groupLabel !== null) last.span++;
    else spans.push({ label: col.groupLabel, span: 1 });
  }
  return spans;
}

/** Position [0,1] of a descriptor level (0 = least attractive). */
function levelPos(crit: QualificationCriterion, levelId: string): number {
  const levels = crit.descriptor.levels;
  const n = levels.length;
  if (n <= 1) return 0;
  const idx = levels.findIndex((l) => l.id === levelId);
  return idx < 0 ? 0 : (n - 1 - idx) / (n - 1);
}

/** Nearest level label for a continuous position. */
function nearestLevel(crit: QualificationCriterion, position: number): string {
  const levels = crit.descriptor.levels;
  let best = levels[0];
  let bestD = Infinity;
  for (const l of levels) {
    const d = Math.abs(levelPos(crit, l.id) - position);
    if (d < bestD) { bestD = d; best = l; }
  }
  return best?.label ?? '';
}

export default function Analysis() {
  const { t } = useTranslation();
  const { state, dispatch } = useApp();
  const evaluation = state.evaluation!;
  const model = evaluation.model;
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const isPositions = model.subjectKind === 'positions';
  const subjectSingular = isPositions ? t('posição') : t('proposta');
  const subjectPlaceholder = isPositions ? t('Nome da posição / momento…') : t('Nome da proposta…');
  const subjectColumnHeader = isPositions ? t('Posição / Momento') : t('Proposta');
  const subjectScreenTitle = isPositions ? t('Análise e monitorização') : t('Análise e avaliação');
  const subjectScreenDesc = isPositions
    ? t('Registe as posições / momentos, responda às condições eliminatórias e classifique o desempenho em cada critério de qualificação. Uma condição eliminatória não cumprida exclui a posição antes da agregação.')
    : t('Registe as propostas, responda às condições eliminatórias e classifique o desempenho em cada critério de qualificação. Uma condição eliminatória não cumprida reprova a proposta antes da agregação.');

  const columns = tableColumns(model);
  const spans = headerSpans(columns);
  const qualCriteria = Object.values(model.valueTree.criteria).filter(
    (c) => c.type === 'qualification',
  ) as QualificationCriterion[];
  const gateCriteria = Object.values(model.valueTree.criteria).filter((c) => c.type === 'gate');
  const allCriteria = [...gateCriteria, ...qualCriteria];
  const readiness = modelReadiness(model);

  // Progress over the whole grid, so the user knows how much is left without
  // scrolling the table sideways to look for empty cells.
  const expected = evaluation.options.length * columns.length;
  const liveIds = new Set(evaluation.options.map((o) => o.id));
  const filled = evaluation.performances.filter(
    (p) => liveIds.has(p.optionId) && model.valueTree.criteria[p.criterionId] && (p.value || p.position != null),
  ).length;

  function findPerf(optionId: string, criterionId: string): Performance | undefined {
    return evaluation.performances.find((p) => p.optionId === optionId && p.criterionId === criterionId);
  }

  function setPerf(optionId: string, criterionId: string, value: string) {
    const rest = evaluation.performances.filter((p) => !(p.optionId === optionId && p.criterionId === criterionId));
    const updated: Performance[] = value ? [...rest, { optionId, criterionId, value }] : rest;
    dispatch({ type: 'UPDATE_EVALUATION', patch: { performances: updated } });
  }

  function setPosition(optionId: string, criterionId: string, crit: QualificationCriterion, position: number) {
    const rest = evaluation.performances.filter((p) => !(p.optionId === optionId && p.criterionId === criterionId));
    dispatch({
      type: 'UPDATE_EVALUATION',
      patch: { performances: [...rest, { optionId, criterionId, value: nearestLevel(crit, position), position }] },
    });
  }

  function addOption() {
    if (!newLabel.trim()) return;
    const option: Option = { id: uuidv4(), label: newLabel.trim(), createdAt: new Date().toISOString() };
    dispatch({ type: 'UPDATE_EVALUATION', patch: { options: [...evaluation.options, option] } });
    setNewLabel('');
  }

  function deleteOption(id: string) {
    if (!confirm(t('Eliminar esta {{subject}}?', { subject: subjectSingular }))) return;
    dispatch({
      type: 'UPDATE_EVALUATION',
      patch: {
        options: evaluation.options.filter((o) => o.id !== id),
        performances: evaluation.performances.filter((p) => p.optionId !== id),
      },
    });
  }

  function updateOptionLabel(id: string, label: string) {
    dispatch({ type: 'UPDATE_EVALUATION', patch: { options: evaluation.options.map((o) => (o.id === id ? { ...o, label } : o)) } });
    setEditingId(null);
  }

  if (allCriteria.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-10 px-4 text-center text-gray-400">
        <p>{t('O modelo aplicado não tem critérios definidos.')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-gray-800">{subjectScreenTitle}</h2>
        <p className="text-sm text-gray-500">{subjectScreenDesc}</p>
      </div>

      {/* Surfaced here rather than only on Results, so the gap is known before
          the work of filling the grid, not after. */}
      {!readiness.ready && <ModelNotReady compact />}

      <div className="flex items-center gap-3">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addOption()}
          placeholder={subjectPlaceholder}
          className="flex-1 border border-gray-200 rounded px-3 py-2 text-sm"
        />
        <button onClick={addOption} className="px-4 py-2 bg-blue-700 text-white text-sm rounded hover:bg-blue-800">
          {t('+ Adicionar {{subject}}', { subject: subjectSingular })}
        </button>
      </div>

      {evaluation.options.length === 0 ? (
        <div className="text-center py-10 px-4 border-2 border-dashed border-gray-200 rounded-xl space-y-1">
          <p className="text-gray-500 text-sm">{t('Nenhuma {{subject}} registada ainda.', { subject: subjectSingular })}</p>
          <p className="text-gray-400 text-xs max-w-md mx-auto">
            {t('Dê um nome a cada alternativa que quer comparar ({{example}}) e classifique-a depois nos {{n}} critérios do modelo.', {
              example: isPositions ? t('ex.: «Janeiro», «Fevereiro»') : t('ex.: «Proposta A», «Solução do fornecedor X»'),
              n: columns.length,
            })}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-gray-500">
              {t('{{filled}} de {{expected}} desempenhos preenchidos', { filled, expected })}
              {columns.length > 4 && (
                <span className="text-gray-400"> · {t('deslize a tabela na horizontal para ver todos os critérios')}</span>
              )}
            </p>
            <div className="h-1.5 w-40 rounded-full bg-gray-200 overflow-hidden" aria-hidden="true">
              <div
                className={`h-full rounded-full transition-all ${filled >= expected ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${expected ? Math.round((filled / expected) * 100) : 0}%` }}
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                {/* Factor row — keeps the value-tree grouping visible */}
                {spans.some((s) => s.label) && (
                  <tr className="bg-gray-100">
                    <th className="sticky left-0 z-20 bg-gray-100 border-b border-r border-gray-200" />
                    {spans.map((s, i) => (
                      <th
                        key={i}
                        colSpan={s.span}
                        className="px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-emerald-800 border-b border-r border-gray-200 last:border-r-0"
                      >
                        {s.label ?? ''}
                      </th>
                    ))}
                    <th className="border-b border-gray-200" />
                  </tr>
                )}
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left font-medium text-gray-600 border-b border-r border-gray-200 sticky left-0 z-20 bg-gray-50 min-w-[9rem]">
                    {subjectColumnHeader}
                  </th>
                  {columns.map(({ crit: c }) => (
                    <th
                      key={c.id}
                      className={`px-3 py-2 text-center font-medium text-gray-600 border-b border-r border-gray-200 whitespace-nowrap ${
                        c.type === 'gate' ? 'bg-orange-50' : ''
                      }`}
                      title={c.type === 'gate' ? t('Condição eliminatória') : t('Critério de qualificação')}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {c.type === 'gate'
                          ? <IconGate className="w-3.5 h-3.5 text-orange-500" />
                          : <IconQualification className="w-3.5 h-3.5 text-indigo-500" />}
                        {c.label}
                        {c.type === 'qualification' && c.continuous ? t(' (contínuo)') : ''}
                      </span>
                    </th>
                  ))}
                  <th className="px-2 py-2 border-b border-gray-200" />
                </tr>
              </thead>
              <tbody>
                {evaluation.options.map((option) => (
                  <tr key={option.id} className="hover:bg-gray-50 group">
                    <td className="px-3 py-2 border-b border-r border-gray-200 sticky left-0 z-10 bg-white group-hover:bg-gray-50">
                      {editingId === option.id ? (
                        <input
                          autoFocus
                          defaultValue={option.label}
                          onBlur={(e) => updateOptionLabel(option.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') updateOptionLabel(option.id, (e.target as HTMLInputElement).value);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="border border-blue-300 rounded px-2 py-0.5 w-full"
                        />
                      ) : (
                        <button className="font-medium text-gray-800 hover:text-blue-700 text-left" onClick={() => setEditingId(option.id)}>
                          {option.label}
                        </button>
                      )}
                    </td>

                    {columns.map(({ crit }) => {
                      if (crit.type === 'gate') {
                        const val = findPerf(option.id, crit.id)?.value ?? '';
                        return (
                          <td key={crit.id} className="border-b border-r border-gray-200 p-1 text-center">
                            <select
                              value={val}
                              onChange={(e) => setPerf(option.id, crit.id, e.target.value)}
                              className={`text-xs border-0 rounded px-2 py-1 font-medium ${
                                val === 'pass' ? 'bg-green-100 text-green-700' : val === 'fail' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              <option value="">—</option>
                              <option value="pass">{t('Cumpre')}</option>
                              <option value="fail">{t('Não cumpre')}</option>
                            </select>
                          </td>
                        );
                      }
                      const c = crit as QualificationCriterion;
                      const perf = findPerf(option.id, c.id);
                      if (c.continuous) {
                        const pos = perf?.position ?? (perf?.value ? levelPos(c, c.descriptor.levels.find((l) => l.label === perf.value)?.id ?? '') : 0.5);
                        return (
                          <td key={c.id} className="border-b border-r border-gray-200 p-2 text-center min-w-[140px]">
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.01}
                              value={pos}
                              onChange={(e) => setPosition(option.id, c.id, c, Number(e.target.value))}
                              className="w-full accent-blue-600"
                            />
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              {perf ? `${(pos * 100).toFixed(0)}% · ≈ ${nearestLevel(c, pos)}` : t('por definir')}
                            </div>
                          </td>
                        );
                      }
                      const val = perf?.value ?? '';
                      return (
                        <td key={c.id} className={`border-b border-r border-gray-200 p-1 text-center ${val ? '' : 'bg-amber-50/40'}`}>
                          <select
                            value={val}
                            onChange={(e) => setPerf(option.id, c.id, e.target.value)}
                            className="text-xs border-0 bg-transparent focus:ring-1 focus:ring-blue-400 cursor-pointer"
                          >
                            <option value="">—</option>
                            {c.descriptor.levels.map((level, idx) => (
                              <option key={level.id} value={level.id}>
                                {level.label}
                                {c.descriptor.neutralIndex === idx ? t(' (Neutro)') : ''}
                                {c.descriptor.goodIndex === idx ? t(' (Bom)') : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}

                    <td className="border-b border-gray-200 px-2">
                      <button onClick={() => deleteOption(option.id)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Habilitação summary */}
          {gateCriteria.length > 0 && (
            <div className="border border-orange-200 bg-orange-50/50 rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-semibold text-orange-800">{t('Habilitação — Nível 1 (eliminatório)')}</h3>
              <div className="flex flex-wrap gap-2">
                {evaluation.options.map((o) => {
                  const statuses = gateCriteria.map((g) => findPerf(o.id, g.id)?.value ?? 'pending');
                  const anyFail = statuses.some((s) => s === 'fail');
                  const allPass = statuses.every((s) => s === 'pass');
                  return (
                    <span
                      key={o.id}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        anyFail ? 'bg-red-100 text-red-700' : allPass ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {o.label}: {anyFail ? t('Reprovado') : allPass ? t('Habilitado') : t('Por verificar')}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <ScreenNav
        next="results"
        nextLabel="Resultados"
        hint="Registe as propostas e o seu desempenho antes de agregar."
        blockedBy={evaluation.options.length === 0 ? t('Adicione pelo menos uma {{subject}} para continuar.', { subject: subjectSingular }) : undefined}
      />
    </div>
  );
}
