/**
 * The consequence layer: what a breach costs.
 *
 * Deliberately separate from everything in `scaling.ts` / `weighting.ts`. No
 * amount, cap or multiplier ever enters a value function: the MACBETH index
 * answers "how good was the performance", these rules answer "what follows from
 * that", and the only place the two meet is the zone multiplier in step 5 —
 * which this module records explicitly so an auditor can see it.
 *
 * Severity (0–100) is read from the incident's own facts, not from the
 * criterion's derived scale. Two readings of the same event, on purpose: a
 * criterion can sit at an acceptable level for the month and still have had one
 * severe incident in it.
 *
 * Every computation returns the steps it went through, *including the ones that
 * had no effect*. A rule that was evaluated and did not fire is as much part of
 * an auditable calculation as one that did — and it is the fastest way for the
 * author to see that a rule they wrote is never reached.
 */

import type {
  DecisionBand,
  PenaltyRules,
  SeverityBand,
  TestIncident,
  EvaluationModel,
} from '../domain/types';

export interface PenaltyStep {
  /** Short name of the rule applied ("Factor de gravidade"). */
  label: string;
  /** What it did, in words. */
  detail: string;
  /** The arithmetic, as it should read in an audit trail. */
  formula?: string;
  /** Running amount after this step, or null for a step that produces no amount. */
  amount: number | null;
  /** False when the rule was evaluated and did not change anything. */
  applied: boolean;
}

export interface PenaltyLine {
  incidentId: string;
  label: string;
  criterionId: string;
  criterionLabel: string;
  severity: number;
  severityBand: SeverityBand | null;
  amount: number;
  steps: PenaltyStep[];
  /** Set when this incident was folded into another one by the common-cause rule. */
  absorbedBy?: string;
}

