/**
 * The test bench: run a hand-written scenario through the model and report the
 * whole path from the value the author typed to the index.
 *
 * It does not compute anything itself. Scoring goes through `aggregate` on a
 * throwaway Evaluation, so the bench and the exported model necessarily agree —
 * a bench with its own arithmetic would be testing the bench, not the model.
 * What this module adds is the *trace*: observed → level → vᵢ → kᵢ → kᵢ·vᵢ, the
 * one line per criterion that makes the index auditable.
 */

import type {
  EvaluationModel,
  Evaluation,
  OptionResult,
  TestScenario,
  QualificationCriterion,
  DecisionBand,
} from '../domain/types';
import { MODEL_VERSION } from '../domain/types';
import { effectiveWeights, qualificationCriteria } from '../domain/tree';
import { classify } from '../domain/decision';
import { aggregate, resolveBands } from './aggregation';
import { positionToNumeric } from './scaling';

/** One criterion's line in the trace. */
export interface BenchRow {
  criterionId: string;
  label: string;
  type: 'qualification' | 'gate';
  /** What the author wrote, in the descriptor's own terms ("870 ms", "Falha"). */
  observed: string | null;
  /** The level the input resolved to, or null for a gate / blank input. */
  levelLabel: string | null;
  /** Position along the descriptor for a continuous reading, in [0,1]. */
  position?: number;
  /** vᵢ — null when blank, absent for a gate. */
  value: number | null;
  /** Effective (global) weight; absent for a gate, which has none. */
  weight?: number;
  /** kᵢ · vᵢ — the criterion's share of the index. */
  contribution: number | null;
  /** Gate only. */
  verdict?: 'pass' | 'fail' | 'pending';
  /** True when the author left this criterion blank. */
  blank: boolean;
}

