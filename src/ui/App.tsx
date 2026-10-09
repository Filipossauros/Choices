import { useEffect, useRef } from 'react';
import { AppProvider, useApp } from './store';
import StepRail from './components/StepRail';
import { DialogProvider } from './components/Dialog';
import Home from './screens/Home';
import Criteria from './screens/Criteria';
import DecisionScale from './screens/DecisionScale';
import Scales from './screens/Scales';
import Weighting from './screens/Weighting';
import Robustness from './screens/Robustness';
import ModelSummary from './screens/ModelSummary';
import Analysis from './screens/Analysis';
import Results from './screens/Results';
import Sensitivity from './screens/Sensitivity';
import Report from './screens/Report';

function Router() {
  const { state } = useApp();
  const { currentScreen, mode } = state;

  /**
   * Changing step is changing page, so the page starts at the top.
   *
   * Without this the browser keeps the scroll offset across the swap: leaving a
   * long screen 540px down landed you 540px down the next one — below its title,
   * with nothing on screen saying where you now are. The heading also takes
   * focus, so the same move is announced to a screen reader and `Tab` resumes
   * from the top of the new step rather than from wherever the old one was.
   */
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const heading = main.current?.querySelector<HTMLElement>('h1, h2');
    if (!heading) return;
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }, [currentScreen, mode]);

  const inCreate = mode === 'create' && state.model != null;
  const inApply = mode === 'apply' && state.evaluation != null;
  const atHome = currentScreen === 'home' || (!inCreate && !inApply);

  return (
    <div className="min-h-screen flex flex-col">
      <StepRail />
      <main ref={main} className="flex-1">
        {/* Keyed on the screen so a step change remounts and plays the entrance:
            a new screen arriving with a short rise reads as *moving through* a
            sequence, where an instant swap reads as the page being replaced. */}
        <div key={currentScreen} className="step-enter">
          {atHome && <Home />}
          {!atHome && inCreate && currentScreen === 'criteria' && <Criteria />}
          {!atHome && inCreate && currentScreen === 'decision' && <DecisionScale />}
          {!atHome && inCreate && currentScreen === 'scales' && <Scales />}
          {!atHome && inCreate && currentScreen === 'weighting' && <Weighting />}
          {!atHome && inCreate && currentScreen === 'robustness' && <Robustness />}
          {!atHome && inCreate && currentScreen === 'summary' && <ModelSummary />}
          {!atHome && inApply && currentScreen === 'analysis' && <Analysis />}
          {!atHome && inApply && currentScreen === 'results' && <Results />}
          {!atHome && inApply && currentScreen === 'sensitivity' && <Sensitivity />}
          {!atHome && inApply && currentScreen === 'report' && <Report />}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <DialogProvider>
        <Router />
      </DialogProvider>
    </AppProvider>
  );
}
