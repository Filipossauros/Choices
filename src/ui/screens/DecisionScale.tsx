import { useEffect, useState } from 'react';
import { useApp } from '../store';
import { sortBands } from '../../domain/decision';
import { allGroupsConsistent } from '../../domain/tree';
import { scoreProfile } from '../../engine/aggregation';
import ScreenNav from '../components/ScreenNav';
import type { DecisionBand, QualificationCriterion } from '../../domain/types';
import { v4 as uuidv4 } from 'uuid';

type Mode = 'guided' | 'advanced';

export default function DecisionScale() {
  const { state, dispatch } = useApp();
  const model = state.model!;
  const bands = model.decisionScale;
  const sorted = sortBands(bands);
  const [mode, setMode] = useState<Mode>('guided');

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
  // profile's global MACBETH score. Converges after one pass.
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

  // In guided mode, once the model is ready (scales + weights consistent),
  // activate a reference profile on any band that still lacks one — so the
  // default guided experience shows the profile editor, not raw numbers.
  // Skipped when not ready (graceful fallback to numeric thresholds).
  useEffect(() => {
    if (mode !== 'guided' || !ready) return;
    if (bands.some((b) => !b.referenceProfile)) {
      update(bands.map((b) => (b.referenceProfile ? b : { ...b, referenceProfile: defaultProfile() })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ready]);

  function defaultProfile(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const c of qualCriteria) {
      const neutral = c.descriptor.levels[c.descriptor.neutralIndex] ?? c.descriptor.levels[c.descriptor.levels.length - 1];
      if (neutral) out[c.id] = neutral.id;
    }
    return out;
  }

  // Switching mode converts every band in bulk: guided enables reference
  // profiles (deriving cut-offs by MACBETH), advanced freezes the current
  // numeric cut-off and removes the profile so it can be typed by hand.
  function switchMode(next: Mode) {
    if (next === mode) return;
    if (next === 'advanced') {
      update(
        bands.map((b) => {
          const { referenceProfile: _drop, ...rest } = b;
          void _drop;
          return rest;
        }),
      );
    } else {
      update(bands.map((b) => (b.referenceProfile ? b : { ...b, referenceProfile: defaultProfile() })));
    }
    setMode(next);
  }

  function addBand() {
    update([
      ...bands,
      {
        id: uuidv4(),
        label: 'Nova zona de decisão',
        minScore: 50,
        color: '#6366f1',
        referenceProfile: mode === 'guided' ? defaultProfile() : undefined,
      },
    ]);
  }
  function removeBand(id: string) {
    update(bands.filter((b) => b.id !== id));
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
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-5">
      {/* ── Header ── */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-gray-800">Perfis de decisão</h2>
          {/* Mode toggle */}
          <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs">
            <button
              onClick={() => switchMode('guided')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${mode === 'guided' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Guiado
            </button>
            <button
              onClick={() => switchMode('advanced')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${mode === 'advanced' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Avançado
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed">
          A escala MACBETH mede <em>quão bom</em> é cada desempenho (V(p) ∈ [0, 100]). Sobre ela define-se uma{' '}
          <strong>política de decisão</strong>: zonas de atuação com nome (ex.: «Recomendado», «Com reservas»).
          {mode === 'guided' ? (
            <> No modo <strong>guiado</strong>, descreve uma alternativa de referência por critério e o limiar é calculado automaticamente.</>
          ) : (
            <> No modo <strong>avançado</strong>, indica diretamente o valor de corte V(p) de cada zona.</>
          )}
        </p>
      </div>

      {mode === 'guided' && !ready && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
          <span className="mt-0.5 shrink-0">⚠</span>
          <span>
            Para derivar os limiares por perfil é preciso ter as <strong>Escalas</strong> e a <strong>Ponderação</strong>{' '}
            concluídas e consistentes. Até lá, os perfis não produzem pontuação — ou use o modo <strong>Avançado</strong>.
          </span>
        </div>
      )}

      <div className="grid lg:grid-cols-[180px_1fr] gap-6">
        {/* ── Preview ladder ── */}
        <div className="hidden lg:flex gap-2 shrink-0">
          <div className="relative w-7" style={{ height: 320 }}>
            {[0, 25, 50, 75, 100].filter((t) => t >= bottom && t <= top).map((t) => (
              <span
                key={t}
                className="absolute right-0 text-[10px] text-gray-400 font-mono -translate-y-1/2"
                style={{ top: ((top - t) / span) * 320 }}
              >
                {t}
              </span>
            ))}
          </div>
          <div className="relative flex-1 rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 320 }}>
            {sorted.map((b, i) => {
              const upper = i === 0 ? top : sorted[i - 1].minScore;
              const hTop = ((top - upper) / span) * 320;
              const hBot = ((top - b.minScore) / span) * 320;
              return (
                <div
                  key={b.id}
                  className="absolute left-0 right-0 flex flex-col justify-center px-2.5 text-white"
                  style={{ top: hTop, height: Math.max(0, hBot - hTop), backgroundColor: b.color }}
                >
                  <span className="truncate text-sm font-semibold drop-shadow-sm leading-tight">{b.label}</span>
                  <span className="font-mono text-[11px] opacity-90">≥ {b.minScore.toFixed(1)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Band cards ── */}
        <div className="min-w-0 space-y-3">
          {sorted.map((b) => {
            const computed = b.referenceProfile ? scoreProfile(model, b.referenceProfile) : null;
            return (
              <div key={b.id} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                {/* Header strip */}
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100" style={{ backgroundColor: b.color + '12' }}>
                  <input
                    type="color"
                    value={b.color}
                    onChange={(e) => patchBand(b.id, { color: e.target.value })}
                    className="w-7 h-7 rounded cursor-pointer border border-gray-200 shrink-0 p-0"
                    title="Cor da zona"
                  />
                  <input
                    value={b.label}
                    onChange={(e) => patchBand(b.id, { label: e.target.value })}
                    className="flex-1 bg-transparent border-0 focus:ring-0 px-1 py-0.5 text-sm font-semibold text-gray-800 min-w-0"
                    placeholder="Nome da zona de decisão"
                  />
                  <span
                    className="shrink-0 px-2.5 py-1 rounded-full text-xs font-bold font-mono text-white"
                    style={{ backgroundColor: b.color }}
                    title="Valor de corte"
                  >
                    V(p) ≥ {b.minScore.toFixed(1)}
                  </span>
                  <button
                    onClick={() => removeBand(b.id)}
                    disabled={bands.length <= 1}
                    className="text-gray-300 hover:text-red-500 disabled:opacity-20 text-sm px-1 shrink-0"
                    aria-label="Remover zona"
                  >
                    ✕
                  </button>
                </div>

                {/* Body */}
                <div className="p-3">
                  {b.referenceProfile ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Perfil de referência — alternativa-limiar desta zona
                      </p>
                      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
                        {qualCriteria.map((c) => (
                          <label key={c.id} className="flex items-center gap-2 text-sm">
                            <span className="flex-1 truncate text-gray-600" title={c.label}>{c.label}</span>
                            <select
                              value={b.referenceProfile?.[c.id] ?? ''}
                              onChange={(e) => setProfileLevel(b.id, c.id, e.target.value)}
                              className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white max-w-[50%] focus:ring-1 focus:ring-blue-400"
                            >
                              <option value="">—</option>
                              {c.descriptor.levels.map((l) => (
                                <option key={l.id} value={l.id}>{l.label}</option>
                              ))}
                            </select>
                          </label>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 pt-2 mt-1 border-t border-gray-100">
                        <span className="text-xs text-gray-500">Limiar derivado por MACBETH:</span>
                        <span className="font-mono text-sm font-bold" style={{ color: b.color }}>
                          {computed != null ? `V(p) ≥ ${computed.toFixed(1)}` : '— (faltam escalas/pesos)'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-gray-500 whitespace-nowrap">Valor de corte — V(p) ≥</label>
                      <input
                        type="number"
                        value={b.minScore}
                        onChange={(e) => patchBand(b.id, { minScore: Number(e.target.value) })}
                        className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center font-mono focus:ring-1 focus:ring-blue-400"
                      />
                      <span className="text-xs text-gray-400">pontos</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <button
            onClick={addBand}
            className="w-full py-2.5 text-sm text-blue-600 hover:text-blue-800 border-2 border-dashed border-gray-200 hover:border-blue-300 rounded-xl transition-colors"
          >
            + Adicionar zona de decisão
          </button>
        </div>
      </div>

      <ScreenNav
        next="summary"
        nextLabel="Resumo"
        hint="Veja a síntese do modelo (fórmula, pesos) e exporte para JSON / IA."
        blockedBy={bands.length === 0 ? 'Defina pelo menos uma zona de decisão.' : undefined}
      />
    </div>
  );
}
