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
  | 'robustness'
  | 'summary'
  // aplicação do modelo
  | 'analysis'
  | 'results'
  | 'sensitivity'
  | 'report';

/**
 * Weighting comes before scales: swing weighting only needs each criterion's
 * Neutro and Bom levels (fixed in Estrutura), never the derived scales, so
 * asking "what matters most?" — the question people answer immediately — can
 * precede the long per-criterion elicitation.
 *
 * Robustez closes the model phase: it reads the LPs' admissible ranges to show
 * how much freedom the judgments left, which needs no proposals at all. The
 * ranking-flip analysis stays in the apply flow, where alternatives exist.
 */
export const CREATE_SCREENS: Screen[] = ['criteria', 'weighting', 'scales', 'decision', 'robustness', 'summary'];
export const APPLY_SCREENS: Screen[] = ['analysis', 'results', 'sensitivity', 'report'];

/**
 * The create flow as a given reader sees it. Robustez reads the LPs' admissible
 * ranges — it answers "how much did my answers leave undecided?", which is a
 * question about the model's construction rather than about the decision, so it
 * is a step only in technical mode. The screen itself still exists and the
 * report still carries its numbers.
 */
export function createScreens(uiMode: UiMode): Screen[] {
  return uiMode === 'technical' ? CREATE_SCREENS : CREATE_SCREENS.filter((s) => s !== 'robustness');
}

/** The name of each screen, as the rail and the navigation strip print it. */
export const SCREEN_LABELS: Record<Screen, string> = {
  home: 'Início',
  criteria: 'Estrutura',
  decision: 'Zonas de decisão',
  scales: 'Níveis e valores',
  weighting: 'Importância',
  robustness: 'O que ficou em aberto',
  summary: 'Resumo',
  analysis: 'Propostas',
  results: 'Resultados',
  sensitivity: 'E se mudar de ideias?',
  report: 'Relatório',
};

export type Mode = 'create' | 'apply';

/**
 * How much of the method the interface shows.
 *
 * `simple` is the default because the app is meant to be usable by whoever has
 * to make the decision, not only by someone who already knows MACBETH. It hides
 * the surfaces that exist to *audit* a model — the judgment matrix, the
 * admissible ranges, the consistency margin, the direct-input shortcuts — none
 * of which are removed from the model or from the report; they are simply not
 * what a first-time user needs in front of them while answering questions.
 *
 * `technical` restores all of it. The choice is per-browser, not per-model: it
 * describes the person, not the document.
 */
export type UiMode = 'simple' | 'technical';

const UI_MODE_KEY = 'choices-ui-mode';

function initialUiMode(): UiMode {
  try {
    return localStorage.getItem(UI_MODE_KEY) === 'technical' ? 'technical' : 'simple';
  } catch {
    return 'simple';
  }
}

interface AppState {
  currentScreen: Screen;
  mode: Mode | null;
  uiMode: UiMode;
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
  | { type: 'REFRESH_EVALUATION_MODEL'; model: EvaluationModel }
  | { type: 'UPDATE_EVALUATION'; patch: Partial<Evaluation> }
  | { type: 'SET_UI_MODE'; uiMode: UiMode };

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
    case 'SET_UI_MODE': {
      // Simple mode drops a step. Switching to it while standing on that step
      // would leave the screen rendered with nothing in the rail pointing at it.
      const flow = createScreens(action.uiMode);
      const stranded = state.mode === 'create' && !flow.includes(state.currentScreen);
      return {
        ...state,
        uiMode: action.uiMode,
        currentScreen: stranded ? 'summary' : state.currentScreen,
      };
    }

    case 'GO_HOME':
      return { ...state, currentScreen: 'home', mode: null, model: null, evaluation: null };

    case 'SET_SCREEN':
      return { ...state, currentScreen: action.screen };

    case 'NEW_MODEL':
      return { ...state, currentScreen: 'criteria', mode: 'create', model: createEmptyModel(), evaluation: null };

    case 'EDIT_MODEL':
      return { ...state, currentScreen: 'criteria', mode: 'create', model: action.model, evaluation: null };

    case 'UPDATE_MODEL':
      if (!state.model) return state;
      return {
        ...state,
        model: { ...state.model, ...action.patch, updatedAt: new Date().toISOString() },
      };

    case 'START_EVALUATION':
      return {
        ...state,
        currentScreen: 'analysis',
        mode: 'apply',
        model: null,
        evaluation: createEvaluation(action.model, action.label),
      };

    case 'OPEN_EVALUATION':
      return { ...state, currentScreen: 'analysis', mode: 'apply', model: null, evaluation: action.evaluation };

    /**
     * Replace the evaluation's embedded model snapshot with a newer version of
     * the same model, keeping every performance that still resolves against it.
     * Without this an evaluation started from an unfinished model could never
     * be aggregated — the only way out was to discard it and re-enter the data.
     */
    case 'REFRESH_EVALUATION_MODEL': {
      if (!state.evaluation) return state;
      const model = structuredClone(action.model);
      const { criteria } = model.valueTree;
      const performances = state.evaluation.performances.filter((p) => {
        const crit = criteria[p.criterionId];
        if (!crit) return false;
        if (crit.type === 'gate') return true;
        if (crit.type !== 'qualification') return false;
        // Continuous scores are positions on the curve, so they survive a
        // relabelled descriptor; discrete ones must still name a live level.
        return p.position != null || crit.descriptor.levels.some((l) => l.id === p.value);
      });
      return {
        ...state,
        evaluation: {
          ...state.evaluation,
          model,
          performances,
          aggregationResult: undefined,
          updatedAt: new Date().toISOString(),
        },
      };
    }

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
    uiMode: initialUiMode(),
    model: null,
    evaluation: null,
  });

  useEffect(() => {
    try {
      localStorage.setItem(UI_MODE_KEY, state.uiMode);
    } catch {
      /* private mode, blocked storage — the session still works, it just forgets */
    }
  }, [state.uiMode]);

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
