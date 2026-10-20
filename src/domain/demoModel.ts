/**
 * A complete, filled-in example model — every part of the app exercised at once.
 *
 * The existing starter templates give structure and stop there: no judgments, no
 * scales, no weights, so opening one tells you nothing about whether the engine
 * works. This one is meant to be *run*: load it and the aggregation, the decision
 * bands, the bench and the consequence rules all have something real to chew on.
 *
 * What it ships and what it does NOT ship matters:
 *
 *   - It ships **judgments** — the qualitative answers a user would give — plus
 *     the structure, the decision profiles, the consequence rules and the
 *     scenarios.
 *   - It does **not** ship derived scales or weights. Those are produced by
 *     running the real LPs (`deriveDemoModel`), exactly as they would be for a
 *     model built by hand. Hard-coding plausible-looking numbers would make the
 *     example useless for its one purpose: checking that the engine computes.
 *
 * The judgments themselves are generated from a designed value shape per
 * criterion, which is how a coherent set of answers is obtained without typing
 * sixty of them. The shape is the author's intent; the scale is the LP's answer
 * to it, and the two are not the same number.
 */

import type {
  EvaluationModel,
  Criterion,
  Descriptor,
  MacbethJudgment,
  MacbethCategory,
  JudgmentMatrix,
  PerformanceLevel,
  TestScenario,
  PenaltyRules,
  DecisionBand,
  Performance,
} from './types';
import { MODEL_VERSION, DEFAULT_ASSESSOR_ID, ROOT_ID } from './types';
import { categoryForRatio } from './categories';

/**
 * Stable ids, not uuids: the scenarios, the decision profiles and the money
 * rules all point at criteria and levels by id, and an example whose parts
 * referred to freshly-minted uuids would have to be stitched together at build
 * time for no benefit. They are namespaced so they cannot collide with a
 * user's own criteria.
 */
const ID = {
  disp: 'demo-g-disponibilidade',
  dispMensal: 'demo-c-disp-mensal',
  reposicao: 'demo-c-reposicao',
  gate: 'demo-c-interrupcao',
  desemp: 'demo-g-desempenho',
  latencia: 'demo-c-latencia',
  debito: 'demo-c-debito',
  erros: 'demo-c-erros',
  suporte: 'demo-c-suporte',
} as const;

/** A level with its own id, its reading on the descriptor axis, and the value the author intends it to have. */
interface LevelSpec {
  id: string;
  label: string;
  description?: string;
  numericValue?: number;
  /** The author's intent on the 0 = neutro / 100 = bom scale. Drives the judgments, never stored. */
  intent: number;
}

/**
 * Turn a designed value shape into the pairwise judgments that imply it.
 *
 * Every pair gets a category from the size of its intended gap relative to the
 * Neutro→Bom span — the same mapping the weighting shortcut uses. The result is
 * an internally consistent matrix, so the LP solves with z* > 0 and the example
 * loads as a finished model rather than as one with a broken scale.
 */
function judgmentsFromIntent(levels: LevelSpec[]): Record<string, MacbethJudgment> {
  const span = 100; // Neutro → Bom, by construction of `intent`
  const judgments: Record<string, MacbethJudgment> = {};
  for (let i = 0; i < levels.length - 1; i++) {
    for (let j = i + 1; j < levels.length; j++) {
      const delta = levels[i].intent - levels[j].intent;
      const category = categoryForRatio(delta, span);
      judgments[`${levels[i].id}__${levels[j].id}`] = { kind: 'exact', category };
    }
  }
  return judgments;
}

function descriptorOf(levels: LevelSpec[], unit?: string): Descriptor {
  const neutralIndex = levels.findIndex((l) => l.intent === 0);
  const goodIndex = levels.findIndex((l) => l.intent === 100);
  return {
    levels: levels.map<PerformanceLevel>((l) => ({
      id: l.id,
      label: l.label,
      description: l.description,
      numericValue: l.numericValue,
    })),
    neutralIndex: neutralIndex < 0 ? levels.length - 1 : neutralIndex,
    goodIndex: goodIndex < 0 ? 0 : goodIndex,
    unit,
  };
}

// ─── The criteria ────────────────────────────────────────────────────────────

