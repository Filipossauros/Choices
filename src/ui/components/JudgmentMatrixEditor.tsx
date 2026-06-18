import { useState, useEffect, useCallback } from 'react';
import type { MacbethJudgment, MacbethCategory, ConsistencyReport } from '../../domain/types';
import { checkConsistency, type JudgmentEntry } from '../../engine/consistency';
import ConsistencyBadge from './ConsistencyBadge';

const CATEGORIES: { value: MacbethCategory; label: string; short: string }[] = [
  { value: 0, label: 'Nula (C0)', short: 'C0' },
  { value: 1, label: 'Muito fraca (C1)', short: 'C1' },
  { value: 2, label: 'Fraca (C2)', short: 'C2' },
  { value: 3, label: 'Moderada (C3)', short: 'C3' },
  { value: 4, label: 'Forte (C4)', short: 'C4' },
  { value: 5, label: 'Muito forte (C5)', short: 'C5' },
  { value: 6, label: 'Extrema (C6)', short: 'C6' },
];

function jLo(j: MacbethJudgment): MacbethCategory {
  return j.kind === 'exact' ? j.category : j.lo;
}
function jHi(j: MacbethJudgment): MacbethCategory {
  return j.kind === 'exact' ? j.category : j.hi;
}

interface Item {
  id: string;
  label: string;
}

interface Props {
  items: Item[];
  judgments: Record<string, MacbethJudgment>;
  onChange: (judgments: Record<string, MacbethJudgment>) => void;
  readOnly?: boolean;
}

