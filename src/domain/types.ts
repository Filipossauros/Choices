// ─── Enums & primitives ────────────────────────────────────────────────────

export type CriterionType = 'gate' | 'qualification';

/** MACBETH attractiveness-difference categories C0..C6 */
export type MacbethCategory = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Composite/interval judgment: "weak to moderate" = { lo: 2, hi: 3 } */
export type MacbethJudgment =
  | { kind: 'exact'; category: MacbethCategory }
  | { kind: 'interval'; lo: MacbethCategory; hi: MacbethCategory };

export type GateVerdict = 'pass' | 'fail' | 'pending';

export type OverallVerdict = 'approved' | 'conditional' | 'rejected';

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
  /** gate: 'pass'|'fail'; qualification: a level id from the descriptor */
  value: string;
}

// ─── Judgment matrices ─────────────────────────────────────────────────────

/**
 * Stores judgments for ONE criterion scale matrix or the weighting matrix.
 * MULTI-ASSESSOR EXTENSION POINT: assessorId is 'assessor-default' in MVP.
 * Future: aggregateAssessments(matrices: JudgmentMatrix[]) combines multiple.
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
  verdict: OverallVerdict;
  gateResults: GateResult[];
  criterionScores: Record<string, number | null>;
  vetoedByCriterion?: string;
  rejectedByGate?: string;
}

export interface AggregationResult {
  optionResults: OptionResult[];
  approvedThreshold: number;
  conditionalThreshold: number;
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

// ─── Top-level model ───────────────────────────────────────────────────────

export const MODEL_VERSION = '1.0.0';
export const DEFAULT_ASSESSOR_ID = 'assessor-default';

export interface MacbethModel {
  id: string;
  modelVersion: string;
  label: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  valueTree: ValueTree;
  options: Option[];
  performances: Performance[];
  judgmentMatrices: JudgmentMatrix[];
  derivedScales: DerivedScale[];
  weights?: Weights;
  aggregationResult?: AggregationResult;
  approvedThreshold: number;
  conditionalThreshold: number;
}
