import { useApp, type Screen } from '../store';

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
          {NAV_ITEMS.map(({ screen, label }) => (
            <button
              key={screen}
              onClick={() => dispatch({ type: 'SET_SCREEN', screen })}
              className={`shrink-0 px-3 py-1 text-sm rounded-t border-b-2 transition-colors ${
                currentScreen === screen
                  ? 'border-blue-600 text-blue-700 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}
