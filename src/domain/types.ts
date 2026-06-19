// ─── Enums & primitives ────────────────────────────────────────────────────

export type CriterionType = 'gate' | 'qualification';

/** MACBETH attractiveness-difference categories C0..C6 */
export type MacbethCategory = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Composite/interval judgment: "weak to moderate" = { lo: 2, hi: 3 } */
export type MacbethJudgment =
  | { kind: 'exact'; category: MacbethCategory }
  | { kind: 'interval'; lo: MacbethCategory; hi: MacbethCategory };

export type GateVerdict = 'pass' | 'fail' | 'pending';

// ─── Descriptor / Performance levels ───────────────────────────────────────

export interface PerformanceLevel {
  id: string;
  label: string;
  description?: string;
  numericValue?: number;
}

export interface Descriptor {
  /** Ordered from most to least attractive (index 0 = best) */
  levels: PerformanceLevel[];
  /** Index into levels[] for the "Neutral" anchor (value = 0) */
  neutralIndex: number;
  /** Index into levels[] for the "Good" anchor (value = 100) */
  goodIndex: number;
}

// ─── Criterion ─────────────────────────────────────────────────────────────

export interface BaseCriterion {
  id: string;
  label: string;
  description?: string;
  weight?: number;
  parentId?: string;
}

export interface GateCriterion extends BaseCriterion {
  type: 'gate';
}

export interface QualificationCriterion extends BaseCriterion {
  type: 'qualification';
  descriptor: Descriptor;
  /** Level id below which the proposal is vetoed regardless of aggregate */
  vetoLevelId?: string;
  /**
   * When true, proposals score on a continuous position along the descriptor
   * (read from the smooth value curve) instead of picking a single level.
   */
  continuous?: boolean;
}

export type Criterion = GateCriterion | QualificationCriterion;

// ─── Value tree ────────────────────────────────────────────────────────────

export interface ValueTreeNode {
  criterionId: string;
  children: ValueTreeNode[];
}

export interface ValueTree {
  root: ValueTreeNode;
  criteria: Record<string, Criterion>;
}

// ─── Option (proposal) ─────────────────────────────────────────────────────

export interface Option {
  id: string;
  label: string;
  description?: string;
  createdAt: string;
}

// ─── Performance matrix ────────────────────────────────────────────────────

export interface Performance {
  optionId: string;
  criterionId: string;
  /** gate: 'pass'|'fail'; qualification (discrete): a level id from the descriptor */
  value: string;
  /**
   * Qualification (continuous): normalized position on the descriptor in [0,1],
   * where 0 = least attractive level and 1 = most attractive level. When set,
   * the score is read from the smooth value curve at this position.
   */
  position?: number;
}

// ─── Judgment matrices ─────────────────────────────────────────────────────

/**
 * Stores judgments for ONE criterion scale matrix or the weighting matrix.
 * MULTI-ASSESSOR EXTENSION POINT: assessorId is 'assessor-default' in MVP.
 */
export interface JudgmentMatrix {
  id: string;
  /** 'scale' = per-criterion value matrix; 'weighting' = swing-weight matrix */
  kind: 'scale' | 'weighting';
  criterionId?: string;
  assessorId: string;
  /**
   * Sparse upper-triangular map: key = `${idA}__${idB}` (A more attractive).
   * For weighting: key = `${criterionIdA}__${criterionIdB}`.
   */
  judgments: Record<string, MacbethJudgment>;
  updatedAt: string;
}

// ─── Derived scale ─────────────────────────────────────────────────────────

export interface ScaleValue {
  levelId: string;
  value: number;
  admissibleRange: [number, number];
}

export interface DerivedScale {
  criterionId: string;
  values: ScaleValue[];
  consistencyMargin: number;
  derivedAt: string;
}

// ─── Weights ───────────────────────────────────────────────────────────────

export interface CriterionWeight {
  criterionId: string;
  weight: number; // [0,1], Σ = 1
  admissibleRange: [number, number];
}