export interface BenchResult {
  scenarioId: string;
  label: string;
  rows: BenchRow[];
  /** The comparable index. Null when a criterion is unanswered. */
  globalValue: number | null;
  /** What it would have scored if nothing had blocked it. */
  indicativeValue: number | null;
  band: DecisionBand | null;
  /** The band `indicativeValue` would have fallen in, shown struck through. */
  wouldBeBand: DecisionBand | null;
  blocked: boolean;
  blockedBy: { kind: 'gate' | 'veto'; criterionId: string; label: string } | null;
  /** Qualification criteria left blank — the index is withheld, not guessed. */
  missing: { criterionId: string; label: string }[];
  pendingGates: { criterionId: string; label: string }[];
  raw: OptionResult;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Wrap scenarios as a throwaway Evaluation so `aggregate` does the scoring. */
function benchEvaluation(model: EvaluationModel, scenarios: TestScenario[]): Evaluation {
  return {
    kind: 'evaluation',
    id: `bench-${model.id}`,
    modelVersion: MODEL_VERSION,
    label: 'bench',
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
    model,
    options: scenarios.map((s) => ({ id: s.id, label: s.label, createdAt: s.updatedAt })),
    // A scenario's performances carry its own id as optionId; re-stamping it
    // here means a scenario copied from another one still scores as itself.
    performances: scenarios.flatMap((s) =>
      s.performances.map((p) => ({ ...p, optionId: s.id })),
    ),
  };
}

/** How the author's input reads back, in the descriptor's own terms. */
function observedLabel(crit: QualificationCriterion, perf: { value: string; position?: number; measured?: number } | undefined): string | null {
  if (!perf) return null;
  if (perf.measured != null) {
    const unit = crit.descriptor.unit;
    return unit ? `${perf.measured} ${unit}` : String(perf.measured);
  }
  if (perf.position != null) {
    const n = positionToNumeric(crit.descriptor, perf.position);
    if (n != null) {
      const unit = crit.descriptor.unit;
      return unit ? `${round2(n)} ${unit}` : String(round2(n));
    }
  }
  return crit.descriptor.levels.find((l) => l.id === perf.value)?.label ?? null;
}

export function runScenarios(model: EvaluationModel, scenarios: TestScenario[]): BenchResult[] {
  if (scenarios.length === 0) return [];
  const result = aggregate(benchEvaluation(model, scenarios));
  const bands = resolveBands(model);
  const effW = effectiveWeights(model);
  const quals = qualificationCriteria(model);
  const gates = Object.values(model.valueTree.criteria).filter((c) => c.type === 'gate');
  const byId = new Map(result.optionResults.map((r) => [r.optionId, r]));

  return scenarios.map((scenario) => {
    const r = byId.get(scenario.id)!;
    const perfByCrit = new Map(scenario.performances.map((p) => [p.criterionId, p]));

    const qualRows: BenchRow[] = quals.map((crit) => {
      const perf = perfByCrit.get(crit.id);
      const value = r.criterionScores[crit.id] ?? null;
      const weight = effW.get(crit.id);
      const levelId = perf?.position != null ? perf.value : perf?.value;
      return {
        criterionId: crit.id,
        label: crit.label,
        type: 'qualification',
        observed: observedLabel(crit, perf),
        levelLabel: crit.descriptor.levels.find((l) => l.id === levelId)?.label ?? null,
        position: perf?.position,
        value,
        weight,
        contribution: value != null && weight != null ? round2(weight * value) : null,
        blank: !perf,
      };
    });

    const gateRows: BenchRow[] = gates.map((crit) => {
      const verdict = r.gateResults.find((g) => g.criterionId === crit.id)?.verdict ?? 'pending';
      return {
        criterionId: crit.id,
        label: crit.label,
        type: 'gate',
        observed: verdict === 'pass' ? 'Cumpre' : verdict === 'fail' ? 'Falha' : null,
        levelLabel: null,
        value: null,
        contribution: null,
        verdict,
        blank: verdict === 'pending',
      };
    });

    const labelOf = (id: string) => model.valueTree.criteria[id]?.label ?? id;
    const blockedBy = r.rejectedByGate
      ? ({ kind: 'gate', criterionId: r.rejectedByGate, label: labelOf(r.rejectedByGate) } as const)
      : r.vetoedByCriterion
        ? ({ kind: 'veto', criterionId: r.vetoedByCriterion, label: labelOf(r.vetoedByCriterion) } as const)
        : null;

    const indicativeValue = r.globalValue ?? r.indicativeValue ?? null;

    return {
      scenarioId: scenario.id,
      label: scenario.label,
      rows: [...qualRows, ...gateRows],
      globalValue: r.globalValue,
      indicativeValue,
      band: r.bandId ? bands.find((b) => b.id === r.bandId) ?? null : null,
      // Only meaningful while something is blocking: otherwise it is just the band.
      wouldBeBand: r.hardRejected && indicativeValue != null ? classify(indicativeValue, bands) : null,
      blocked: r.hardRejected,
      blockedBy,
      missing: (r.missingCriteria ?? []).map((id) => ({ criterionId: id, label: labelOf(id) })),
      pendingGates: (r.pendingGates ?? []).map((id) => ({ criterionId: id, label: labelOf(id) })),
      raw: r,
    };
  });
}

export function runScenario(model: EvaluationModel, scenario: TestScenario): BenchResult {
  return runScenarios(model, [scenario])[0];
}

export const TEST_VECTORS_SCHEMA = 'choices/test-vectors@1';

/**
 * The scenarios as inputs + expected results.
 *
 * This is the point of the bench: whoever implements the model elsewhere runs
 * these same inputs and compares. A number that differs means their
 * implementation is wrong, not the model — which is only true if the expected
 * values here come from the same engine the model was built with, so they are
 * taken straight from `runScenarios`.
 */
export interface TestVectors {
  schema: typeof TEST_VECTORS_SCHEMA;
  generatedAt: string;
  model: { id: string; label: string; version: string };
  anchors: { neutral: 0; good: 100 };
  vectors: {
    id: string;
    label: string;
    inputs: Record<string, string | number | null>;
    expected: {
      index: number | null;
      band: string | null;
      blocked: boolean;
      blockedBy: string | null;
      /** Present only when something blocked it: what it would have scored. */
      indicativeIndex?: number | null;
      incomplete: boolean;
      missing: string[];
      /** Per-criterion values, so a mismatch can be located instead of guessed. */
      criterionValues: Record<string, number | null>;
    };
  }[];
}

export function buildTestVectors(
  model: EvaluationModel,
  scenarios: TestScenario[],
): TestVectors {
  const results = runScenarios(model, scenarios);
  return {
    schema: TEST_VECTORS_SCHEMA,
    generatedAt: new Date().toISOString(),
    model: { id: model.id, label: model.label, version: model.modelVersion },
    anchors: { neutral: 0, good: 100 },
    vectors: results.map((r) => {
      const inputs: Record<string, string | number | null> = {};
      const criterionValues: Record<string, number | null> = {};
      for (const row of r.rows) {
        inputs[row.criterionId] = row.blank
          ? null
          : row.type === 'gate'
            ? row.verdict ?? null
            : row.position != null
              ? row.observed
              : row.levelLabel;
        if (row.type === 'qualification') criterionValues[row.criterionId] = row.value;
      }
      return {
        id: r.scenarioId,
        label: r.label,
        inputs,
        expected: {
          index: r.globalValue,
          band: r.band?.label ?? null,
          blocked: r.blocked,
          blockedBy: r.blockedBy?.label ?? null,
          ...(r.blocked ? { indicativeIndex: r.indicativeValue } : {}),
          incomplete: r.missing.length > 0,
          missing: r.missing.map((m) => m.label),
          criterionValues,
        },
      };
    }),
  };
}
