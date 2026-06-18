import { useState } from 'react';
import { useApp } from '../store';
import type { Option, Performance } from '../../domain/types';
import { v4 as uuidv4 } from 'uuid';

export default function Proposals() {
  const { state, dispatch } = useApp();
  const model = state.model!;
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const qualCriteria = Object.values(model.valueTree.criteria).filter(
    (c) => c.type === 'qualification',
  );
  const gateCriteria = Object.values(model.valueTree.criteria).filter(
    (c) => c.type === 'gate',
  );
  const allCriteria = [...gateCriteria, ...qualCriteria];

  function getPerf(optionId: string, criterionId: string): string {
    return (
      model.performances.find(
        (p) => p.optionId === optionId && p.criterionId === criterionId,
      )?.value ?? ''
    );
  }

  function setPerf(optionId: string, criterionId: string, value: string) {
    const existing = model.performances.filter(
      (p) => !(p.optionId === optionId && p.criterionId === criterionId),
    );
    const updated: Performance[] = value
      ? [...existing, { optionId, criterionId, value }]
      : existing;
    dispatch({ type: 'UPDATE_MODEL', patch: { performances: updated } });
  }

  function addOption() {
    if (!newLabel.trim()) return;
    const option: Option = {
      id: uuidv4(),
      label: newLabel.trim(),
      createdAt: new Date().toISOString(),
    };
    dispatch({
      type: 'UPDATE_MODEL',
      patch: { options: [...model.options, option] },
    });
    setNewLabel('');
  }

  function deleteOption(id: string) {
    if (!confirm('Eliminar esta proposta?')) return;
    dispatch({
      type: 'UPDATE_MODEL',
      patch: {
        options: model.options.filter((o) => o.id !== id),
        performances: model.performances.filter((p) => p.optionId !== id),
      },
    });
  }

  function updateOptionLabel(id: string, label: string) {
    dispatch({
      type: 'UPDATE_MODEL',
      patch: {
        options: model.options.map((o) => (o.id === id ? { ...o, label } : o)),
      },
    });
    setEditingId(null);
  }

  if (allCriteria.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-10 px-4 text-center text-gray-400">
        <p>Defina primeiro os critérios no ecrã de Estruturação.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addOption()}
          placeholder="Nome da proposta…"
          className="flex-1 border border-gray-200 rounded px-3 py-2 text-sm"
        />
        <button
          onClick={addOption}
          className="px-4 py-2 bg-blue-700 text-white text-sm rounded hover:bg-blue-800"
        >
          + Adicionar proposta
        </button>
      </div>

      {model.options.length === 0 ? (
        <p className="text-center text-gray-400 italic py-8">
          Nenhuma proposta registada ainda.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left font-medium text-gray-600 border border-gray-200 sticky left-0 bg-gray-50">
                  Proposta
                </th>
                {gateCriteria.map((c) => (
                  <th
                    key={c.id}
                    className="px-3 py-2 text-center font-medium text-gray-600 border border-gray-200 bg-orange-50"
                    title="Porta (habilitação)"
                  >
                    🚪 {c.label}
                  </th>
                ))}
                {qualCriteria.map((c) => (
                  <th
                    key={c.id}
                    className="px-3 py-2 text-center font-medium text-gray-600 border border-gray-200"
                    title="Critério MACBETH"
                  >
                    📊 {c.label}
                  </th>
                ))}
                <th className="px-2 py-2 border border-gray-200" />
              </tr>
            </thead>
            <tbody>
              {model.options.map((option) => (
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
                      <button
                        className="font-medium text-gray-800 hover:text-blue-700 text-left"
                        onClick={() => setEditingId(option.id)}
                      >
                        {option.label}
                      </button>
                    )}
                  </td>

                  {gateCriteria.map((c) => {
                    const val = getPerf(option.id, c.id);
                    return (
                      <td key={c.id} className="border border-gray-200 p-1 text-center">
                        <select
                          value={val}
                          onChange={(e) => setPerf(option.id, c.id, e.target.value)}
                          className={`text-xs border-0 rounded px-2 py-1 font-medium ${
                            val === 'pass' ? 'bg-green-100 text-green-700' :
                            val === 'fail' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-500'
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
                    if (c.type !== 'qualification') return null;
                    const val = getPerf(option.id, c.id);
                    return (
                      <td key={c.id} className="border border-gray-200 p-1 text-center">
                        <select
                          value={val}
                          onChange={(e) => setPerf(option.id, c.id, e.target.value)}
                          className="text-xs border-0 bg-transparent focus:ring-1 focus:ring-blue-400 cursor-pointer"
                        >
                          <option value="">—</option>
                          {c.descriptor.levels.map((level) => (
                            <option key={level.id} value={level.id}>
                              {level.label}
                              {c.descriptor.neutralIndex === c.descriptor.levels.indexOf(level)
                                ? ' (Neutro)' : ''}
                              {c.descriptor.goodIndex === c.descriptor.levels.indexOf(level)
                                ? ' (Bom)' : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  })}

                  <td className="border border-gray-200 px-2">
                    <button
                      onClick={() => deleteOption(option.id)}
                      className="text-red-400 hover:text-red-600 text-sm"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
