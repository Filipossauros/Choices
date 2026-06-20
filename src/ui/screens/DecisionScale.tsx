import { useApp } from '../store';
import { allGroupsConsistent } from '../../domain/tree';
import { scoreProfile, resolveBands } from '../../engine/aggregation';
import ScreenNav from '../components/ScreenNav';
import type { DecisionBand, QualificationCriterion } from '../../domain/types';
import { v4 as uuidv4 } from 'uuid';

const H = 320; // preview ladder height

export default function DecisionScale() {
  const { state, dispatch } = useApp();
  const model = state.model!;
  const bands = model.decisionScale;

  const qualCriteria = Object.values(model.valueTree.criteria).filter(
    (c) => c.type === 'qualification',
  ) as QualificationCriterion[];

  const scalesReady = qualCriteria.every((c) => model.derivedScales.some((s) => s.criterionId === c.id && s.consistencyMargin > 0));
  const weightsReady = allGroupsConsistent(model);
  const ready = qualCriteria.length > 0 && scalesReady && weightsReady;

  // Effective cut-offs (profiles resolved live; never written back on view).
  const resolved = resolveBands(model);
  const effOf = (id: string) => resolved.find((b) => b.id === id)?.minScore ?? 0;
  const decorated = bands
    .map((b) => ({ band: b, eff: effOf(b.id) }))
    .sort((a, b) => b.eff - a.eff);
  const lowestId = decorated.length ? decorated[decorated.length - 1].band.id : null;

  function update(next: DecisionBand[]) {
    dispatch({ type: 'UPDATE_MODEL', patch: { decisionScale: next } });
  }
  function patchBand(id: string, patch: Partial<DecisionBand>) {
    update(bands.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function profileIncomplete(b: DecisionBand): boolean {
    if (!b.referenceProfile) return false;
    return qualCriteria.some((c) => !b.referenceProfile![c.id]);
  }

  /** A near-uniform profile whose global V(p) is close to `target`. */
  function seedProfileNear(target: number): Record<string, string> {
    const out: Record<string, string> = {};
    for (const c of qualCriteria) {
      const scale = model.derivedScales.find((s) => s.criterionId === c.id);
      if (!scale || scale.values.length === 0) {
        const neutral = c.descriptor.levels[c.descriptor.neutralIndex];
        if (neutral) out[c.id] = neutral.id;
        continue;
      }
      let best = scale.values[0];
      let bestD = Infinity;
      for (const v of scale.values) {
        const d = Math.abs(v.value - target);
        if (d < bestD) { bestD = d; best = v; }
      }
      out[c.id] = best.levelId;
    }
    return out;
  }

  function addBand() {
    update([
      ...bands,
      { id: uuidv4(), label: 'Nova zona de decisão', minScore: 50, color: '#6366f1' },
    ]);
  }
  function removeBand(id: string) {
    update(bands.filter((b) => b.id !== id));
  }

  function activateProfile(id: string) {
    const band = bands.find((b) => b.id === id);
    if (!band) return;
    const profile = seedProfileNear(band.minScore);
    const s = scoreProfile(model, profile);
    patchBand(id, { referenceProfile: profile, minScore: s ?? band.minScore });
  }
  function deactivateProfile(id: string) {
    update(
      bands.map((b) => {
        if (b.id !== id) return b;
        const eff = effOf(b.id);
        const { referenceProfile: _drop, ...rest } = b;
        void _drop;
        return { ...rest, minScore: eff };
      }),
    );
  }
  function setProfileLevel(id: string, criterionId: string, levelId: string) {
    const band = bands.find((b) => b.id === id);
    if (!band) return;
    const profile = { ...(band.referenceProfile ?? {}), [criterionId]: levelId };
    const s = scoreProfile(model, profile);
    patchBand(id, { referenceProfile: profile, minScore: s ?? band.minScore });
  }

  // ── Validation ──────────────────────────────────────────────────────────
  const warnings: string[] = [];
  // Colliding cut-offs among the non-base zones make a zone unreachable.
  const nonBase = decorated.filter((d) => d.band.id !== lowestId);
  for (let i = 1; i < nonBase.length; i++) {
    if (Math.abs(nonBase[i].eff - nonBase[i - 1].eff) < 0.05) {
      warnings.push(
        `As zonas «${nonBase[i - 1].band.label}» e «${nonBase[i].band.label}» têm o mesmo limiar (${nonBase[i].eff.toFixed(1)}) — uma fica inalcançável.`,
      );
    }
  }
  for (const b of bands) {
    if (profileIncomplete(b)) {
      warnings.push(`O perfil de referência de «${b.label}» está incompleto — defina um nível em todos os critérios.`);
    }
  }

  // Preview axis bounds — ignore the base zone's own cut-off (it's a catch-all
  // and may hold a sentinel like -999 that would otherwise crush the axis).
  const axisEffs = decorated.filter((d) => d.band.id !== lowestId).map((d) => d.eff);
  const top = Math.max(100, ...axisEffs);
  const bottom = Math.min(0, ...axisEffs);
  const span = top - bottom || 1;

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-5">
      {/* ── Header ── */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-800">Perfis de decisão</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          A pontuação global V(p) ∈ [0, 100] (Neutro = 0, Bom = 100) diz <em>quão boa</em> é cada alternativa.
          Aqui define-se o que <strong>fazer</strong> com cada resultado: zonas com nome e <strong>ação</strong>
          {' '}(ex.: «Aceitar», «Rejeitar», «Aplicar sanção»), separadas por <strong>limiares</strong> de corte.
          Cada resultado cai na zona mais alta cujo limiar atinge.
        </p>
        <p className="text-xs text-gray-400 leading-relaxed">
          Os limiares são <strong>compensatórios</strong>: uma fraqueza num critério pode ser compensada por força
          noutro. Para mínimos rígidos por critério (que reprovam só por si) use o <strong>Veto</strong> ou uma{' '}
          <strong>Porta</strong> nos Critérios. Escreva o limiar a número ou, em alternativa, deixe que ele seja
          derivado por MACBETH a partir de uma alternativa-limiar de referência.
        </p>
      </div>

      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800 space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">⚠</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-[180px_1fr] gap-6">
        {/* ── Preview ladder ── */}
        <div className="hidden lg:flex gap-2 shrink-0">
          <div className="relative w-7" style={{ height: H }}>
            {[0, 25, 50, 75, 100].filter((t) => t >= bottom && t <= top).map((t) => (
              <span
                key={t}
                className="absolute right-0 text-[10px] text-gray-400 font-mono -translate-y-1/2"
                style={{ top: ((top - t) / span) * H }}
              >
                {t}
              </span>
            ))}
          </div>
          <div className="relative flex-1 rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: H }}>
            {decorated.map(({ band: b, eff }, i) => {
              const isBase = b.id === lowestId;
              const upper = i === 0 ? top : decorated[i - 1].eff;
              const lower = isBase ? bottom : eff;
              const hTop = ((top - upper) / span) * H;
              const hBot = ((top - lower) / span) * H;
              return (
                <div
                  key={b.id}
                  className="absolute left-0 right-0 flex flex-col justify-center px-2.5 text-white"
                  style={{ top: hTop, height: Math.max(0, hBot - hTop), backgroundColor: b.color }}
                >
                  <span className="truncate text-sm font-semibold drop-shadow-sm leading-tight">{b.label}</span>
                  <span className="font-mono text-[11px] opacity-90">{isBase ? 'base' : `≥ ${eff.toFixed(1)}`}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Band cards ── */}
        <div className="min-w-0 space-y-3">
          {decorated.map(({ band: b, eff }) => {
            const isBase = b.id === lowestId;
            const hasProfile = !!b.referenceProfile;
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
                    title={isBase ? 'Zona base — apanha tudo o que não atinge as zonas acima' : 'Limiar de corte'}
                  >
                    {isBase ? 'base' : `V(p) ≥ ${eff.toFixed(1)}`}
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
                <div className="p-3 space-y-3">
                  {/* Action */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 shrink-0">Ação</span>
                    <input
                      value={b.action ?? ''}
                      onChange={(e) => patchBand(b.id, { action: e.target.value })}
                      placeholder="O que fazer nesta zona? (ex.: aceitar a proposta, aplicar sanção…)"
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:ring-1 focus:ring-blue-400"
                    />
                  </div>

                  {/* Cut-off */}
                  {isBase ? (
                    <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                      Zona <strong>base</strong> — aplica-se a tudo o que não atinge nenhuma das zonas acima. Não tem
                      limiar próprio.
                    </p>
                  ) : hasProfile ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Alternativa-limiar de referência
                        </p>
                        <button
                          onClick={() => deactivateProfile(b.id)}
                          className="text-xs text-gray-400 hover:text-gray-700 underline"
                        >
                          definir a número
                        </button>
                      </div>
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
                          {ready && !profileIncomplete(b) ? `V(p) ≥ ${eff.toFixed(1)}` : '— (faltam escalas/pesos)'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="text-sm text-gray-500 whitespace-nowrap">Limiar — V(p) ≥</label>
                      <input
                        type="number"
                        value={b.minScore}
                        onChange={(e) => patchBand(b.id, { minScore: Number(e.target.value) })}
                        className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center font-mono focus:ring-1 focus:ring-blue-400"
                      />
                      <span className="text-xs text-gray-400">pontos</span>
                      {ready && (
                        <button
                          onClick={() => activateProfile(b.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 underline ml-auto"
                          title="Descrever uma alternativa-limiar e deixar o MACBETH calcular o corte"
                        >
                          derivar por perfil de referência
                        </button>
                      )}
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
