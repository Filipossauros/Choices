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

  function setJudgment(idA: string, idB: string, cat: MacbethCategory) {
    const key = `${idA}__${idB}`;
    onChange({ ...judgments, [key]: { kind: 'exact', category: cat } });
  }

  function applyCorrection(pair: ConsistencyReport['inconsistentPairs'][0]) {
    const key = `${pair.idA}__${pair.idB}`;
    onChange({ ...judgments, [key]: pair.suggestedJudgment });
  }

  function getJudgment(idA: string, idB: string): MacbethCategory | undefined {
    const j = judgments[`${idA}__${idB}`];
    if (!j) return undefined;
    return j.kind === 'exact' ? j.category : j.lo;
  }

  function labelOf(id: string) {
    return items.find((i) => i.id === id)?.label ?? id;
  }

  if (items.length < 2) {
    return <p className="text-sm text-gray-400 italic">São necessários pelo menos 2 elementos.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Preencha a diferença de atratividade entre cada par (linha mais atrativa que coluna).
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
                  className="px-2 py-1 text-center text-gray-600 font-medium border border-gray-200 bg-gray-50 max-w-20"
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
                  const cat = getJudgment(rowItem.id, colItem.id);
                  const isConflict = report?.inconsistentPairs.some(
                    (p) => p.idA === rowItem.id && p.idB === colItem.id,
                  );
                  return (
                    <td
                      key={colItem.id}
                      className={`border border-gray-200 p-0 ${isConflict ? 'bg-red-50' : ''}`}
                    >
                      {readOnly ? (
                        <span className="flex items-center justify-center h-8 text-gray-600 font-medium">
                          {cat !== undefined ? CATEGORIES[cat].short : '—'}
                        </span>
                      ) : (
                        <select
                          value={cat ?? ''}
                          onChange={(e) =>
                            setJudgment(
                              rowItem.id,
                              colItem.id,
                              parseInt(e.target.value) as MacbethCategory,
                            )
                          }
                          className={`w-full h-8 text-center text-xs border-0 bg-transparent focus:ring-1 focus:ring-blue-400 cursor-pointer ${
                            isConflict ? 'text-red-700 font-semibold' : ''
                          }`}
                          aria-label={`Juízo: ${rowItem.label} vs ${colItem.label}`}
                        >
                          <option value="">—</option>
                          {CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.short}
                            </option>
                          ))}
                        </select>
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
