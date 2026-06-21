import { useState, useEffect } from 'react';
import { useApp, type Screen, type Mode } from '../store';
import { CREATE_SCREENS, APPLY_SCREENS } from '../store';
import { allGroupsConsistent } from '../../domain/tree';
import type { EvaluationModel, Evaluation } from '../../domain/types';
import { v4 as uuidv4 } from 'uuid';

// ── Dark-mode toggle ──────────────────────────────────────────────────────────
// Persists to localStorage and falls back to the OS preference. Applies/removes
// the `dark` class on <html>, which drives the overrides in index.css.
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

const LABELS: Record<Screen, string> = {
  home: 'Início',
  criteria: 'Critérios',
  decision: 'Perfis de decisão',
  scales: 'Escalas',
  weighting: 'Ponderação',
  summary: 'Resumo',
  analysis: 'Análise e avaliação',
  results: 'Resultados',
  sensitivity: 'Sensibilidade',
  report: 'Relatório',
};

type CompletionStatus = 'done' | 'partial' | 'none';

function createStatus(model: EvaluationModel, screen: Screen): CompletionStatus {
  const qual = Object.values(model.valueTree.criteria).filter((c) => c.type === 'qualification');
  switch (screen) {
    case 'criteria':
      return model.valueTree.root.children.length > 0 ? 'done' : 'none';
    case 'decision':
      return model.decisionScale.length > 0 ? 'done' : 'none';
    case 'scales': {
      if (qual.length === 0) return 'done';
      const consistent = model.derivedScales.filter(
        (s) => qual.some((c) => c.id === s.criterionId) && s.consistencyMargin > 0,
      ).length;
      if (consistent === 0) return 'none';
      return consistent === qual.length ? 'done' : 'partial';
    }
    case 'weighting':
      if (qual.length === 0) return 'done';
      if (!model.weights && !model.subWeights) return 'none';
      return allGroupsConsistent(model) ? 'done' : 'partial';
    case 'summary':
      return qual.length > 0 && allGroupsConsistent(model) ? 'done' : 'none';
    default:
      return 'none';
  }
}

function applyStatus(evaluation: Evaluation, screen: Screen): CompletionStatus {
  const model = evaluation.model;
  const qual = Object.values(model.valueTree.criteria).filter((c) => c.type === 'qualification');
  const criteriaCount = model.valueTree.root.children.length;
  switch (screen) {
    case 'analysis': {
      if (evaluation.options.length === 0) return 'none';
      const expected = evaluation.options.length * criteriaCount;
      return evaluation.performances.length >= expected ? 'done' : 'partial';
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

export default function ModelHeader() {
  const { state, dispatch } = useApp();
  const { currentScreen, mode, model, evaluation } = state;

  const screens: Screen[] = mode === 'create' ? CREATE_SCREENS : mode === 'apply' ? APPLY_SCREENS : [];
  const docLabel = mode === 'create' ? model?.label : evaluation?.label;
  const modeLabel: Record<Mode, string> = { create: 'Criação do modelo', apply: 'Aplicação do modelo' };

  function statusOf(screen: Screen): CompletionStatus {
    if (mode === 'create' && model) return createStatus(model, screen);
    if (mode === 'apply' && evaluation) return applyStatus(evaluation, screen);
    return 'none';
  }

  /** Edit the model behind this evaluation as a separate copy — never silently
   *  overwrite the library original, and the evaluation keeps its snapshot. */
  function editModelCopy() {
    if (!evaluation) return;
    const now = new Date().toISOString();
    const fork: EvaluationModel = {
      ...structuredClone(evaluation.model),
      id: uuidv4(),
      label: `${evaluation.model.label} (cópia)`,
      createdAt: now,
      updatedAt: now,
    };
    dispatch({ type: 'EDIT_MODEL', model: fork });
  }

  const statuses = screens.map(statusOf);
  const doneCount = statuses.filter((s) => s === 'done').length;
  const progress = screens.length ? doneCount / screens.length : 0;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="px-4 py-2.5 flex items-center gap-3">
        <button
          onClick={() => dispatch({ type: 'GO_HOME' })}
          className="text-blue-700 font-bold text-lg tracking-tight shrink-0"
        >
          Choices
        </button>
        {mode && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
            {modeLabel[mode]}
          </span>
        )}
        {docLabel && <span className="text-sm text-gray-500 truncate max-w-xs">{docLabel}</span>}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {mode === 'apply' && evaluation && (
            <button
              onClick={editModelCopy}
              className="shrink-0 text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              title="Cria uma cópia editável do modelo desta avaliação — não altera o original nem esta avaliação"
            >
              Editar modelo (cópia)
            </button>
          )}
          <DarkModeToggle />
        </div>
      </div>
      {mode && (
        <>
          <nav className="px-4 flex gap-1 overflow-x-auto items-center">
            {screens.map((screen, i) => {
              const status = statuses[i];
              const active = currentScreen === screen;
              const dotCls = active
                ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                : status === 'done'
                ? 'bg-green-500 text-white'
                : status === 'partial'
                ? 'bg-amber-400 text-white'
                : 'bg-gray-200 text-gray-500';
              return (
                <div key={screen} className="flex items-center shrink-0">
                  {i > 0 && <span className="w-5 h-px bg-gray-200 mx-0.5" aria-hidden="true" />}
                  <button
                    onClick={() => dispatch({ type: 'SET_SCREEN', screen })}
                    className={`px-2.5 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                      active ? 'text-blue-700 font-semibold' : status === 'done' ? 'text-gray-700 hover:text-gray-900' : 'text-gray-400 hover:text-gray-700'
                    }`}
                  >
                    <span className={`w-[18px] h-[18px] rounded-full shrink-0 grid place-items-center text-[10px] font-bold transition-all ${dotCls}`} aria-hidden="true">
                      {status === 'done' && !active ? '✓' : i + 1}
                    </span>
                    {LABELS[screen]}
                  </button>
                </div>
              );
            })}
          </nav>
          <div className="h-[3px] bg-gray-100">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-green-500 transition-all duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </>
      )}
    </header>
  );
}
