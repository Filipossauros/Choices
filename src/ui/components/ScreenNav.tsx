import { useTranslation } from 'react-i18next';
import { useApp, createScreens, APPLY_SCREENS, CREATE_SCREENS, SCREEN_LABELS, type Screen } from '../store';

interface Props {
  next: Screen;
  nextLabel: string;
  /** Shown on the left as a soft hint. */
  hint?: string;
  /** Disable the button and show this tooltip instead of navigating. */
  blockedBy?: string;
}

/**
 * Bottom-of-screen navigation strip that guides users to the next step.
 * Rendered at the end of each workflow screen (not Home, not Report).
 */
export default function ScreenNav({ next, nextLabel, hint, blockedBy }: Props) {
  const { t } = useTranslation();
  const { state, dispatch } = useApp();

  // Simple mode drops a step from the create flow, so "next" can name a screen
  // that is not in it. Walk forward to the first one that is, rather than making
  // every caller know which steps the current reader sees.
  const flow = state.mode === 'apply' ? APPLY_SCREENS : createScreens(state.uiMode);
  const target = flow.includes(next)
    ? next
    : CREATE_SCREENS.slice(CREATE_SCREENS.indexOf(next) + 1).find((s) => flow.includes(s)) ?? next;
  const label = target === next ? nextLabel : SCREEN_LABELS[target];

  return (
    <div className="mt-8 pt-4 border-t border-gray-100 flex items-center gap-3">
      {hint && <p className="flex-1 text-xs text-gray-400">{t(hint)}</p>}
      <button
        className="ml-auto flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors
          bg-accent text-white hover:bg-accent-strong
          disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={!!blockedBy}
        title={blockedBy ? t(blockedBy) : undefined}
        onClick={() => dispatch({ type: 'SET_SCREEN', screen: target })}
      >
        {t('Próximo:')} {t(label)}
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}
