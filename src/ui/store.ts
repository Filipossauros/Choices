import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { createElement } from 'react';
import type { EvaluationModel, Evaluation } from '../domain/types';
import { MODEL_VERSION } from '../domain/types';
import { defaultDecisionScale } from '../domain/decision';
import { v4 as uuidv4 } from 'uuid';
import { repository } from '../repository';

export type Screen =
  | 'home'
  // criação do modelo
  | 'criteria'
  | 'decision'
  | 'scales'
  | 'weighting'
  // aplicação do modelo
  | 'analysis'
  | 'results'
  | 'sensitivity'
  | 'report';

export const CREATE_SCREENS: Screen[] = ['criteria', 'decision', 'scales', 'weighting'];
export const APPLY_SCREENS: Screen[] = ['analysis', 'results', 'sensitivity', 'report'];

export type Mode = 'create' | 'apply';

interface AppState {
  currentScreen: Screen;
  mode: Mode | null;
  model: EvaluationModel | null;
  evaluation: Evaluation | null;
}

type Action =
  | { type: 'GO_HOME' }
  | { type: 'SET_SCREEN'; screen: Screen }
  | { type: 'NEW_MODEL' }
  | { type: 'EDIT_MODEL'; model: EvaluationModel }
  | { type: 'UPDATE_MODEL'; patch: Partial<EvaluationModel> }
  | { type: 'START_EVALUATION'; model: EvaluationModel; label?: string }
  | { type: 'OPEN_EVALUATION'; evaluation: Evaluation }
  | { type: 'UPDATE_EVALUATION'; patch: Partial<Evaluation> };

export function createEmptyModel(): EvaluationModel {
  const now = new Date().toISOString();
  return {
    kind: 'model',
    id: uuidv4(),
    modelVersion: MODEL_VERSION,
    label: 'Novo Modelo de Avaliação',
    createdAt: now,
    updatedAt: now,
    valueTree: { root: { criterionId: 'root', children: [] }, criteria: {} },
    judgmentMatrices: [],
    derivedScales: [],
    decisionScale: defaultDecisionScale(),
  };
}

/** Begin applying a model to proposals — embeds a deep snapshot of the model. */
export function createEvaluation(model: EvaluationModel, label?: string): Evaluation {
  const now = new Date().toISOString();
  return {
    kind: 'evaluation',
    id: uuidv4(),
    modelVersion: MODEL_VERSION,
    label: label ?? `Avaliação — ${model.label}`,
    createdAt: now,
    updatedAt: now,
    model: structuredClone(model),
    options: [],
    performances: [],
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'GO_HOME':
      return { currentScreen: 'home', mode: null, model: null, evaluation: null };

    case 'SET_SCREEN':
      return { ...state, currentScreen: action.screen };

    case 'NEW_MODEL':
      return { currentScreen: 'criteria', mode: 'create', model: createEmptyModel(), evaluation: null };

    case 'EDIT_MODEL':
      return { currentScreen: 'criteria', mode: 'create', model: action.model, evaluation: null };

    case 'UPDATE_MODEL':
      if (!state.model) return state;
      return {
        ...state,
        model: { ...state.model, ...action.patch, updatedAt: new Date().toISOString() },
      };

    case 'START_EVALUATION':
      return {
        currentScreen: 'analysis',
        mode: 'apply',
        model: null,
        evaluation: createEvaluation(action.model, action.label),
      };

    case 'OPEN_EVALUATION':
      return { currentScreen: 'analysis', mode: 'apply', model: null, evaluation: action.evaluation };

    case 'UPDATE_EVALUATION':
      if (!state.evaluation) return state;
      return {
        ...state,
        evaluation: { ...state.evaluation, ...action.patch, updatedAt: new Date().toISOString() },
      };

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
    mode: null,
    model: null,
    evaluation: null,
  });

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const docRef = useRef<{ kind: 'model' | 'evaluation'; data: EvaluationModel | Evaluation } | null>(null);

  function persist(doc: { kind: 'model' | 'evaluation'; data: EvaluationModel | Evaluation }) {
    if (doc.kind === 'model') repository.saveModel(doc.data as EvaluationModel).catch(() => {});
    else repository.saveEvaluation(doc.data as Evaluation).catch(() => {});
  }

  // Auto-save the active document (model in create mode, evaluation in apply mode)
  useEffect(() => {
    const doc =
      state.mode === 'create' && state.model
        ? ({ kind: 'model', data: state.model } as const)
        : state.mode === 'apply' && state.evaluation
        ? ({ kind: 'evaluation', data: state.evaluation } as const)
        : null;
    docRef.current = doc;
    if (!doc) return;
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persist(doc);
      dirtyRef.current = false;
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state.mode, state.model, state.evaluation]);

  // Flush immediately when the tab is hidden or closed so no edit is lost
  useEffect(() => {
    function flush() {
      if (!dirtyRef.current || !docRef.current) return;
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      persist(docRef.current);
      dirtyRef.current = false;
    }
    function onVisibility() {
      if (document.visibilityState === 'hidden') flush();
    }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', flush);
    };
  }, []); // stable — reads refs only

  return createElement(AppContext.Provider, { value: { state, dispatch } }, children);
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