const dispLevels: LevelSpec[] = [
  { id: 'demo-l-disp-1', label: '≥ 99,95 %', description: 'Indisponibilidade inferior a 22 min/mês', numericValue: 99.99, intent: 140 },
  { id: 'demo-l-disp-2', label: '99,9 – 99,95 %', description: 'Até 44 min/mês', numericValue: 99.95, intent: 100 },
  { id: 'demo-l-disp-3', label: '99,5 – 99,9 %', description: 'Até 3 h 39/mês', numericValue: 99.9, intent: 55 },
  { id: 'demo-l-disp-4', label: '99,0 – 99,5 %', description: 'Mínimo contratual', numericValue: 99.5, intent: 0 },
  { id: 'demo-l-disp-5', label: '< 99,0 %', description: 'Acima de 7 h 18/mês', numericValue: 99.0, intent: -80 },
];

const repLevels: LevelSpec[] = [
  { id: 'demo-l-rep-1', label: '< 15 min', numericValue: 10, intent: 130 },
  { id: 'demo-l-rep-2', label: '15 – 30 min', numericValue: 30, intent: 100 },
  { id: 'demo-l-rep-3', label: '30 – 120 min', numericValue: 120, intent: 0 },
  { id: 'demo-l-rep-4', label: '> 120 min', numericValue: 300, intent: -70 },
];

const latLevels: LevelSpec[] = [
  { id: 'demo-l-lat-1', label: '< 150 ms', numericValue: 100, intent: 140 },
  { id: 'demo-l-lat-2', label: '150 – 300 ms', numericValue: 300, intent: 100 },
  { id: 'demo-l-lat-3', label: '300 – 500 ms', numericValue: 500, intent: 58 },
  { id: 'demo-l-lat-4', label: '500 – 800 ms', description: 'Mínimo contratual', numericValue: 800, intent: 0 },
  { id: 'demo-l-lat-5', label: '800 – 1 500 ms', numericValue: 1500, intent: -45 },
  { id: 'demo-l-lat-6', label: '≥ 1 500 ms', numericValue: 2500, intent: -100 },
];

const debLevels: LevelSpec[] = [
  { id: 'demo-l-deb-1', label: '> 500 msg/s', numericValue: 800, intent: 120 },
  { id: 'demo-l-deb-2', label: '250 – 500 msg/s', numericValue: 400, intent: 100 },
  { id: 'demo-l-deb-3', label: '100 – 250 msg/s', numericValue: 180, intent: 0 },
  { id: 'demo-l-deb-4', label: '< 100 msg/s', numericValue: 60, intent: -60 },
];

const errLevels: LevelSpec[] = [
  { id: 'demo-l-err-1', label: '< 0,05 %', numericValue: 0.02, intent: 130 },
  { id: 'demo-l-err-2', label: '0,05 – 0,2 %', numericValue: 0.2, intent: 100 },
  { id: 'demo-l-err-3', label: '0,2 – 0,5 %', numericValue: 0.5, intent: 58 },
  { id: 'demo-l-err-4', label: '0,5 – 1,0 %', description: 'Mínimo contratual', numericValue: 1.0, intent: 0 },
  { id: 'demo-l-err-5', label: '> 1,0 %', numericValue: 3.0, intent: -90 },
];

const supLevels: LevelSpec[] = [
  { id: 'demo-l-sup-1', label: 'Proactivo', description: 'Avisa antes de o problema ser notado', intent: 100 },
  { id: 'demo-l-sup-2', label: 'Reactivo e pontual', description: 'Responde dentro do prazo acordado', intent: 40 },
  { id: 'demo-l-sup-3', label: 'Reactivo e lento', description: 'Responde fora do prazo', intent: 0 },
];

/** Every leaf, with the level shape its judgments are generated from. */
const LEAVES: { id: string; label: string; parentId?: string; unit?: string; continuous?: boolean; levels: LevelSpec[] }[] = [
  { id: ID.dispMensal, label: 'Disponibilidade mensal', parentId: ID.disp, unit: '%', continuous: true, levels: dispLevels },
  { id: ID.reposicao, label: 'Tempo de reposição', parentId: ID.disp, unit: 'min', continuous: true, levels: repLevels },
  { id: ID.latencia, label: 'Latência p95', parentId: ID.desemp, unit: 'ms', continuous: true, levels: latLevels },
  { id: ID.debito, label: 'Débito em hora de ponta', parentId: ID.desemp, unit: 'msg/s', continuous: true, levels: debLevels },
  { id: ID.erros, label: 'Taxa de erros 5xx', unit: '%', continuous: true, levels: errLevels },
  { id: ID.suporte, label: 'Qualidade do suporte', levels: supLevels },
];

