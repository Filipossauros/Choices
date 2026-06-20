import { useEffect } from 'react';
import { useApp } from '../store';
import { sortBands } from '../../domain/decision';
import { allGroupsConsistent } from '../../domain/tree';
import { scoreProfile } from '../../engine/aggregation';
import type { DecisionBand, QualificationCriterion } from '../../domain/types';
import { v4 as uuidv4 } from 'uuid';

export default function DecisionScale() {
  const { state, dispatch } = useApp();
  const model = state.model!;
  const bands = model.decisionScale;
  const sorted = sortBands(bands);

  const qualCriteria = Object.values(model.valueTree.criteria).filter(
    (c) => c.type === 'qualification',
  ) as QualificationCriterion[];

  const scalesReady = qualCriteria.every((c) => model.derivedScales.some((s) => s.criterionId === c.id && s.consistencyMargin > 0));
  const weightsReady = allGroupsConsistent(model);
  const ready = qualCriteria.length > 0 && scalesReady && weightsReady;

  function update(next: DecisionBand[]) {
    dispatch({ type: 'UPDATE_MODEL', patch: { decisionScale: next } });
  }
  function patchBand(id: string, patch: Partial<DecisionBand>) {
    update(bands.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  // Keep every profile-band's cut-off (minScore) in sync with its reference
  // profile's global MACBETH score. Converges after one pass (no infinite loop:
  // we only write when the recomputed score actually differs).
  useEffect(() => {
    let changed = false;
    const next = bands.map((b) => {
      if (!b.referenceProfile) return b;
      const s = scoreProfile(model, b.referenceProfile);
      if (s != null && s !== b.minScore) {
        changed = true;
        return { ...b, minScore: s };
      }
      return b;
    });
    if (changed) update(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.decisionScale, model.derivedScales, model.weights, model.subWeights]);

  function defaultProfile(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const c of qualCriteria) {
      const neutral = c.descriptor.levels[c.descriptor.neutralIndex] ?? c.descriptor.levels[c.descriptor.levels.length - 1];
      if (neutral) out[c.id] = neutral.id;
    }
    return out;
  }

  function addBand() {
    update([
      ...bands,
      {
        id: uuidv4(),
        label: 'Novo perfil de decisão',
        minScore: 50,
        color: '#6366f1',
        referenceProfile: ready ? defaultProfile() : undefined,
      },
    ]);
  }
  function removeBand(id: string) {
    update(bands.filter((b) => b.id !== id));
  }
  function enableProfile(id: string) {
    patchBand(id, { referenceProfile: defaultProfile() });
  }
  function disableProfile(id: string) {
    update(
      bands.map((b) => {
        if (b.id !== id) return b;
        const { referenceProfile: _drop, ...rest } = b;
        void _drop;
        return rest;
      }),
    );
  }
  function setProfileLevel(id: string, criterionId: string, levelId: string) {
    const band = bands.find((b) => b.id === id);
    if (!band) return;
    patchBand(id, { referenceProfile: { ...(band.referenceProfile ?? {}), [criterionId]: levelId } });
  }

  // Preview axis
  const top = Math.max(100, ...sorted.map((b) => b.minScore));
  const bottom = Math.min(0, ...sorted.map((b) => b.minScore));
  const span = top - bottom || 1;

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-gray-800">Perfis de decisão</h2>
        <p className="text-sm text-gray-500">
          A escala MACBETH mede <em>quão bom</em> é cada desempenho (V(p) ∈ [0, 100]). Sobre essa escala
          constrói-se uma <strong>política de decisão</strong>: zonas de atuação com nomes (ex.: «Nenhuma ação»,
          «Advertência», «Suspensão»).
        </p>
        <p className="text-sm text-gray-500">
          Em vez de inserir limiares arbitrários, defina <strong>perfis de referência</strong> — alternativas
          descritas pelo seu nível em cada critério. A aplicação calcula automaticamente a pontuação global
          (impacto agregado, não comparações parciais) de cada perfil e usa-a como limiar de corte.
        </p>
      </div>

      {!ready && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
          <span className="mt-0.5 shrink-0">⚠</span>
          <span>
            Para derivar os limiares por MACBETH é preciso ter as <strong>Escalas</strong> e a <strong>Ponderação</strong>
            concluídas (consistentes). Conclua esses passos primeiro; até lá os perfis não produzem pontuação.
          </span>
        </div>
      )}

      <div className="flex gap-6">
        {/* Preview */}
        <div className="flex gap-3 shrink-0">
          <div className="relative w-8" style={{ height: 300 }}>
            {[0, 25, 50, 75, 100].filter((t) => t >= bottom && t <= top).map((t) => (
              <span
                key={t}
                className="absolute right-0 text-[10px] text-gray-400 font-mono -translate-y-1/2"
                style={{ top: ((top - t) / span) * 300 }}
              >
                {t}
              </span>
            ))}
          </div>
          <div className="relative w-44 rounded-lg overflow-hidden border border-gray-200" style={{ height: 300 }}>
            {sorted.map((b, i) => {
              const upper = i === 0 ? top : sorted[i - 1].minScore;
              const hTop = ((top - upper) / span) * 300;
              const hBot = ((top - b.minScore) / span) * 300;
              return (
                <div
                  key={b.id}
                  className="absolute left-0 right-0 flex flex-col justify-center px-2 text-white"
                  style={{ top: hTop, height: Math.max(0, hBot - hTop), backgroundColor: b.color }}
                >
                  <span className="truncate text-sm font-medium drop-shadow-sm">{b.label}</span>
                  <span className="font-mono text-[11px] opacity-90">≥ {b.minScore.toFixed(1)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 min-w-0 space-y-3">
          {sorted.map((b) => {
            const computed = b.referenceProfile ? scoreProfile(model, b.referenceProfile) : null;
            return (
              <div key={b.id} className="border border-gray-200 rounded-xl bg-white p-3 space-y-3">
                {/* Header row */}
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={b.color}
                    onChange={(e) => patchBand(b.id, { color: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-200 shrink-0"
                    title="Cor"
                  />
                  <input
                    value={b.label}
                    onChange={(e) => patchBand(b.id, { label: e.target.value })}
                    className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm min-w-0"
                    placeholder="Nome da zona de decisão"
                  />
                  <button
                    onClick={() => removeBand(b.id)}
                    disabled={bands.length <= 1}
                    className="text-red-400 hover:text-red-600 disabled:opacity-20 text-sm px-1 shrink-0"
                    aria-label="Remover perfil"
                  >
                    ✕
                  </button>
                </div>

                {/* Reference profile */}
                {b.referenceProfile ? (
                  <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-600">Perfil de referência (limiar por MACBETH)</span>
                      <button onClick={() => disableProfile(b.id)} className="text-xs text-gray-400 hover:text-gray-600">
                        usar valor manual
                      </button>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {qualCriteria.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 text-xs">
                          <span className="flex-1 truncate text-gray-600" title={c.label}>{c.label}</span>
                          <select
                            value={b.referenceProfile?.[c.id] ?? ''}
                            onChange={(e) => setProfileLevel(b.id, c.id, e.target.value)}
                            className="border border-gray-200 rounded px-1.5 py-1 text-xs max-w-[55%]"
                          >
                            <option value="">—</option>
                            {c.descriptor.levels.map((l) => (
                              <option key={l.id} value={l.id}>{l.label}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                      <span className="text-xs text-gray-500">Limiar derivado:</span>
                      <span className="font-mono text-sm font-bold" style={{ color: b.color }}>
                        {computed != null ? `V(p) ≥ ${computed.toFixed(1)}` : '— (faltam escalas/pesos)'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-gray-500 whitespace-nowrap">V(p) ≥</label>
                    <input
                      type="number"
                      value={b.minScore}
                      onChange={(e) => patchBand(b.id, { minScore: Number(e.target.value) })}
                      className="w-24 border border-gray-200 rounded px-2 py-1 text-sm text-center font-mono"
                    />
                    <button
                      onClick={() => enableProfile(b.id)}
                      disabled={qualCriteria.length === 0}
                      className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-40"
                    >
                      + Definir por perfil de referência (MACBETH)
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={addBand} className="text-sm text-blue-600 hover:text-blue-800">+ Adicionar perfil de decisão</button>
        </div>
      </div>

      {/* Footer — apply the completed model */}
      <div className="mt-8 pt-4 border-t border-gray-100 flex items-center gap-3">
        <p className="flex-1 text-xs text-gray-400">
          O modelo está completo (critérios, escalas, pesos e perfis de decisão). Aplique-o para registar
          propostas e obter resultados.
        </p>
        <button
          className="ml-auto flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-green-700 text-white hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!ready || bands.length === 0}
          title={!ready ? 'Conclua escalas e ponderação consistentes antes de aplicar.' : undefined}
          onClick={() => dispatch({ type: 'START_EVALUATION', model })}
        >
          Aplicar este modelo →
        </button>
      </div>
    </div>
  );
}