export interface PenaltyResult {
  lines: PenaltyLine[];
  /** Sum of the priced lines, before the period cap. */
  subtotal: number;
  /** Final amount due. */
  total: number;
  capApplied: boolean;
  currency: string;
  rulesVersion: string;
  /** Multiplier used, and where it came from. Null when no band was reached. */
  zone: { bandId: string | null; bandLabel: string | null; multiplier: number } | null;
  /** Reasons the calculation is incomplete rather than zero. */
  notes: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The highest severity band this severity reaches. */
export function severityBandFor(severity: number, rules: PenaltyRules): SeverityBand | null {
  const sorted = [...rules.severityBands].sort((a, b) => b.minSeverity - a.minSeverity);
  return sorted.find((b) => severity >= b.minSeverity) ?? null;
}

function recurrenceFactor(occurrence: number | undefined, rules: PenaltyRules): number {
  if (!rules.recurrence.enabled || !occurrence || occurrence < 2) return 1;
  return occurrence === 2 ? rules.recurrence.secondFactor : rules.recurrence.furtherFactor;
}

export interface PenaltyInput {
  rules: PenaltyRules;
  incidents: TestIncident[];
  /** The band the index fell in, or null when it was blocked or withheld. */
  band: DecisionBand | null;
  /** True when a gate failed — triggers the critical regime if enabled. */
  gateFailed: boolean;
  /** Which gate, for the trace. */
  gateLabel?: string;
  /** Criterion labels, for readable lines. */
  labelOf: (criterionId: string) => string;
}

/**
 * Price a set of incidents under a set of rules.
 *
 * Order matters and is fixed. Per incident, each of the first three checks can
 * end it at zero, and the rest are then never reached:
 *
 *   1. severity band
 *   2. common cause → absorbed, stop
 *   3. no money rule for the criterion → stop (and say so in `notes`)
 *   4. below the criterion's minimum band → stop
 *   5. severity factor
 *   6. base × factor — the first amount in money
 *   7. × zone multiplier, × recurrence, then the per-incident cap
 *
 * Then once for the period: the critical-regime line, the subtotal, the period
 * cap. The steps are reported in that same order, because an amount you cannot
 * replay in the order it was computed is not auditable.
 */
export function computePenalties(input: PenaltyInput): PenaltyResult {
  const { rules, incidents, band, gateFailed, labelOf } = input;
  const notes: string[] = [];
  const multiplier = band ? rules.zoneMultipliers[band.id] ?? 1 : 1;
  const zone = band
    ? { bandId: band.id, bandLabel: band.label, multiplier }
    : null;
  if (!band) {
    notes.push(
      'Sem zona de decisão: o multiplicador global não se aplica e o cálculo usa ×1. Um índice retido ou bloqueado não produz zona.',
    );
  }

  // The common-cause rule keeps the most severe incident of each root cause.
  const keptByCause = new Map<string, TestIncident>();
  if (rules.commonCauseNoAccumulation) {
    for (const inc of incidents) {
      if (!inc.rootCauseId) continue;
      const cur = keptByCause.get(inc.rootCauseId);
      if (!cur || inc.severity > cur.severity) keptByCause.set(inc.rootCauseId, inc);
    }
  }

  const lines: PenaltyLine[] = incidents.map((inc) => {
    const steps: PenaltyStep[] = [];
    const criterionLabel = labelOf(inc.criterionId);
    const sevBand = severityBandFor(inc.severity, rules);
    const rule = rules.criterionRules.find((r) => r.criterionId === inc.criterionId);

    steps.push({
      label: 'Gravidade do incidente',
      detail: sevBand ? `Faixa ${sevBand.label}.` : 'Sem faixa de gravidade correspondente.',
      formula: `G = ${inc.severity}`,
      amount: null,
      applied: true,
    });

    const absorber = inc.rootCauseId ? keptByCause.get(inc.rootCauseId) : undefined;
    if (absorber && absorber.id !== inc.id) {
      steps.push({
        label: 'Acumulação por causa comum',
        detail: `Mesma causa-raiz de «${absorber.label}», que tem gravidade superior. Esta ocorrência não acumula.`,
        formula: `causa ${inc.rootCauseId}`,
        amount: 0,
        applied: true,
      });
      return { incidentId: inc.id, label: inc.label, criterionId: inc.criterionId, criterionLabel, severity: inc.severity, severityBand: sevBand, amount: 0, steps, absorbedBy: absorber.id };
    }

    if (!rule) {
      steps.push({
        label: 'Montante-base',
        detail: `«${criterionLabel}» não tem montante-base definido nas regras, por isso não há nada a calcular.`,
        amount: 0,
        applied: false,
      });
      notes.push(`«${criterionLabel}» não tem montante-base: o incidente «${inc.label}» ficou por valorizar.`);
      return { incidentId: inc.id, label: inc.label, criterionId: inc.criterionId, criterionLabel, severity: inc.severity, severityBand: sevBand, amount: 0, steps };
    }

    // Below the criterion's minimum band, nothing is due.
    const minBand = rule.minSeverityBandId
      ? rules.severityBands.find((b) => b.id === rule.minSeverityBandId)
      : undefined;
    const belowFloor =
      (sevBand?.exempt ?? false) || (minBand != null && inc.severity < minBand.minSeverity);
    if (belowFloor) {
      steps.push({
        label: 'Faixa mínima',
        detail: minBand
          ? `Abaixo de «${minBand.label}» (G ≥ ${minBand.minSeverity}) não há penalização para este critério.`
          : 'A faixa de gravidade atingida está isenta.',
        formula: minBand ? `${inc.severity} < ${minBand.minSeverity}` : undefined,
        amount: 0,
        applied: true,
      });
      return { incidentId: inc.id, label: inc.label, criterionId: inc.criterionId, criterionLabel, severity: inc.severity, severityBand: sevBand, amount: 0, steps };
    }

    // Severity factor: where G sits inside the penalisable range, counted from
    // the floor of the criterion's minimum band.
    const floor = minBand?.minSeverity ?? 0;
    const span = 100 - floor;
    const factor = span > 0 ? (inc.severity - floor) / span : 1;
    steps.push({
      label: 'Factor de gravidade',
      detail: 'Posição de G dentro da faixa penalizável, a contar da base.',
      formula: `(${inc.severity} − ${floor}) ÷ (100 − ${floor}) = ${factor.toFixed(4)}`,
      amount: null,
      applied: true,
    });

    let amount = rule.baseAmount * factor;
    steps.push({
      label: 'Montante-base do critério',
      detail: rule.reference ? `«${criterionLabel}», ${rule.reference}.` : `«${criterionLabel}».`,
      formula: `${rule.baseAmount.toFixed(2)} × ${factor.toFixed(4)}`,
      amount: round2(amount),
      applied: true,
    });

    const beforeZone = amount;
    amount *= multiplier;
    steps.push({
      label: 'Multiplicador global do período',
      detail: zone
        ? `Índice na zona «${zone.bandLabel}» → ×${multiplier}. Único ponto em que o índice toca no montante.`
        : 'Sem zona apurada — multiplicador ×1.',
      formula: `${round2(beforeZone).toFixed(2)} × ${multiplier}`,
      amount: round2(amount),
      applied: multiplier !== 1,
    });

    const rFactor = recurrenceFactor(inc.occurrence, rules);
    const beforeRec = amount;
    amount *= rFactor;
    steps.push({
      label: 'Reincidência',
      detail: rules.recurrence.enabled
        ? rFactor === 1
          ? `Primeira ocorrência na janela de ${rules.recurrence.windowDays} dias — sem agravamento.`
          : `${inc.occurrence}.ª ocorrência na janela de ${rules.recurrence.windowDays} dias.`
        : 'Regra de reincidência desactivada.',
      formula: rFactor === 1 ? undefined : `${round2(beforeRec).toFixed(2)} × ${rFactor}`,
      amount: round2(amount),
      applied: rFactor !== 1,
    });

    const cap = rule.perIncidentCap;
    const capped = cap != null && amount > cap;
    if (cap != null) {
      steps.push({
        label: 'Tecto por incidente',
        detail: capped ? `Montante limitado ao tecto deste critério.` : 'Abaixo do tecto deste critério.',
        formula: `min(${round2(amount).toFixed(2)} ; ${cap.toFixed(2)})`,
        amount: round2(capped ? cap : amount),
        applied: capped,
      });
      if (capped) amount = cap;
    }

    return {
      incidentId: inc.id,
      label: inc.label,
      criterionId: inc.criterionId,
      criterionLabel,
      severity: inc.severity,
      severityBand: sevBand,
      amount: round2(amount),
      steps,
    };
  });

  // A fixed line for the failed eliminating condition.
  //
  // It is not a substitute for the period's other incidents: those keep their
  // own lines and are summed on top of it. What it stands in for is narrower —
  // an eliminating condition has no value scale, so it could never have had a
  // proportional calculation of its own to be priced by.
  if (gateFailed && rules.criticalRegime?.enabled) {
    lines.unshift({
      incidentId: 'critical-regime',
      label: input.gateLabel ? `Regime crítico — ${input.gateLabel}` : 'Regime crítico',
      criterionId: '',
      criterionLabel: input.gateLabel ?? '',
      severity: 100,
      severityBand: null,
      amount: rules.criticalRegime.amount,
      steps: [
        {
          label: 'Regime crítico',
          detail:
            'Condição eliminatória em falha: montante fixo, porque uma eliminatória não tem escala de valor que permita calcular um montante proporcional. Os restantes incidentes do período continuam a contar e somam-se a este.',
          formula: `${rules.criticalRegime.amount.toFixed(2)}`,
          amount: rules.criticalRegime.amount,
          applied: true,
        },
      ],
    });
  }

  const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
  const cap = rules.periodCap;
  const capApplied = cap != null && subtotal > cap;
  return {
    lines,
    subtotal,
    total: round2(capApplied ? cap! : subtotal),
    capApplied,
    currency: rules.currency,
    rulesVersion: rules.version,
    zone,
    notes,
  };
}

/** Starting rules, so the screen opens on something coherent to edit. */
export function defaultPenaltyRules(model: EvaluationModel): PenaltyRules {
  const bands = [...model.decisionScale].sort((a, b) => b.minScore - a.minScore);
  const zoneMultipliers: Record<string, number> = {};
  bands.forEach((b, i) => {
    // The best band costs nothing; each step down adds 25%.
    zoneMultipliers[b.id] = i === 0 ? 0 : round2(1 + (i - 1) * 0.25);
  });
  return {
    version: 'v1',
    currency: 'EUR',
    severityBands: [
      { id: 'sev-light', label: 'Ligeira', minSeverity: 0, exempt: true },
      { id: 'sev-moderate', label: 'Moderada', minSeverity: 40 },
      { id: 'sev-serious', label: 'Grave', minSeverity: 70 },
      { id: 'sev-critical', label: 'Crítica', minSeverity: 90 },
    ],
    zoneMultipliers,
    criterionRules: [],
    recurrence: { secondFactor: 1.25, furtherFactor: 1.5, windowDays: 90, enabled: true },
    commonCauseNoAccumulation: true,
    criticalRegime: { amount: 0, enabled: false },
  };
}
