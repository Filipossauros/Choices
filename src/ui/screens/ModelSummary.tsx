import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../store';
import { repository } from '../../repository';
import { buildModelSpec, downloadJson } from '../../domain/modelSpec';
import { allGroupsConsistent } from '../../domain/tree';
import { displayBands, bandRangeLabel } from '../../domain/decision';
import { resolveBands } from '../../engine/aggregation';

export default function ModelSummary() {
  const { t } = useTranslation();
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

  const resolvedScale = resolveBands(model);
  const bandViews = displayBands(resolvedScale);

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-gray-800">{t('Resumo do modelo')}</h2>
          <p className="text-sm text-gray-500 max-w-xl">
            {t('Síntese completa do critério: estrutura, fórmula de agregação e fatores de ponderação. Exporte como JSON para alimentar agentes de IA (ex.: correr diagnósticos sobre o modelo).')}
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button onClick={exportSpecJson} className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
            ↓ {t('Exportar especificação (JSON · IA)')}
          </button>
          <button onClick={exportModelJson} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">
            ↓ {t('Exportar modelo (JSON)')}
          </button>
        </div>
      </div>

      {/* Readiness diagnostics */}
      <div className="flex flex-wrap gap-2 text-xs">
        <Chip ok={spec.diagnostics.leafCount > 0} label={t('{{n}} critério(s) de qualificação', { n: spec.diagnostics.leafCount })} />
        <Chip ok={spec.diagnostics.factorCount >= 0} label={t('{{n}} fator(es) composto(s)', { n: spec.diagnostics.factorCount })} neutral />
        <Chip ok={spec.diagnostics.scalesDerived} label={t('Escalas derivadas')} />
        <Chip ok={spec.diagnostics.weightsComplete} label={t('Pesos completos')} />
      </div>

      {/* Aggregation formula */}
      <section className="border border-gray-200 rounded-xl p-5 bg-white space-y-3">
        <h3 className="font-semibold text-gray-800">{t('Fórmula de agregação')}</h3>
        <p className="font-mono text-sm bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-gray-800">
          {spec.formula.global}
        </p>
        {spec.formula.perGroup.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('Expansão por grupo')}</p>
            {spec.formula.perGroup.map((f) => (
              <p key={f.target} className="font-mono text-sm text-gray-700">
                <span className="text-indigo-600 font-semibold">{f.target}</span> = {f.expression}
              </p>
            ))}
          </div>
        )}
        <ul className="text-xs text-gray-500 list-disc pl-5 space-y-0.5">
          {spec.formula.notes.map((n, i) => <li key={i}>{t(n)}</li>)}
        </ul>
      </section>

      {/* Global criteria table */}
      <section className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <h3 className="font-semibold text-gray-800 px-5 pt-4">{t('Tabela global de critérios')}</h3>
        <div className="overflow-x-auto p-4">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="px-3 py-2 text-left border border-gray-200">{t('Critério')}</th>
                <th className="px-3 py-2 text-left border border-gray-200">{t('Tipo')}</th>
                <th className="px-3 py-2 text-left border border-gray-200">{t('Grupo (pai)')}</th>
                <th className="px-3 py-2 text-left border border-gray-200">{t('Níveis (Bom→Neutro)')}</th>
                <th className="px-3 py-2 text-right border border-gray-200">{t('Peso efetivo')}</th>
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
                    {c.parent === 'root' ? t('— (topo)') : spec.criteria.find((x) => x.id === c.parent)?.label ?? c.parent}
                  </td>
                  <td className="px-3 py-2 border border-gray-200 text-gray-600 text-xs">
                    {c.levels ? c.levels.map((l) => l.label + (l.anchor ? ` (${l.anchor === 'good' ? t('Bom') : t('Neutro')})` : '')).join(' › ') : '—'}
                    {c.veto && <span className="text-orange-600"> · {t('veto: «{{v}}»', { v: c.veto })}</span>}
                    {c.continuous && <span className="text-blue-600"> {t('· contínuo')}</span>}
                  </td>
                  <td className="px-3 py-2 border border-gray-200 text-right font-mono">
                    {c.effectiveWeight != null ? `${(c.effectiveWeight * 100).toFixed(1)}%` : c.type === 'composite' ? t('∑ filhos') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Weighting factors table */}
      <section className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <h3 className="font-semibold text-gray-800 px-5 pt-4">{t('Fatores de ponderação (por grupo)')}</h3>
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
      <section className="border border-gray-200 rounded-xl p-5 bg-white space-y-3">
        <h3 className="font-semibold text-gray-800">{t('Perfis de decisão')}</h3>
        <div className="space-y-1.5">
          {bandViews.map((v) => {
            const b = v.band;
            const grounded = !!b.referenceProfile;
            const refText = grounded
              ? Object.entries(b.referenceProfile!)
                  .map(([cid, lid]) => {
                    const c = model.valueTree.criteria[cid];
                    const lvl = c?.type === 'qualification' ? c.descriptor.levels.find((l) => l.id === lid) : undefined;
                    return lvl ? `${c?.label}: ${lvl.label}` : null;
                  })
                  .filter(Boolean)
                  .join(' · ')
              : null;
            return (
              <div key={b.id} className="flex items-start gap-2.5 text-sm">
                <span className="w-3 h-3 rounded shrink-0 mt-1" style={{ backgroundColor: b.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-800">{b.label}</span>
                    <span className="font-mono text-xs text-gray-500">{bandRangeLabel(b, resolvedScale)}</span>
                    {b.action && <span className="text-xs text-gray-400">· {b.action}</span>}
                    {!v.isBase && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${grounded ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'}`}>
                        {grounded ? t('fundamentado') : t('manual')}
                      </span>
                    )}
                  </div>
                  {refText && <p className="text-xs text-gray-400 mt-0.5">{t('Alternativa-limiar — {{ref}}', { ref: refText })}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Apply */}
      <div className="mt-8 pt-4 border-t border-gray-100 flex items-center gap-3">
        <p className="flex-1 text-xs text-gray-400">
          {t('Modelo completo. Aplique-o para registar propostas e obter resultados.')}
        </p>
        <button
          className="ml-auto px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!ready}
          title={!ready ? t('Conclua escalas e ponderação consistentes antes de aplicar.') : undefined}
          onClick={() => dispatch({ type: 'START_EVALUATION', model })}
        >
          {t('Aplicar este modelo →')}
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
  const { t } = useTranslation();
  const map = {
    composite: { label: 'fator', cls: 'bg-emerald-100 text-emerald-700' },
    qualification: { label: 'qualif.', cls: 'bg-indigo-100 text-indigo-700' },
    gate: { label: 'porta', cls: 'bg-orange-100 text-orange-700' },
  } as const;
  const badge = map[type];
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badge.cls}`}>{t(badge.label)}</span>;
}