/**
 * Swing rankings per group, most important first. The weighting matrices are
 * generated from these the same way the in-app shortcut does, so the example's
 * weights are the LP's answer to a stated ranking rather than typed numbers.
 */
const RANKING: Record<string, string[]> = {
  [ROOT_ID]: [ID.disp, ID.desemp, ID.erros, ID.suporte],
  [ID.disp]: [ID.dispMensal, ID.reposicao],
  [ID.desemp]: [ID.latencia, ID.debito],
};

/** Intended swing magnitudes, in the same units `judgmentsFromIntent` expects. */
const SWING_INTENT: Record<string, number> = {
  [ID.disp]: 100,
  [ID.desemp]: 78,
  [ID.erros]: 50,
  [ID.suporte]: 26,
  [ID.dispMensal]: 100,
  [ID.reposicao]: 55,
  [ID.latencia]: 100,
  [ID.debito]: 45,
};

/** Weighting judgments for a group, including each criterion against all-neutro. */
function weightingJudgments(order: string[]): Record<string, MacbethJudgment> {
  const judgments: Record<string, MacbethJudgment> = {};
  const span = SWING_INTENT[order[0]] ?? 100;
  for (let i = 0; i < order.length - 1; i++) {
    for (let j = i + 1; j < order.length; j++) {
      const delta = (SWING_INTENT[order[i]] ?? 0) - (SWING_INTENT[order[j]] ?? 0);
      // Distinct ranks must stay strictly ordered or the LP reads them as
      // indifferent and the stated ranking is silently discarded.
      judgments[`${order[i]}__${order[j]}`] = {
        kind: 'exact',
        category: Math.max(1, categoryForRatio(delta, span)) as MacbethCategory,
      };
    }
  }
  for (const id of order) {
    // `engine/weighting.ts:ALL_NEUTRAL`. Written out rather than imported so a
    // domain module does not reach into the engine; the round-trip test pins
    // the two together.
    judgments[`${id}__all_neutral_ref`] = {
      kind: 'exact',
      category: Math.max(1, categoryForRatio(SWING_INTENT[id] ?? 0, span)) as MacbethCategory,
    };
  }
  return judgments;
}

// ─── Decision bands, grounded in reference profiles ──────────────────────────

/** A reference alternative: one level per qualification criterion. */
function profile(pick: (levels: LevelSpec[]) => LevelSpec): Record<string, string> {
  return Object.fromEntries(LEAVES.map((l) => [l.id, pick(l.levels).id]));
}

const bandLevel = (name: 'good' | 'neutral' | 'worst') => (levels: LevelSpec[]) => {
  if (name === 'good') return levels.find((l) => l.intent === 100) ?? levels[0];
  if (name === 'neutral') return levels.find((l) => l.intent === 0) ?? levels[levels.length - 1];
  return levels[levels.length - 1];
};

function demoBands(): DecisionBand[] {
  return [
    {
      id: 'demo-band-ok',
      label: 'Conforme',
      action: 'Sem consequência contratual.',
      color: '#2A9C6D',
      // "Bom em tudo" — the cut-off is this profile's own global value, which
      // `resolveBands` recomputes from the derived scales and weights.
      referenceProfile: profile(bandLevel('good')),
      minScore: 100,
    },
    {
      id: 'demo-band-degraded',
      label: 'Degradado',
      action: 'Penalização proporcional à gravidade dos incidentes.',
      color: '#CE8117',
      // "Mínimo contratual em tudo" — by construction this lands on 0.
      referenceProfile: profile(bandLevel('neutral')),
      minScore: 0,
    },
    {
      id: 'demo-band-bad',
      label: 'Inaceitável',
      action: 'Penalização agravada e plano de recuperação.',
      color: '#D64C3D',
      minScore: -1000,
    },
  ];
}

// ─── Consequence rules ───────────────────────────────────────────────────────

