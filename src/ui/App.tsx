import { AppProvider, useApp } from './store';
import ModelHeader from './components/ModelHeader';
import Home from './screens/Home';
import Structuring from './screens/Structuring';
import Proposals from './screens/Proposals';
import Qualification from './screens/Qualification';
import Scales from './screens/Scales';
import Weighting from './screens/Weighting';
import Results from './screens/Results';
import Sensitivity from './screens/Sensitivity';
import Report from './screens/Report';

function Router() {
  const { state } = useApp();
  const { currentScreen, model } = state;

  return (
    <div className="min-h-screen flex flex-col">
      <ModelHeader />
      <main className="flex-1">
        {currentScreen === 'home' && <Home />}
        {model && currentScreen === 'structuring' && <Structuring />}
        {model && currentScreen === 'proposals' && <Proposals />}
        {model && currentScreen === 'qualification' && <Qualification />}
        {model && currentScreen === 'scales' && <Scales />}
        {model && currentScreen === 'weighting' && <Weighting />}
        {model && currentScreen === 'results' && <Results />}
        {model && currentScreen === 'sensitivity' && <Sensitivity />}
        {model && currentScreen === 'report' && <Report />}
        {model && !['structuring','proposals','qualification','scales','weighting','results','sensitivity','report'].includes(currentScreen) && (
          <Home />
        )}
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
