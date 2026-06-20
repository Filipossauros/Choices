import { useMemo } from 'react';
import { useApp } from '../store';
import { repository } from '../../repository';
import { buildModelSpec, downloadJson } from '../../domain/modelSpec';
import { allGroupsConsistent } from '../../domain/tree';
import { sortBands } from '../../domain/decision';

export default function ModelSummary() {
  const { state, dispatch } = useApp();
  const model = state.model!;

  const spec = useMemo(() => buildModelSpec(model), [model]);
  const ready = allGroupsConsistent(model) && spec.diagnostics.scalesDerived && spec.diagnostics.leafCount > 0;

  async function exportModelJson() {
    await repository.saveModel(model);
    const json = await repository.exportModel(model.id);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `choices-modelo-${model.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportSpecJson() {
    downloadJson(`choices-spec-${model.id.slice(0, 8)}.json`, spec);
  }

  const bands = sortBands(model.decisionScale);

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-gray-800">Resumo do modelo</h2>
          <p className="text-sm text-gray-500 max-w-xl">
            Síntese completa do critério: estrutura, fórmula de agregação e fatores de ponderação.
            Exporte como JSON para alimentar agentes de IA (ex.: correr diagnósticos sobre o modelo).
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button onClick={exportSpecJson} className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
            ↓ Exportar especificação (JSON · IA)
          </button>
          <button onClick={exportModelJson} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">
            ↓ Exportar modelo (JSON)
          </button>
        </div>
      </div>

      {/* Readiness diagnostics */}
      <div className="flex flex-wrap gap-2 text-xs">
        <Chip ok={spec.diagnostics.leafCount > 0} label={`${spec.diagnostics.leafCount} critério(s) de qualificação`} />
        <Chip ok={spec.diagnostics.factorCount >= 0} label={`${spec.diagnostics.factorCount} fator(es) composto(s)`} neutral />
        <Chip ok={spec.diagnostics.scalesDerived} label="Escalas derivadas" />
        <Chip ok={spec.diagnostics.weightsComplete} label="Pesos completos" />
      </div>

      {/* Aggregation formula */}
      <section className="border border-gray-200 rounded-xl p-5 bg-white space-y-3">
        <h3 className="font-semibold text-gray-800">Fórmula de agregação</h3>
        <p className="font-mono text-sm bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-gray-800">
          {spec.formula.global}
        </p>
        {spec.formula.perGroup.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Expansão por grupo</p>
            {spec.formula.perGroup.map((f) => (
              <p key={f.target} className="font-mono text-sm text-gray-700">
                <span className="text-indigo-600 font-semibold">{f.target}</span> = {f.expression}
              </p>
            ))}
          </div>
        )}
        <ul className="text-xs text-gray-500 list-disc pl-5 space-y-0.5">
          {spec.formula.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      </section>

      {/* Global criteria table */}
      <section className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <h3 className="font-semibold text-gray-800 px-5 pt-4">Tabela global de critérios</h3>
        <div className="overflow-x-auto p-4">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="px-3 py-2 text-left border border-gray-200">Critério</th>
                <th className="px-3 py-2 text-left border border-gray-200">Tipo</th>
                <th className="px-3 py-2 text-left border border-gray-200">Grupo (pai)</th>
                <th className="px-3 py-2 text-left border border-gray-200">Níveis (Bom→Neutro)</th>
                <th className="px-3 py-2 text-right border border-gray-200">Peso efetivo</th>
              </tr>
            </thead>
            <tbody>
              {spec.criteria.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 border border-gray-200 font-medium text-gray-800">{c.label}</td>
                  <td className="px-3 py-2 border border-gray-200">
                    <TypeBadge type={c.type} />
                  </td>
                  <td className="px-3 py-2 border border-gray-200 text-gray-500">
                    {c.parent === 'root' ? '— (topo)' : spec.criteria.find((x) => x.id === c.parent)?.label ?? c.parent}
                  </td>
                  <td className="px-3 py-2 border border-gray-200 text-gray-600 text-xs">
                    {c.levels ? c.levels.map((l) => l.label + (l.anchor ? ` (${l.anchor === 'good' ? 'Bom' : 'Neutro'})` : '')).join(' › ') : '—'}
                    {c.veto && <span className="text-orange-600"> · veto: «{c.veto}»</span>}
                    {c.continuous && <span className="text-blue-600"> · contínuo</span>}
                  </td>
                  <td className="px-3 py-2 border border-gray-200 text-right font-mono">
                    {c.effectiveWeight != null ? `${(c.effectiveWeight * 100).toFixed(1)}%` : c.type === 'composite' ? '∑ filhos' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Weighting factors table */}
      <section className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <h3 className="font-semibold text-gray-800 px-5 pt-4">Fatores de ponderação (por grupo)</h3>
        <div className="overflow-x-auto p-4 space-y-4">
          {spec.weighting.groups.map((g) => (
            <div key={g.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">{g.label}</span>
                {g.consistencyMargin != null && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${g.consistencyMargin > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    z = {g.consistencyMargin.toFixed(3)}
                  </span>
                )}
              </div>
              <table className="min-w-full text-sm">
                <tbody>
                  {g.weights.map((w) => (
                    <tr key={w.criterionId}>
                      <td className="py-1 pr-3 text-gray-700 w-48">{w.label}</td>
                      <td className="py-1 pr-3 w-full">
                        <div className="bg-gray-100 rounded-full h-3.5">
                          <div className="h-3.5 rounded-full bg-blue-500" style={{ width: `${(w.weight * 100).toFixed(1)}%` }} />
                        </div>
                      </td>
                      <td className="py-1 text-right font-mono text-gray-700 w-16">{(w.weight * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      {/* Decision bands */}
      <section className="border border-gray-200 rounded-xl p-5 bg-white space-y-2">
        <h3 className="font-semibold text-gray-800">Perfis de decisão</h3>
        <div className="flex flex-wrap gap-2">
          {bands.map((b) => (
            <span key={b.id} className="px-2.5 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: b.color }}>
              {b.label}: V(p) ≥ {b.minScore.toFixed(1)}
            </span>
          ))}
        </div>
      </section>

      {/* Apply */}
      <div className="mt-8 pt-4 border-t border-gray-100 flex items-center gap-3">
        <p className="flex-1 text-xs text-gray-400">
          Modelo completo. Aplique-o para registar propostas e obter resultados.
        </p>
        <button
          className="ml-auto px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!ready}
          title={!ready ? 'Conclua escalas e ponderação consistentes antes de aplicar.' : undefined}
          onClick={() => dispatch({ type: 'START_EVALUATION', model })}
        >
          Aplicar este modelo →
        </button>
      </div>
    </div>
  );
}

function Chip({ ok, label, neutral }: { ok: boolean; label: string; neutral?: boolean }) {
  const cls = neutral ? 'bg-gray-100 text-gray-500' : ok ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700';
  return <span className={`px-2 py-1 rounded-full font-medium ${cls}`}>{neutral ? '•' : ok ? '✓' : '⋯'} {label}</span>;
}

function TypeBadge({ type }: { type: 'composite' | 'qualification' | 'gate' }) {
  const map = {
    composite: { label: 'fator', cls: 'bg-emerald-100 text-emerald-700' },
    qualification: { label: 'qualif.', cls: 'bg-indigo-100 text-indigo-700' },
    gate: { label: 'porta', cls: 'bg-orange-100 text-orange-700' },
  } as const;
  const t = map[type];
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${t.cls}`}>{t.label}</span>;
}
