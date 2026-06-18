import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
} from 'react';
import { createElement } from 'react';
import type { MacbethModel } from '../domain/types';
import { MODEL_VERSION, DEFAULT_ASSESSOR_ID } from '../domain/types';
import { v4 as uuidv4 } from 'uuid';

export type Screen =
  | 'home'
  | 'structuring'
  | 'proposals'
  | 'qualification'
  | 'scales'
  | 'weighting'
  | 'results'
  | 'sensitivity'
  | 'report';

interface AppState {
  currentScreen: Screen;
  model: MacbethModel | null;
}

type Action =
  | { type: 'SET_SCREEN'; screen: Screen }
  | { type: 'SET_MODEL'; model: MacbethModel }
  | { type: 'UPDATE_MODEL'; patch: Partial<MacbethModel> }
  | { type: 'NEW_MODEL' };

export function createEmptyModel(): MacbethModel {
  return {
    id: uuidv4(),
    modelVersion: MODEL_VERSION,
    label: 'Novo Modelo de Avaliação',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    valueTree: {
      root: { criterionId: 'root', children: [] },
      criteria: {},
    },
    options: [],
    performances: [],
    judgmentMatrices: [],
    derivedScales: [],
    approvedThreshold: 70,
    conditionalThreshold: 40,
  };
}

// Suppress TS warning — DEFAULT_ASSESSOR_ID used at runtime when creating matrices
void DEFAULT_ASSESSOR_ID;

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_SCREEN':
      return { ...state, currentScreen: action.screen };
    case 'SET_MODEL':
      return { ...state, model: action.model };
    case 'UPDATE_MODEL':
      if (!state.model) return state;
      return {
        ...state,
        model: {
          ...state.model,
          ...action.patch,
          updatedAt: new Date().toISOString(),
        },
      };
    case 'NEW_MODEL':
      return { ...state, model: createEmptyModel(), currentScreen: 'structuring' };
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    currentScreen: 'home',
    model: null,
  });
  return createElement(
    AppContext.Provider,
    { value: { state, dispatch } },
    children,
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
