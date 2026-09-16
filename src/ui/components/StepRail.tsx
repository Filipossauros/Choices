/**
 * The navigation rail.
 *
 * Replaces a horizontal stepper that had room for a tick and a word. A vertical
 * rail has room for the thing that actually helps — what is left to do in each
 * step — so "Ponderação" becomes "Ponderação · 4 de 9 comparações" and the user
 * can see where the work is without opening every screen to find out.
 *
 * Below `lg` it collapses back to the horizontal strip, which is the right shape
 * for a narrow viewport: a 232px rail beside a phone-width column leaves nothing
 * for the column.
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useApp, type Screen, type Mode } from '../store';
import { CREATE_SCREENS, APPLY_SCREENS } from '../store';
import {
  allGroupsConsistent, modelReadiness, weightingGroups, weightsForGroup, modelRobustness,
} from '../../domain/tree';
import { sortBands } from '../../domain/decision';
import type { EvaluationModel, Evaluation } from '../../domain/types';
import { setLang, type Lang } from '../../i18n';
import { v4 as uuidv4 } from 'uuid';

/** The translate function as the detail helpers below use it. */
type TFn = TFunction<'translation', undefined>;

// ── Toggles ───────────────────────────────────────────────────────────────────

function LanguageToggle() {
  const { t, i18n } = useTranslation();
  const cur = (i18n.language?.startsWith('en') ? 'en' : 'pt') as Lang;
  const next: Lang = cur === 'pt' ? 'en' : 'pt';
  return (
    <button
      onClick={() => setLang(next)}
      title={next === 'en' ? t('Mudar para inglês') : t('Mudar para português')}
      aria-label={t('Idioma')}
      className="shrink-0 h-8 px-2 grid place-items-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors text-xs font-bold tracking-wide"
    >
      {cur.toUpperCase()}
    </button>
  );
}

