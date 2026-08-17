import { useTranslation } from 'react-i18next';
import { useApp } from '../store';
import { allGroupsConsistent } from '../../domain/tree';
import { scoreProfile, resolveBands, bandOrderConflicts } from '../../engine/aggregation';
import ScreenNav from '../components/ScreenNav';
import type { DecisionBand, QualificationCriterion } from '../../domain/types';
import { v4 as uuidv4 } from 'uuid';

const H = 320; // preview ladder height

export default function DecisionScale() {
  const { t } = useTranslation();
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

  function levelResolves(criterionId: string, levelId: string): boolean {
    return model.derivedScales.some(
      (s) => s.criterionId === criterionId && s.values.some((v) => v.levelId === levelId),
    );
  }
  // Incomplete = a criterion without a level, or whose chosen level no longer
  // resolves in the derived scale (level deleted / scale re-derived). Either
  // way the cut-off falls back to the cached minScore instead of being derived.
  function profileIncomplete(b: DecisionBand): boolean {
    if (!b.referenceProfile) return true;
    return qualCriteria.some((c) => {
      const lv = b.referenceProfile![c.id];
      return !lv || !levelResolves(c.id, lv);
    });
  }
  function profileHasDeadLevel(b: DecisionBand): boolean {
    if (!b.referenceProfile) return false;
    return qualCriteria.some((c) => {
      const lv = b.referenceProfile![c.id];
      return !!lv && !levelResolves(c.id, lv);
    });
  }

  function addBand() {
    update([
      ...bands,
      { id: uuidv4(), label: t('Nova zona de decisão'), minScore: 50, color: '#6366f1' },
    ]);
  }
  function removeBand(id: string) {
    update(bands.filter((b) => b.id !== id));
  }

  // Switch a band to the manual override: drop the profile, keep the current
  // effective cut-off as the typed starting number, and mark it manual.
  function useManual(id: string) {
    update(
      bands.map((b) => {
        if (b.id !== id) return b;
        const eff = effOf(b.id);
        const { referenceProfile: _drop, ...rest } = b;
        void _drop;
        return { ...rest, minScore: eff, manualThreshold: true };
      }),
    );
  }
  // Switch (back) to the grounded path: clear the manual flag and start from an
  // empty reference alternative for the user to describe deliberately.
  function useProfile(id: string) {
    update(
      bands.map((b) => {
        if (b.id !== id) return b;
        const { referenceProfile: _drop, manualThreshold: _m, ...rest } = b;
        void _drop; void _m;
        return rest;
      }),
    );
  }
  function setProfileLevel(id: string, criterionId: string, levelId: string) {
    const band = bands.find((b) => b.id === id);
    if (!band) return;
    const profile = { ...(band.referenceProfile ?? {}), [criterionId]: levelId };
    const complete = qualCriteria.every((c) => profile[c.id]);
    const s = complete ? scoreProfile(model, profile) : null;
    patchBand(id, { referenceProfile: profile, manualThreshold: false, ...(s != null ? { minScore: s } : {}) });
  }

  // ── Validation ──────────────────────────────────────────────────────────
  const warnings: string[] = [];
  // Zones whose threshold is NOT grounded on a reference alternative.
  const ungrounded = bands.filter(
    (b) => b.id !== lowestId && (b.manualThreshold || !b.referenceProfile),
  );
  // Grounded but not yet fully described.
  const incomplete = bands.filter(
    (b) => b.id !== lowestId && b.referenceProfile && profileIncomplete(b),
  );
  // Colliding cut-offs among the non-base zones make a zone unreachable.
  const nonBase = decorated.filter((d) => d.band.id !== lowestId);
  for (let i = 1; i < nonBase.length; i++) {
    if (Math.abs(nonBase[i].eff - nonBase[i - 1].eff) < 0.05) {
      warnings.push(
        t('As zonas «{{a}}» e «{{b}}» têm o mesmo limiar ({{s}}) — uma fica inalcançável.', {
          a: nonBase[i - 1].band.label,
          b: nonBase[i].band.label,
          s: nonBase[i].eff.toFixed(1),
        }),
      );
    }
  }
  for (const b of incomplete) {
    if (profileHasDeadLevel(b)) {
      warnings.push(t('O perfil de «{{label}}» referencia um nível que já não existe — escolha novamente esse critério. Até lá, vale o último limiar calculado.', { label: b.label }));
    } else {
      warnings.push(t('O perfil de referência de «{{label}}» está incompleto — defina um nível em todos os critérios.', { label: b.label }));
    }
  }
  // Order inversions: a nominally higher zone whose profile now scores below a
  // lower zone's (scales/weights changed since the profiles were accepted).
  for (const { higher, lower } of bandOrderConflicts(model)) {
    warnings.push(
      t('A zona «{{a}}» devia cortar acima de «{{b}}», mas o seu perfil pontua agora abaixo ({{sa}} < {{sb}}) — reveja os perfis ou a ponderação.', {
        a: higher.label,
        b: lower.label,
        sa: higher.minScore.toFixed(1),
        sb: lower.minScore.toFixed(1),
      }),
    );
  }

  // Preview axis bounds — ignore the base zone's own cut-off (it's a catch-all
  // and may hold a sentinel like -999 that would otherwise crush the axis).
  const axisEffs = decorated.filter((d) => d.band.id !== lowestId).map((d) => d.eff);
  // Headroom above the highest threshold so a band cutting at 100 stays visible.
  const top = Math.max(100, ...axisEffs) + 4;
  const bottom = Math.min(0, ...axisEffs);
  const span = top - bottom || 1;

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-5">
      {/* ── Header ── */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-800">{t('Perfis de decisão')}</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          {t('A pontuação global V(p) ∈ [0, 100] (Neutro = 0, Bom = 100) diz quão boa é cada alternativa. Aqui define-se o que fazer com cada resultado: zonas com nome e ação (ex.: «Aceitar», «Rejeitar», «Aplicar sanção»), separadas por limiares de corte. Cada resultado cai na zona mais alta cujo limiar atinge.')}
        </p>
        <p className="text-xs text-gray-400 leading-relaxed">
          {t('Para que o limiar seja defensável (e não um número arbitrário), descreve-se uma alternativa-limiar de referência — o pior caso que ainda pertence à zona — e o MACBETH calcula o seu V(p). O corte fica assim ligado a uma situação concreta e rastreável. Os limiares são compensatórios; para mínimos rígidos por critério use o Veto ou uma condição eliminatória. O valor manual existe só como recurso provisório ou override assumido.')}
        </p>
      </div>

      {ungrounded.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-sm text-rose-800 flex items-start gap-2">
          <span className="mt-0.5 shrink-0">⚖️</span>
          <span>
            {ungrounded.length === 1 ? t('A zona') : t('As zonas')}{' '}
            <strong>{ungrounded.map((b) => `«${b.label}»`).join(', ')}</strong>{' '}
            {ungrounded.length === 1 ? t('tem limiar manual') : t('têm limiar manual')} {t('(não derivado de uma alternativa-limiar). Para uma decisão defensável, derive esses limiares a partir de um perfil de referência.')}
          </span>
        </div>
      )}

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

      {!ready && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800 flex items-start gap-2">
          <span className="mt-0.5 shrink-0">ℹ</span>
          <span>
            {t('As Escalas e a Ponderação ainda não estão concluídas e consistentes, por isso os limiares por perfil não podem ser calculados. Pode definir limiares provisórios a número e convertê-los depois.')}
          </span>
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
                  <span className="font-mono text-[11px] opacity-90">{isBase ? t('base') : `≥ ${eff.toFixed(1)}`}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Band cards ── */}
        <div className="min-w-0 space-y-3">
          {decorated.map(({ band: b, eff }) => {
            const isBase = b.id === lowestId;
            const grounded = !!b.referenceProfile;
            const manual = !grounded && b.manualThreshold === true;
            // Default path for a non-base zone when the model is ready: describe
            // a reference alternative. Manual only when explicitly chosen, or as
            // the provisional fallback while the model isn't ready.
            const showProfileEditor = !isBase && ready && !manual;
            const showManualInput = !isBase && (manual || !ready);
            return (
              <div key={b.id} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                {/* Header strip */}
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100" style={{ backgroundColor: b.color + '12' }}>
                  <input
                    type="color"
                    value={b.color}
                    onChange={(e) => patchBand(b.id, { color: e.target.value })}
                    className="w-7 h-7 rounded cursor-pointer border border-gray-200 shrink-0 p-0"
                    title={t('Cor da zona')}
                  />
                  <input
                    value={b.label}
                    onChange={(e) => patchBand(b.id, { label: e.target.value })}
                    className="flex-1 bg-transparent border-0 focus:ring-0 px-1 py-0.5 text-sm font-semibold text-gray-800 min-w-0"
                    placeholder={t('Nome da zona de decisão')}
                  />
                  {!isBase && grounded && !profileIncomplete(b) && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700" title={t('Limiar fundamentado por uma alternativa-limiar (rastreável)')}>
                      ● {t('Fundamentado')}
                    </span>
                  )}
                  {!isBase && (manual || (!ready)) && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700" title={t('Limiar definido à mão, não derivado de um perfil')}>
                      ● {manual ? t('manual') : t('provisório')}
                    </span>
                  )}
                  <span
                    className="shrink-0 px-2.5 py-1 rounded-full text-xs font-bold font-mono text-white"
                    style={{ backgroundColor: b.color }}
                    title={isBase ? t('Zona base — apanha tudo o que não atinge as zonas acima') : t('Limiar de corte')}
                  >
                    {isBase ? t('base') : `V(p) ≥ ${eff.toFixed(1)}`}
                  </span>
                  <button
                    onClick={() => removeBand(b.id)}
                    disabled={bands.length <= 1}
                    className="text-gray-300 hover:text-red-500 disabled:opacity-20 text-sm px-1 shrink-0"
                    aria-label={t('Remover zona')}
                  >
                    ✕
                  </button>
                </div>

                {/* Body */}
                <div className="p-3 space-y-3">
                  {/* Action */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 shrink-0">{t('Ação')}</span>
                    <input
                      value={b.action ?? ''}
                      onChange={(e) => patchBand(b.id, { action: e.target.value })}
                      placeholder={t('O que fazer nesta zona? (ex.: aceitar a proposta, aplicar sanção…)')}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:ring-1 focus:ring-blue-400"
                    />
                  </div>

                  {/* Cut-off */}
                  {isBase ? (
                    <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                      {t('Zona base — aplica-se a tudo o que não atinge nenhuma das zonas acima. Não tem limiar próprio.')}
                    </p>
                  ) : showProfileEditor ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {t('Alternativa-limiar de referência')}
                        </p>
                        <button
                          onClick={() => useManual(b.id)}
                          className="text-xs text-gray-400 hover:text-gray-700 underline"
                          title={t('Definir o limiar à mão (override assumido)')}
                        >
                          {t('usar valor manual')}
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-400 -mt-1">
                        {t('Descreva o pior caso que ainda pertence a esta zona; o limiar é o seu V(p).')}
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
                        <span className="text-xs text-gray-500">{t('Limiar derivado por MACBETH:')}</span>
                        <span className="font-mono text-sm font-bold" style={{ color: b.color }}>
                          {grounded && !profileIncomplete(b) ? `V(p) ≥ ${eff.toFixed(1)}` : t('— (descreva todos os critérios)')}
                        </span>
                      </div>
                    </div>
                  ) : showManualInput ? (
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="text-sm text-gray-500 whitespace-nowrap">{t('Limiar — V(p) ≥')}</label>
                      <input
                        type="number"
                        value={b.minScore}
                        onChange={(e) => patchBand(b.id, { minScore: Number(e.target.value), manualThreshold: true })}
                        className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center font-mono focus:ring-1 focus:ring-rose-300"
                      />
                      <span className="text-xs text-gray-400">{t('pontos')}</span>
                      {ready && (
                        <button
                          onClick={() => useProfile(b.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 underline ml-auto"
                          title={t('Definir o limiar descrevendo uma alternativa-limiar (defensável)')}
                        >
                          {t('derivar por alternativa-limiar')}
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}

          <button
            onClick={addBand}
            className="w-full py-2.5 text-sm text-blue-600 hover:text-blue-800 border-2 border-dashed border-gray-200 hover:border-blue-300 rounded-xl transition-colors"
          >
            {t('+ Adicionar zona de decisão')}
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
