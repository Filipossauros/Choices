import { AppProvider, useApp, type Screen } from './store';
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

const MODEL_SCREENS: Screen[] = [
  'structuring',
  'proposals',
  'qualification',
  'scales',
  'weighting',
  'results',
  'sensitivity',
  'report',
];

function Router() {
  const { state } = useApp();
  const { currentScreen, model } = state;

  // A model screen renders only when there is a model AND the current screen is
  // one of them; everything else (home, or an unknown screen) falls back to Home.
  // This single either/or guard prevents Home from rendering twice.
  const showModelScreen = model != null && MODEL_SCREENS.includes(currentScreen);

  return (
    <div className="min-h-screen flex flex-col">
      <ModelHeader />
      <main className="flex-1">
        {!showModelScreen && <Home />}
        {showModelScreen && currentScreen === 'structuring' && <Structuring />}
        {showModelScreen && currentScreen === 'proposals' && <Proposals />}
        {showModelScreen && currentScreen === 'qualification' && <Qualification />}
        {showModelScreen && currentScreen === 'scales' && <Scales />}
        {showModelScreen && currentScreen === 'weighting' && <Weighting />}
        {showModelScreen && currentScreen === 'results' && <Results />}
        {showModelScreen && currentScreen === 'sensitivity' && <Sensitivity />}
        {showModelScreen && currentScreen === 'report' && <Report />}
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