export default function JudgmentMatrixEditor({ items, judgments, onChange, readOnly }: Props) {
  const [report, setReport] = useState<ConsistencyReport | null>(null);
  const [checking, setChecking] = useState(false);

  const buildEntries = useCallback((): JudgmentEntry[] => {
    return Object.entries(judgments).map(([key, j]) => {
      const [idA, idB] = key.split('__');
      return { idA, idB, judgment: j };
    });
  }, [judgments]);

  useEffect(() => {
    if (Object.keys(judgments).length === 0) { setReport(null); return; }
    setChecking(true);
    const ids = items.map((i) => i.id);
    checkConsistency(ids, buildEntries())
      .then(setReport)
      .finally(() => setChecking(false));
  }, [judgments, items, buildEntries]);

  function getJudgment(idA: string, idB: string): MacbethJudgment | undefined {
    return judgments[`${idA}__${idB}`];
  }

  function setLo(idA: string, idB: string, lo: MacbethCategory) {
    const key = `${idA}__${idB}`;
    const existing = judgments[key];
    const prevHi = existing ? jHi(existing) : lo;
    const hi = (prevHi >= lo ? prevHi : lo) as MacbethCategory;
    onChange({ ...judgments, [key]: lo === hi ? { kind: 'exact', category: lo } : { kind: 'interval', lo, hi } });
  }

  function setHi(idA: string, idB: string, hi: MacbethCategory) {
    const key = `${idA}__${idB}`;
    const existing = judgments[key];
    if (!existing) return;
    const lo = jLo(existing);
    onChange({ ...judgments, [key]: lo === hi ? { kind: 'exact', category: lo } : { kind: 'interval', lo, hi } });
  }

  function clearJudgment(idA: string, idB: string) {
    const key = `${idA}__${idB}`;
    const { [key]: _, ...rest } = judgments;
    onChange(rest);
  }

  function applyCorrection(pair: ConsistencyReport['inconsistentPairs'][0]) {
    const key = `${pair.idA}__${pair.idB}`;
    onChange({ ...judgments, [key]: pair.suggestedJudgment });
  }

  function labelOf(id: string) {
    return items.find((i) => i.id === id)?.label ?? id;
  }

  function displayJudgment(j: MacbethJudgment): string {
    if (j.kind === 'exact') return CATEGORIES[j.category].short;
    return `${CATEGORIES[j.lo].short}–${CATEGORIES[j.hi].short}`;
  }

  if (items.length < 2) {
    return <p className="text-sm text-gray-400 italic">São necessários pelo menos 2 elementos.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Preencha a diferença de atratividade entre cada par (linha mais atrativa que coluna).
          Para juízos intervalares, ajuste o limite superior.
        </p>
        <ConsistencyBadge report={report} loading={checking} />
      </div>

      <div className="overflow-x-auto">
        <table className="text-sm border-collapse">
          <thead>
            <tr>
              <th className="w-28" />
              {items.slice(1).map((item) => (
                <th
                  key={item.id}
                  className="px-2 py-1 text-center text-gray-600 font-medium border border-gray-200 bg-gray-50 max-w-24"
                >
                  <span className="block truncate" title={item.label}>{item.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.slice(0, -1).map((rowItem, ri) => (
              <tr key={rowItem.id}>
                <td className="px-2 py-1 font-medium text-gray-700 border border-gray-200 bg-gray-50 max-w-28">
                  <span className="block truncate" title={rowItem.label}>{rowItem.label}</span>
                </td>
                {items.slice(ri + 1).map((colItem) => {
                  const j = getJudgment(rowItem.id, colItem.id);
                  const lo = j ? jLo(j) : undefined;
                  const hi = j ? jHi(j) : undefined;
                  const isInterval = j && j.kind === 'interval';
                  const isConflict = report?.inconsistentPairs.some(
                    (p) => p.idA === rowItem.id && p.idB === colItem.id,
                  );
                  return (
                    <td
                      key={colItem.id}
                      className={`border border-gray-200 p-0 ${isConflict ? 'bg-red-50' : ''}`}
                    >
                      {readOnly ? (
                        <span className="flex items-center justify-center h-8 text-gray-600 font-medium text-xs">
                          {j ? displayJudgment(j) : '—'}
                        </span>
                      ) : (
                        <div className="flex items-center justify-center h-8 px-0.5 gap-0.5">
                          {/* Lo / exact select */}
                          <select
                            value={lo ?? ''}
                            onChange={(e) => {
                              if (e.target.value === '') {
                                clearJudgment(rowItem.id, colItem.id);
                              } else {
                                setLo(rowItem.id, colItem.id, parseInt(e.target.value) as MacbethCategory);
                              }
                            }}
                            className={`w-12 h-6 text-center text-xs border border-gray-200 rounded bg-white focus:ring-1 focus:ring-blue-400 cursor-pointer ${
                              isConflict ? 'text-red-700 font-semibold border-red-300' : ''
                            }`}
                            aria-label={`Juízo lo: ${rowItem.label} vs ${colItem.label}`}
                          >
                            <option value="">—</option>
                            {CATEGORIES.map((c) => (
                              <option key={c.value} value={c.value}>{c.short}</option>
                            ))}
                          </select>

                          {/* Hi select — only when lo ≥ 1 (C0 means identical, no interval) */}
                          {lo !== undefined && lo >= 1 && (
                            <select
                              value={hi ?? lo}
                              onChange={(e) =>
                                setHi(rowItem.id, colItem.id, parseInt(e.target.value) as MacbethCategory)
                              }
                              className={`w-12 h-6 text-center text-xs rounded cursor-pointer focus:ring-1 focus:ring-blue-400 ${
                                isInterval
                                  ? 'border border-blue-400 bg-blue-50 text-blue-700 font-medium'
                                  : 'border border-gray-100 bg-transparent text-gray-300'
                              }`}
                              title="Limite superior do intervalo (opcional — igual ao inferior = juízo exacto)"
                              aria-label={`Juízo hi: ${rowItem.label} vs ${colItem.label}`}
                            >
                              {CATEGORIES.filter((c) => c.value >= lo).map((c) => (
                                <option key={c.value} value={c.value}>{c.short}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
        {CATEGORIES.map((c) => (
          <span key={c.value}>
            <strong>{c.short}</strong> = {c.label}
          </span>
        ))}
        <span className="text-gray-400">· O segundo campo define o limite superior de um juízo intervalar (ex.: C3–C5).</span>
      </div>

      {/* Inconsistency corrections */}
      {report && !report.isConsistent && report.inconsistentPairs.length > 0 && (
        <div className="border border-red-200 bg-red-50 rounded p-3 space-y-2">
          <p className="text-sm font-medium text-red-700">
            Correções sugeridas para restaurar a consistência:
          </p>
          {report.inconsistentPairs.map((pair, i) => {
            const suggested =
              pair.suggestedJudgment.kind === 'exact'
                ? CATEGORIES[pair.suggestedJudgment.category]?.label
                : `C${pair.suggestedJudgment.lo}–C${pair.suggestedJudgment.hi}`;
            return (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="text-gray-700">
                  <strong>{labelOf(pair.idA)}</strong> vs <strong>{labelOf(pair.idB)}</strong>:{' '}
                  alterar para <em>{suggested}</em>
                </span>
                {!readOnly && (
                  <button
                    onClick={() => applyCorrection(pair)}
                    className="px-2 py-0.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Aplicar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