// Persists to localStorage and falls back to the OS preference. Applies/removes
// the `dark` class on <html>, which is what swaps the palette variables.
function DarkModeToggle() {
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('choices-dark');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('choices-dark', String(dark));
  }, [dark]);

  return (
    <button
      onClick={() => setDark((d) => !d)}
      title={dark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
      aria-label={dark ? 'Modo claro' : 'Modo escuro'}
      className="shrink-0 w-8 h-8 grid place-items-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
    >
      {dark ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="4" />
          <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  );
}

// ── Step labels and status ────────────────────────────────────────────────────

const LABELS: Record<Screen, string> = {
  home: 'Início',
  criteria: 'Estrutura',
  decision: 'Perfis de decisão',
  scales: 'Escalas',
  weighting: 'Ponderação',
  robustness: 'Robustez',
  summary: 'Resumo',
  analysis: 'Propostas',
  results: 'Resultados',
  sensitivity: 'Sensibilidade',
  report: 'Relatório',
};

export type CompletionStatus = 'done' | 'partial' | 'none';

/** Weights taken from a shortcut and not yet signed off — not finished. */
function hasUnconfirmedWeights(model: EvaluationModel): boolean {
  return weightingGroups(model)
    .filter((g) => g.childIds.length > 1)
    .some((g) => {
      const w = weightsForGroup(model, g.parentId);
      return !!w && w.provenance != null && w.provenance !== 'elicited' && !w.confirmed;
    });
}

/**
 * What each step's tick actually means.
 *
 * Several of these used to be vacuously true. An empty model showed Ponderação
 * and Escalas already ticked, because "every qualification criterion has a
 * consistent scale" holds when there are none; Resumo went green as soon as
 * weights existed, before any scale did. A progress indicator that is wrong once
 * stops being read, so each status below reports only what has been done.
 */
export function createStatus(model: EvaluationModel, screen: Screen): CompletionStatus {
  const qual = Object.values(model.valueTree.criteria).filter((c) => c.type === 'qualification');
  const readiness = modelReadiness(model);
  const unconfirmed = hasUnconfirmedWeights(model);

  switch (screen) {
    case 'criteria':
      return model.valueTree.root.children.length > 0 ? 'done' : 'none';
    case 'decision': {
      if (model.decisionScale.length === 0) return 'none';
      // A cut-off typed rather than derived from a reference profile is
      // provisional — the screen says so, so the step must not read as finished.
      // The lowest band is the catch-all and has no profile of its own.
      const needProfile = sortBands(model.decisionScale).slice(0, -1);
      if (needProfile.length === 0) return 'done';
      const grounded = needProfile.filter((b) => b.referenceProfile && !b.manualThreshold);
      return grounded.length === needProfile.length ? 'done' : 'partial';
    }
    case 'scales': {
      if (qual.length === 0) return 'none';
      const consistent = model.derivedScales.filter(
        (s) => qual.some((c) => c.id === s.criterionId) && s.consistencyMargin > 0,
      ).length;
      if (consistent === 0) return 'none';
      return consistent === qual.length ? 'done' : 'partial';
    }
    case 'weighting':
      if (qual.length === 0) return 'none';
      if (!model.weights && !model.subWeights) return 'none';
      if (!allGroupsConsistent(model)) return 'partial';
      return unconfirmed ? 'partial' : 'done';
    case 'robustness':
      return readiness.ready ? 'done' : readiness.scalesReady || readiness.weightsReady ? 'partial' : 'none';
    case 'summary':
      if (!readiness.ready) return 'none';
      return unconfirmed || createStatus(model, 'decision') !== 'done' ? 'partial' : 'done';
    default:
      return 'none';
  }
}

/** Unscored qualification criteria per option — what blocks a result. */
function unscoredCount(evaluation: Evaluation): number {
  const quals = Object.values(evaluation.model.valueTree.criteria).filter((c) => c.type === 'qualification');
  return evaluation.options.filter((o) =>
    quals.some((c) => {
      const p = evaluation.performances.find((x) => x.optionId === o.id && x.criterionId === c.id);
      return !p || (!p.value && p.position == null);
    }),
  ).length;
}

export function applyStatus(evaluation: Evaluation, screen: Screen): CompletionStatus {
  const model = evaluation.model;
  const qual = Object.values(model.valueTree.criteria).filter((c) => c.type === 'qualification');
  switch (screen) {
    case 'analysis': {
      if (evaluation.options.length === 0) return 'none';
      if (unscoredCount(evaluation) > 0) return 'partial';
      // Complete performances still cannot be aggregated while the embedded
      // model is unfinished — "done" there sends the user to an empty Results.
      return modelReadiness(model).ready ? 'done' : 'partial';
    }
    case 'results': {
      const r = evaluation.aggregationResult;
      if (!r) return 'none';
      const stale =
        evaluation.options.length !== r.optionResults.length ||
        evaluation.options.some((o) => o.createdAt > r.computedAt);
      return stale ? 'partial' : 'done';
    }
    case 'sensitivity':
      return evaluation.aggregationResult && allGroupsConsistent(model) && qual.length >= 2 ? 'done' : 'none';
    case 'report':
      return evaluation.aggregationResult ? 'done' : 'none';
    default:
      return 'none';
  }
}

/**
 * The second line under each step: what remains, in the step's own terms. This
 * is the whole reason for a vertical rail — a horizontal strip has no room for
 * it, so the user had to open every screen to find out where the work was.
 */
function createDetail(model: EvaluationModel, screen: Screen, t: TFn): string {
  const crits = Object.values(model.valueTree.criteria);
  const qual = crits.filter((c) => c.type === 'qualification');
  switch (screen) {
    case 'criteria': {
      if (crits.length === 0) return t('por definir');
      const factors = crits.filter((c) => c.type === 'composite').length;
      const gates = crits.filter((c) => c.type === 'gate').length;
      return [
        factors > 0 ? t('{{n}} fator(es)', { n: factors }) : null,
        t('{{n}} critério(s)', { n: qual.length }),
        gates > 0 ? t('{{n}} eliminatória(s)', { n: gates }) : null,
      ].filter(Boolean).join(' · ');
    }
    case 'weighting': {
      const groups = weightingGroups(model).filter((g) => g.childIds.length > 1);
      if (groups.length === 0) return qual.length > 0 ? t('nada a ponderar') : '';
      let answered = 0;
      let total = 0;
      for (const g of groups) {
        const items = g.childIds.length + 1; // children plus the all-neutral ref
        total += (items * (items - 1)) / 2;
        const m = model.judgmentMatrices.find((x) => x.kind === 'weighting' && (x.criterionId ?? 'root') === g.parentId);
        answered += Object.keys(m?.judgments ?? {}).length;
      }
      if (answered < total) return t('{{a}} de {{n}} comparações', { a: answered, n: total });
      return hasUnconfirmedWeights(model) ? t('por confirmar') : t('coerente · {{n}} grupo(s)', { n: groups.length });
    }
    case 'scales': {
      if (qual.length === 0) return '';
      const ok = model.derivedScales.filter(
        (s) => qual.some((c) => c.id === s.criterionId) && s.consistencyMargin > 0,
      ).length;
      const broken = model.derivedScales.filter(
        (s) => qual.some((c) => c.id === s.criterionId) && s.consistencyMargin <= 0,
      ).length;
      if (broken > 0) return t('{{n}} com contradição', { n: broken });
      return t('{{a}} de {{n}} derivadas', { a: ok, n: qual.length });
    }
    case 'decision': {
      const bands = model.decisionScale;
      if (bands.length === 0) return t('por definir');
      const needProfile = sortBands(bands).slice(0, -1);
      const grounded = needProfile.filter((b) => b.referenceProfile && !b.manualThreshold).length;
      return t('{{n}} zonas · {{g}} fundamentadas', { n: bands.length, g: grounded });
    }
    case 'robustness': {
      const r = modelReadiness(model);
      if (!r.scalesReady && !r.weightsReady) return t('precisa de escalas e pesos');
      return t('{{p}}% determinado', { p: Math.round(modelRobustness(model).determination * 100) });
    }
    case 'summary': {
      const r = modelReadiness(model);
      if (!r.ready) return t('modelo incompleto');
      return hasUnconfirmedWeights(model) ? t('pesos por confirmar') : t('pronto a aplicar');
    }
    default:
      return '';
  }
}

function applyDetail(evaluation: Evaluation, screen: Screen, t: TFn): string {
  switch (screen) {
    case 'analysis': {
      const n = evaluation.options.length;
      if (n === 0) return t('nenhuma registada');
      const missing = unscoredCount(evaluation);
      return missing > 0
        ? t('{{n}} registadas · {{m}} incompleta(s)', { n, m: missing })
        : t('{{n}} registadas · completas', { n });
    }
    case 'results': {
      const r = evaluation.aggregationResult;
      if (!r) return t('por calcular');
      const ranked = r.optionResults.filter((x) => !x.hardRejected && x.globalValue != null);
      if (ranked.length === 0) return t('nada pontuável');
      const top = ranked.sort((a, b) => b.globalValue! - a.globalValue!)[0];
      return t('1.º: {{label}}', {
        label: evaluation.options.find((o) => o.id === top.optionId)?.label ?? '',
      });
    }
    case 'sensitivity':
      return evaluation.aggregationResult ? '' : t('precisa de resultados');
    case 'report':
      return evaluation.aggregationResult ? t('PDF · CSV · JSON') : t('precisa de resultados');
    default:
      return '';
  }
}

/** "guardado há 4 s" — the autosave is real, so it is worth saying so. */
function savedAgo(iso: string, t: TFn): string {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return t('guardado há {{n}} s', { n: secs });
  const mins = Math.round(secs / 60);
  if (mins < 60) return t('guardado há {{n}} min', { n: mins });
  return t('guardado às {{time}}', { time: new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) });
}

