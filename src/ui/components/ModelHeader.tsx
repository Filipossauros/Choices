import { useApp, type Screen } from '../store';
import type { MacbethModel } from '../../domain/types';

const NAV_ITEMS: { screen: Screen; label: string }[] = [
  { screen: 'structuring', label: 'Estruturação' },
  { screen: 'proposals', label: 'Propostas' },
  { screen: 'qualification', label: 'Habilitação' },
  { screen: 'scales', label: 'Escalas' },
  { screen: 'weighting', label: 'Ponderação' },
  { screen: 'results', label: 'Resultados' },
  { screen: 'sensitivity', label: 'Sensibilidade' },
  { screen: 'report', label: 'Relatório' },
];

type CompletionStatus = 'done' | 'partial' | 'none';

function completionStatus(model: MacbethModel, screen: Screen): CompletionStatus {
  const qualCriteria = Object.values(model.valueTree.criteria).filter(
    (c) => c.type === 'qualification',
  );
  const criteriaCount = model.valueTree.root.children.length;

  switch (screen) {
    case 'structuring':
      return criteriaCount > 0 ? 'done' : 'none';

    case 'proposals': {
      if (model.options.length === 0) return 'none';
      const expected = model.options.length * criteriaCount;
      return model.performances.length >= expected ? 'done' : 'partial';
    }

    case 'qualification':
      return model.options.length > 0 ? 'done' : 'none';

    case 'scales': {
      if (qualCriteria.length === 0) return 'done';
      const consistent = model.derivedScales.filter(
        (s) => qualCriteria.some((c) => c.id === s.criterionId) && s.consistencyMargin > 0,
      ).length;
      if (consistent === 0) return 'none';
      return consistent === qualCriteria.length ? 'done' : 'partial';
    }

    case 'weighting':
      if (qualCriteria.length === 0) return 'done';
      if (!model.weights) return 'none';
      return model.weights.consistencyMargin > 0 ? 'done' : 'partial';

    case 'results': {
      if (!model.aggregationResult) return 'none';
      const stale =
        (model.weights?.derivedAt != null &&
          model.weights.derivedAt > model.aggregationResult.computedAt) ||
        model.derivedScales.some((s) => s.derivedAt > model.aggregationResult!.computedAt);
      return stale ? 'partial' : 'done';
    }

    case 'sensitivity':
      return model.aggregationResult && model.weights && qualCriteria.length >= 2
        ? 'done'
        : 'none';

    case 'report':
      return model.aggregationResult ? 'done' : 'none';

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
  const { currentScreen, model } = state;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="px-4 py-2 flex items-center gap-4">
        <button
          onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'home' })}
          className="text-blue-700 font-bold text-lg tracking-tight shrink-0"
        >
          MACBETH
        </button>
        {model && (
          <span className="text-sm text-gray-500 truncate max-w-xs">{model.label}</span>
        )}
      </div>
      {model && (
        <nav className="px-4 flex gap-1 overflow-x-auto pb-1">
          {NAV_ITEMS.map(({ screen, label }) => {
            const status = completionStatus(model, screen);
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
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_CLASS[status]}`}
                  aria-hidden="true"
                />
                {label}
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
}
