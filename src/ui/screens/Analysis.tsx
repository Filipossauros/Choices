import { useState } from 'react';
import { useApp } from '../store';
import type { Option, Performance, QualificationCriterion } from '../../domain/types';
import { v4 as uuidv4 } from 'uuid';
import ScreenNav from '../components/ScreenNav';
import { IconGate, IconQualification } from '../components/icons';

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
  const { state, dispatch } = useApp();
  const evaluation = state.evaluation!;
  const model = evaluation.model;
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const isPositions = model.subjectKind === 'positions';
  const subjectSingular = isPositions ? 'posição' : 'proposta';
  const subjectPlaceholder = isPositions ? 'Nome da posição / momento…' : 'Nome da proposta…';
  const subjectColumnHeader = isPositions ? 'Posição / Momento' : 'Proposta';
  const subjectScreenTitle = isPositions ? 'Análise e monitorização' : 'Análise e avaliação';
  const subjectScreenDesc = isPositions
    ? 'Registe as posições / momentos, verifique a habilitação (portas) e classifique o desempenho em cada critério de qualificação. Uma porta falhada exclui a posição antes da agregação.'
    : 'Registe as propostas, verifique a habilitação (portas) e classifique o desempenho em cada critério de qualificação. Uma porta falhada reprova a proposta antes da agregação.';

  const qualCriteria = Object.values(model.valueTree.criteria).filter(
    (c) => c.type === 'qualification',
  ) as QualificationCriterion[];
  const gateCriteria = Object.values(model.valueTree.criteria).filter((c) => c.type === 'gate');
  const allCriteria = [...gateCriteria, ...qualCriteria];

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
    if (!confirm(`Eliminar esta ${subjectSingular}?`)) return;
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
        <p>O modelo aplicado não tem critérios definidos.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-gray-800">{subjectScreenTitle}</h2>
        <p className="text-sm text-gray-500">{subjectScreenDesc}</p>
      </div>

      <div className="flex items-center gap-3">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addOption()}
          placeholder={subjectPlaceholder}
          className="flex-1 border border-gray-200 rounded px-3 py-2 text-sm"
        />
        <button onClick={addOption} className="px-4 py-2 bg-blue-700 text-white text-sm rounded hover:bg-blue-800">
          + Adicionar {subjectSingular}
        </button>
      </div>

      {evaluation.options.length === 0 ? (
        <p className="text-center text-gray-400 italic py-8">Nenhuma {subjectSingular} registada ainda.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left font-medium text-gray-600 border border-gray-200 sticky left-0 bg-gray-50">{subjectColumnHeader}</th>
                  {gateCriteria.map((c) => (
                    <th key={c.id} className="px-3 py-2 text-center font-medium text-gray-600 border border-gray-200 bg-orange-50" title="Porta (habilitação)">
                      <span className="inline-flex items-center gap-1.5"><IconGate className="w-3.5 h-3.5 text-orange-500" /> {c.label}</span>
                    </th>
                  ))}
                  {qualCriteria.map((c) => (
                    <th key={c.id} className="px-3 py-2 text-center font-medium text-gray-600 border border-gray-200" title="Critério de qualificação">
                      <span className="inline-flex items-center gap-1.5"><IconQualification className="w-3.5 h-3.5 text-indigo-500" /> {c.label}{c.continuous ? ' (contínuo)' : ''}</span>
                    </th>
                  ))}
                  <th className="px-2 py-2 border border-gray-200" />
                </tr>
              </thead>
              <tbody>
                {evaluation.options.map((option) => (
                  <tr key={option.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 border border-gray-200 sticky left-0 bg-white">
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

                    {gateCriteria.map((c) => {
                      const val = findPerf(option.id, c.id)?.value ?? '';
                      return (
                        <td key={c.id} className="border border-gray-200 p-1 text-center">
                          <select
                            value={val}
                            onChange={(e) => setPerf(option.id, c.id, e.target.value)}
                            className={`text-xs border-0 rounded px-2 py-1 font-medium ${
                              val === 'pass' ? 'bg-green-100 text-green-700' : val === 'fail' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            <option value="">—</option>
                            <option value="pass">Cumpre</option>
                            <option value="fail">Não cumpre</option>
                          </select>
                        </td>
                      );
                    })}

                    {qualCriteria.map((c) => {
                      const perf = findPerf(option.id, c.id);
                      if (c.continuous) {
                        const pos = perf?.position ?? (perf?.value ? levelPos(c, c.descriptor.levels.find((l) => l.label === perf.value)?.id ?? '') : 0.5);
                        return (
                          <td key={c.id} className="border border-gray-200 p-2 text-center min-w-[140px]">
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
                              {perf ? `${(pos * 100).toFixed(0)}% · ≈ ${nearestLevel(c, pos)}` : 'por definir'}
                            </div>
                          </td>
                        );
                      }
                      const val = perf?.value ?? '';
                      return (
                        <td key={c.id} className="border border-gray-200 p-1 text-center">
                          <select
                            value={val}
                            onChange={(e) => setPerf(option.id, c.id, e.target.value)}
                            className="text-xs border-0 bg-transparent focus:ring-1 focus:ring-blue-400 cursor-pointer"
                          >
                            <option value="">—</option>
                            {c.descriptor.levels.map((level, idx) => (
                              <option key={level.id} value={level.id}>
                                {level.label}
                                {c.descriptor.neutralIndex === idx ? ' (Neutro)' : ''}
                                {c.descriptor.goodIndex === idx ? ' (Bom)' : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}

                    <td className="border border-gray-200 px-2">
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
              <h3 className="text-sm font-semibold text-orange-800">Habilitação (Andar 1)</h3>
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
                      {o.label}: {anyFail ? 'Reprovado' : allPass ? 'Habilitado' : 'Por verificar'}
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
        blockedBy={evaluation.options.length === 0 ? `Adicione pelo menos uma ${subjectSingular} para continuar.` : undefined}
      />
    </div>
  );
}