// ── The rail ──────────────────────────────────────────────────────────────────

export default function StepRail() {
  const { t } = useTranslation();
  const { state, dispatch } = useApp();
  const { currentScreen, mode, model, evaluation } = state;

  // Re-render the "saved" line on a slow tick so it stays honest without
  // pulling the whole tree through a state update on every keystroke.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const screens: Screen[] = mode === 'create' ? CREATE_SCREENS : mode === 'apply' ? APPLY_SCREENS : [];
  const docLabel = mode === 'create' ? model?.label : evaluation?.label;
  const updatedAt = mode === 'create' ? model?.updatedAt : evaluation?.updatedAt;
  const modeLabel: Record<Mode, string> = { create: 'Modelo', apply: 'Avaliação' };

  function statusOf(screen: Screen): CompletionStatus {
    if (mode === 'create' && model) return createStatus(model, screen);
    if (mode === 'apply' && evaluation) return applyStatus(evaluation, screen);
    return 'none';
  }
  function detailOf(screen: Screen): string {
    if (mode === 'create' && model) return createDetail(model, screen, t);
    if (mode === 'apply' && evaluation) return applyDetail(evaluation, screen, t);
    return '';
  }

  /** Edit the model behind this evaluation as a separate copy — never silently
   *  overwrite the library original, and the evaluation keeps its snapshot. */
  function editModelCopy() {
    if (!evaluation) return;
    const now = new Date().toISOString();
    dispatch({
      type: 'EDIT_MODEL',
      model: {
        ...structuredClone(evaluation.model),
        id: uuidv4(),
        label: `${evaluation.model.label} (cópia)`,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  const badgeFor = (status: CompletionStatus, active: boolean) =>
    active
      ? 'bg-accent text-white'
      : status === 'done'
      ? 'bg-green-100 text-green-700'
      : status === 'partial'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-gray-100 text-gray-400';

  const home = (
    <button
      onClick={() => dispatch({ type: 'GO_HOME' })}
      className="text-indigo-700 font-bold text-lg tracking-tight shrink-0 hover:opacity-80 transition-opacity"
    >
      Choices
    </button>
  );

  if (!mode) {
    // Home: no steps to show, so the chrome is a thin bar.
    return (
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 px-4 py-2.5 flex items-center gap-3">
        {home}
        <div className="ml-auto flex items-center gap-2">
          <LanguageToggle />
          <DarkModeToggle />
        </div>
      </header>
    );
  }

  const steps = screens.map((screen, i) => ({
    screen,
    i,
    status: statusOf(screen),
    detail: detailOf(screen),
    active: currentScreen === screen,
  }));

  return (
    <>
      {/* ── Vertical rail (lg and up) ── */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[232px] flex-col bg-white border-r border-gray-200 px-3.5 py-4 z-20">
        <div className="px-2 pb-3.5">{home}</div>
        <div className="px-2 pb-3.5 mb-2 border-b border-gray-200 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-gray-400">
            {t(modeLabel[mode])}
          </p>
          <p className="text-[13px] font-semibold text-gray-800 truncate mt-0.5" title={docLabel}>
            {docLabel}
          </p>
          {updatedAt && <p className="text-[11px] text-gray-400 mt-0.5">{savedAgo(updatedAt, t)} · {t('local')}</p>}
        </div>

        <nav className="flex flex-col gap-0.5">
          {steps.map(({ screen, i, status, detail, active }) => (
            <button
              key={screen}
              onClick={() => dispatch({ type: 'SET_SCREEN', screen })}
              aria-current={active ? 'step' : undefined}
              className={`flex items-start gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors ${
                active
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : status === 'none'
                  ? 'text-gray-400 hover:bg-gray-50'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span
                className={`w-[22px] h-[22px] rounded-lg shrink-0 grid place-items-center text-[11px] font-bold mt-px transition-colors ${badgeFor(status, active)}`}
                aria-hidden="true"
              >
                {status === 'done' && !active ? '✓' : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] leading-tight">{t(LABELS[screen])}</span>
                {detail && (
                  <span className="block text-[11px] font-normal text-gray-400 mt-0.5 leading-tight">
                    {detail}
                  </span>
                )}
              </span>
            </button>
          ))}
        </nav>

        <div className="flex-1" />
        {mode === 'apply' && evaluation && (
          <button
            onClick={editModelCopy}
            className="mb-2 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-left"
            title={t('Cria uma cópia editável do modelo desta avaliação — não altera o original nem esta avaliação')}
          >
            {t('Editar modelo (cópia)')}
          </button>
        )}
        <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
          <LanguageToggle />
          <DarkModeToggle />
        </div>
      </aside>

      {/* ── Horizontal strip (below lg) ── */}
      <header className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="px-4 py-2.5 flex items-center gap-3">
          {home}
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
            {t(modeLabel[mode])}
          </span>
          {docLabel && <span className="text-sm text-gray-500 truncate">{docLabel}</span>}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <LanguageToggle />
            <DarkModeToggle />
          </div>
        </div>
        <nav className="px-4 flex gap-1 overflow-x-auto items-stretch">
          {steps.map(({ screen, i, status, active }) => (
            <div key={screen} className="flex items-stretch shrink-0">
              {i > 0 && (
                <span
                  className={`self-center w-5 h-px mx-0.5 ${status === 'done' ? 'bg-green-300' : 'bg-gray-200'}`}
                  aria-hidden="true"
                />
              )}
              <div className="flex flex-col">
                <button
                  onClick={() => dispatch({ type: 'SET_SCREEN', screen })}
                  aria-current={active ? 'step' : undefined}
                  className={`px-2.5 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                    active ? 'text-indigo-700 font-semibold' : status === 'none' ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  <span
                    className={`w-[18px] h-[18px] rounded-full shrink-0 grid place-items-center text-[10px] font-bold ${badgeFor(status, active)}`}
                    aria-hidden="true"
                  >
                    {status === 'done' && !active ? '✓' : i + 1}
                  </span>
                  {t(LABELS[screen])}
                </button>
                <span
                  className={`h-[3px] rounded-full mx-1 mb-1 transition-colors duration-500 ${
                    active ? 'bg-accent' : status === 'done' ? 'bg-green-500' : status === 'partial' ? 'bg-amber-400' : 'bg-gray-200'
                  }`}
                  aria-hidden="true"
                />
              </div>
            </div>
          ))}
        </nav>
      </header>
    </>
  );
}