export interface Weights {
  weights: CriterionWeight[];
  consistencyMargin: number;
  derivedAt: string;
}

// ─── Decision scale ────────────────────────────────────────────────────────

/**
 * A named decision band over the global value V(p). Bands partition the score
 * axis: a proposal falls in the highest band whose `minScore` it reaches.
 * Replaces the old fixed approved/conditional thresholds with N named outcomes.
 */
export interface DecisionBand {
  id: string;
  label: string;
  /** Inclusive lower bound of the band on the V(p) axis. */
  minScore: number;
  /** Hex colour for charts and badges. */
  color: string;
  /**
   * Optional MACBETH reference profile that *defines* this band's lower cut-off:
   * a reference alternative described by a performance level per qualification
   * criterion (`criterionId -> levelId`). When set, `minScore` is the global
   * value V(p) of this reference alternative under the model's scales + weights —
   * i.e. the cut-off is derived from MACBETH (global impact) rather than typed.
   */
  referenceProfile?: Record<string, string>;
}

// ─── Gate results ──────────────────────────────────────────────────────────

export interface GateResult {
  criterionId: string;
  optionId: string;
  verdict: GateVerdict;
}

// ─── Aggregation result ────────────────────────────────────────────────────

export interface OptionResult {
  optionId: string;
  globalValue: number | null;
  /** Id of the matched decision band (null when hard-rejected or unscored). */
  bandId: string | null;
  /** Rejected by a failed gate or a veto — bypasses the decision scale. */
  hardRejected: boolean;
  gateResults: GateResult[];
  criterionScores: Record<string, number | null>;
  vetoedByCriterion?: string;
  rejectedByGate?: string;
}

export interface AggregationResult {
  optionResults: OptionResult[];
  /** Snapshot of the decision scale used to classify these results. */
  decisionScale: DecisionBand[];
  computedAt: string;
}

// ─── Sensitivity ───────────────────────────────────────────────────────────

export interface SensitivityPoint {
  weightValue: number;
  optionValues: Record<string, number>;
}

export interface SensitivityScenario {
  variedCriterionId: string;
  points: SensitivityPoint[];
  rankingChangePoints: number[];
}

// ─── Inconsistency report ─────────────────────────────────────────────────

export interface InconsistentPair {
  idA: string;
  idB: string;
  currentJudgment: MacbethJudgment;
  suggestedJudgment: MacbethJudgment;
}

export interface ConsistencyReport {
  isConsistent: boolean;
  consistencyMargin: number;
  inconsistentPairs: InconsistentPair[];
}

// ─── Top-level entities ──────────────────────────────────────────────────────

export const MODEL_VERSION = '2.0.0';
export const DEFAULT_ASSESSOR_ID = 'assessor-default';

/**
 * The reusable evaluation MODEL (template): criteria, value scales, weights and
 * the decision scale — everything that does NOT depend on specific proposals.
 * Built in the "criação do modelo" flow; can be applied to many evaluations.
 */
export interface EvaluationModel {
  kind: 'model';
  id: string;
  modelVersion: string;
  label: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  valueTree: ValueTree;
  judgmentMatrices: JudgmentMatrix[];
  derivedScales: DerivedScale[];
  weights?: Weights;
  decisionScale: DecisionBand[];
}

/**
 * An APPLICATION of a model to a concrete set of proposals. Embeds a snapshot of
 * the model so it is self-contained and portable ("análise em curso").
 */
export interface Evaluation {
  kind: 'evaluation';
  id: string;
  modelVersion: string;
  label: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  model: EvaluationModel;
  options: Option[];
  performances: Performance[];
  aggregationResult?: AggregationResult;
  /** Free-text observations per option, keyed by option id. */
  optionNotes?: Record<string, string>;
}

/** Either persisted document kind, as written to / read from storage & JSON. */
export type ChoicesDocument = EvaluationModel | Evaluation;
