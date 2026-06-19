import { AppProvider, useApp } from './store';
import ModelHeader from './components/ModelHeader';
import Home from './screens/Home';
import Criteria from './screens/Criteria';
import DecisionScale from './screens/DecisionScale';
import Scales from './screens/Scales';
import Weighting from './screens/Weighting';
import Analysis from './screens/Analysis';
import Results from './screens/Results';
import Sensitivity from './screens/Sensitivity';
import Report from './screens/Report';

function Router() {
  const { state } = useApp();
  const { currentScreen, mode } = state;

  const inCreate = mode === 'create' && state.model != null;
  const inApply = mode === 'apply' && state.evaluation != null;
  const atHome = currentScreen === 'home' || (!inCreate && !inApply);

  return (
    <div className="min-h-screen flex flex-col">
      <ModelHeader />
      <main className="flex-1">
        {atHome && <Home />}
        {!atHome && inCreate && currentScreen === 'criteria' && <Criteria />}
        {!atHome && inCreate && currentScreen === 'decision' && <DecisionScale />}
        {!atHome && inCreate && currentScreen === 'scales' && <Scales />}
        {!atHome && inCreate && currentScreen === 'weighting' && <Weighting />}
        {!atHome && inApply && currentScreen === 'analysis' && <Analysis />}
        {!atHome && inApply && currentScreen === 'results' && <Results />}
        {!atHome && inApply && currentScreen === 'sensitivity' && <Sensitivity />}
        {!atHome && inApply && currentScreen === 'report' && <Report />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
