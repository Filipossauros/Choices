import { useApp, type Screen, type Mode } from '../store';
import { CREATE_SCREENS, APPLY_SCREENS } from '../store';
import type { EvaluationModel, Evaluation } from '../../domain/types';

const LABELS: Record<Screen, string> = {
  home: 'Início',
  criteria: 'Critérios',
  decision: 'Perfis de decisão',
  scales: 'Escalas',
  weighting: 'Ponderação',
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
      if (!model.weights) return 'none';
      return model.weights.consistencyMargin > 0 ? 'done' : 'partial';
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
      return evaluation.aggregationResult && model.weights && qual.length >= 2 ? 'done' : 'none';
    case 'report':
      return evaluation.aggregationResult ? 'done' : 'none';
    default:
      return 'none';
  }
}

const DOT_CLASS: Record<CompletionStatus, string> = {
  done: 'bg-green-500',
  partial: 'bg-amber-400',
  none: 'bg-gray-300',
};

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

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="px-4 py-2 flex items-center gap-4">
        <button
          onClick={() => dispatch({ type: 'GO_HOME' })}
          className="text-blue-700 font-bold text-lg tracking-tight shrink-0"
        >
          Choices
        </button>
        {mode && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
            {modeLabel[mode]}
          </span>
        )}
        {docLabel && <span className="text-sm text-gray-500 truncate max-w-xs">{docLabel}</span>}
      </div>
      {mode && (
        <nav className="px-4 flex gap-1 overflow-x-auto pb-1">
          {screens.map((screen) => {
            const status = statusOf(screen);
            return (
              <button
                key={screen}
                onClick={() => dispatch({ type: 'SET_SCREEN', screen })}
                className={`shrink-0 px-3 py-1 text-sm rounded-t border-b-2 transition-colors flex items-center gap-1.5 ${
                  currentScreen === screen
                    ? 'border-blue-600 text-blue-700 font-medium'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_CLASS[status]}`} aria-hidden="true" />
                {LABELS[screen]}
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
}