function demoPenaltyRules(): PenaltyRules {
  return {
    version: 'v1 · exemplo',
    currency: 'EUR',
    severityBands: [
      { id: 'demo-sev-light', label: 'Ligeira', minSeverity: 0, exempt: true },
      { id: 'demo-sev-moderate', label: 'Moderada', minSeverity: 40 },
      { id: 'demo-sev-serious', label: 'Grave', minSeverity: 70 },
      { id: 'demo-sev-critical', label: 'Crítica', minSeverity: 90 },
    ],
    zoneMultipliers: {
      'demo-band-ok': 0,
      'demo-band-degraded': 1.1,
      'demo-band-bad': 1.5,
    },
    criterionRules: [
      { criterionId: ID.dispMensal, baseAmount: 1500, minSeverityBandId: 'demo-sev-moderate', perIncidentCap: 2000, reference: 'cl. 14.3 a)' },
      { criterionId: ID.latencia, baseAmount: 1000, minSeverityBandId: 'demo-sev-moderate', perIncidentCap: 2000, reference: 'cl. 14.3 b)' },
      { criterionId: ID.erros, baseAmount: 1000, minSeverityBandId: 'demo-sev-serious', perIncidentCap: 2000, reference: 'cl. 14.3 b)' },
      { criterionId: ID.reposicao, baseAmount: 800, minSeverityBandId: 'demo-sev-moderate', perIncidentCap: 1200, reference: 'cl. 14.3 c)' },
    ],
    recurrence: { secondFactor: 1.25, furtherFactor: 1.5, windowDays: 90, enabled: true },
    commonCauseNoAccumulation: true,
    criticalRegime: { amount: 3000, enabled: true },
    periodCap: 8000,
  };
}

// ─── Scenarios ───────────────────────────────────────────────────────────────

function perf(scenarioId: string, criterionId: string, value: string, extra?: Partial<Performance>): Performance {
  return { optionId: scenarioId, criterionId, value, ...extra };
}

/** A continuous reading, stored the way the bench stores one the user typed. */
function measured(scenarioId: string, leafId: string, reading: number, nearestLevelId: string, position: number): Performance {
  return { optionId: scenarioId, criterionId: leafId, value: nearestLevelId, position, measured: reading };
}

function demoScenarios(): TestScenario[] {
  const now = new Date().toISOString();
  const allAt = (id: string, pick: (levels: LevelSpec[]) => LevelSpec): Performance[] => [
    ...LEAVES.map((l) => perf(id, l.id, pick(l.levels).id)),
    perf(id, ID.gate, 'pass'),
  ];

  const conforme = 'demo-s-conforme';
  const minimo = 'demo-s-minimo';
  const degradado = 'demo-s-degradado';
  const critico = 'demo-s-critico';
  const incompleto = 'demo-s-incompleto';

  return [
    {
      id: conforme,
      label: 'Mês conforme',
      description: 'Tudo no nível «bom». Deve dar exactamente 100 e cair na zona mais alta.',
      performances: allAt(conforme, bandLevel('good')),
      updatedAt: now,
    },
    {
      id: minimo,
      label: 'Tudo no mínimo contratual',
      description: 'Tudo no nível neutro. Tem de dar exactamente 0 — é o ensaio que apanha erros de normalização.',
      performances: allAt(minimo, bandLevel('neutral')),
      updatedAt: now,
    },
    {
      id: degradado,
      label: 'Degradação de latência',
      description: 'Leituras contínuas fora dos níveis, dois incidentes com a mesma causa-raiz.',
      performances: [
        measured(degradado, ID.dispMensal, 99.62, 'demo-l-disp-3', 0.63),
        measured(degradado, ID.reposicao, 95, 'demo-l-rep-3', 0.71),
        measured(degradado, ID.latencia, 870, 'demo-l-lat-5', 0.68),
        measured(degradado, ID.debito, 310, 'demo-l-deb-2', 0.34),
        measured(degradado, ID.erros, 0.4, 'demo-l-err-3', 0.87),
        perf(degradado, ID.suporte, 'demo-l-sup-2'),
        perf(degradado, ID.gate, 'pass'),
      ],
      incidents: [
        { id: 'demo-i-205', label: 'INC-205 · latência acima do limiar', criterionId: ID.latencia, severity: 78, occurrence: 2, rootCauseId: 'RC-17' },
        { id: 'demo-i-206', label: 'INC-206 · erros 5xx', criterionId: ID.erros, severity: 61, occurrence: 1, rootCauseId: 'RC-17' },
        { id: 'demo-i-211', label: 'INC-211 · degradação parcial', criterionId: ID.dispMensal, severity: 75, occurrence: 1 },
      ],
      updatedAt: now,
    },
    {
      id: critico,
      label: 'Interrupção eliminatória',
      description: 'Bom em tudo, mas a condição eliminatória falha: a classificação fica bloqueada e aplica-se o regime crítico.',
      performances: [
        ...LEAVES.map((l) => perf(critico, l.id, bandLevel('good')(l.levels).id)),
        perf(critico, ID.gate, 'fail'),
      ],
      updatedAt: now,
    },
    {
      id: incompleto,
      label: 'Métrica em falta',
      description: 'Um critério por preencher: o índice fica retido, não é inventado um zero.',
      performances: [
        ...LEAVES.filter((l) => l.id !== ID.erros).map((l) => perf(incompleto, l.id, bandLevel('good')(l.levels).id)),
        perf(incompleto, ID.gate, 'pass'),
      ],
      updatedAt: now,
    },
  ];
}

// ─── Assembly ────────────────────────────────────────────────────────────────

/**
 * The example with its judgments but without derived scales or weights.
 *
 * Exported separately so a test can assert that this half really is unsolved —
 * the distinction between "shipped with judgments" and "shipped with results"
 * is the whole point of the example, and it should not be possible to blur it
 * by accident.
 */
export function buildDemoSkeleton(): EvaluationModel {
  const now = new Date().toISOString();
  const criteria: Record<string, Criterion> = {
    [ID.disp]: { id: ID.disp, type: 'composite', label: 'Disponibilidade', description: 'O serviço esteve lá quando era preciso.' },
    [ID.desemp]: { id: ID.desemp, type: 'composite', label: 'Desempenho', description: 'Respondeu com a rapidez e a capacidade acordadas.' },
    [ID.gate]: {
      id: ID.gate,
      type: 'gate',
      label: 'Sem interrupção total acima de 4 h',
      description: 'Condição eliminatória: uma paragem total mais longa do que 4 horas não é compensável por bom desempenho noutro critério.',
    },
  };
  for (const leaf of LEAVES) {
    criteria[leaf.id] = {
      id: leaf.id,
      type: 'qualification',
      label: leaf.label,
      parentId: leaf.parentId,
      descriptor: descriptorOf(leaf.levels, leaf.unit),
      continuous: leaf.continuous,
    };
  }

  const matrices: JudgmentMatrix[] = [
    ...LEAVES.map<JudgmentMatrix>((leaf) => ({
      id: `demo-m-${leaf.id}`,
      kind: 'scale',
      criterionId: leaf.id,
      assessorId: DEFAULT_ASSESSOR_ID,
      judgments: judgmentsFromIntent(leaf.levels),
      updatedAt: now,
    })),
    ...Object.entries(RANKING).map<JudgmentMatrix>(([parentId, order]) => ({
      id: `demo-m-w-${parentId}`,
      kind: 'weighting',
      criterionId: parentId,
      assessorId: DEFAULT_ASSESSOR_ID,
      judgments: weightingJudgments(order),
      updatedAt: now,
    })),
  ];

  return {
    kind: 'model',
    id: 'demo-interoperabilidade',
    modelVersion: MODEL_VERSION,
    label: 'Exemplo completo — serviço ligado à plataforma',
    description:
      'Exemplo preenchido, com dados fictícios: hierarquia de critérios, condição eliminatória, descritores contínuos, juízos MACBETH, zonas fundamentadas em perfis de referência, regras de consequência e cinco cenários de ensaio.',
    subject: { one: 'serviço', many: 'serviços' },
    createdAt: now,
    updatedAt: now,
    valueTree: {
      root: {
        criterionId: ROOT_ID,
        children: [
          {
            criterionId: ID.disp,
            children: [
              { criterionId: ID.dispMensal, children: [] },
              { criterionId: ID.reposicao, children: [] },
              { criterionId: ID.gate, children: [] },
            ],
          },
          {
            criterionId: ID.desemp,
            children: [
              { criterionId: ID.latencia, children: [] },
              { criterionId: ID.debito, children: [] },
            ],
          },
          { criterionId: ID.erros, children: [] },
          { criterionId: ID.suporte, children: [] },
        ],
      },
      criteria,
    },
    judgmentMatrices: matrices,
    derivedScales: [],
    weightOrder: RANKING,
    decisionScale: demoBands(),
    penaltyRules: demoPenaltyRules(),
    scenarios: demoScenarios(),
  };
}
