import { describe, it, expect } from 'vitest';
import { aggregate, scoreProfile } from '../aggregation';
import type { Evaluation, EvaluationModel, ValueTree, DecisionBand } from '../../domain/types';
import { MODEL_VERSION } from '../../domain/types';

const SCALE: DecisionBand[] = [
  { id: 'approved', label: 'Recomendado', minScore: 70, color: '#16a34a' },
  { id: 'conditional', label: 'Com reservas', minScore: 40, color: '#d97706' },
  { id: 'rejected', label: 'Não recomendado', minScore: 0, color: '#dc2626' },
];

function model(overrides: Partial<EvaluationModel> = {}): EvaluationModel {
  return {
    kind: 'model',
    id: 'm',
    modelVersion: MODEL_VERSION,
    label: 'Test',
    createdAt: '',
    updatedAt: '',
    valueTree: { root: { criterionId: 'root', children: [] }, criteria: {} },
    judgmentMatrices: [],
    derivedScales: [],
    decisionScale: SCALE,
    ...overrides,
  };
}

function evaluation(m: EvaluationModel, overrides: Partial<Evaluation> = {}): Evaluation {
  return {
    kind: 'evaluation',
    id: 'e',
    modelVersion: MODEL_VERSION,
    label: 'Eval',
    createdAt: '',
    updatedAt: '',
    model: m,
    options: [],
    performances: [],
    ...overrides,
  };
}

describe('Two-tier aggregation', () => {
  it('Tier 1 — gate failure vetos before scoring', () => {
    const valueTree: ValueTree = {
      root: { criterionId: 'root', children: [{ criterionId: 'g1', children: [] }] },
      criteria: { g1: { id: 'g1', label: 'Gate 1', type: 'gate' } },
    };
    const result = aggregate(
      evaluation(model({ valueTree }), {
        options: [{ id: 'p1', label: 'P1', createdAt: '' }],
        performances: [{ optionId: 'p1', criterionId: 'g1', value: 'fail' }],
      }),
    );
    const r = result.optionResults[0];
    expect(r.hardRejected).toBe(true);
    expect(r.globalValue).toBeNull();
    expect(r.rejectedByGate).toBe('g1');
  });

  it('Tier 1 — gate pass allows scoring', () => {
    const valueTree: ValueTree = {
      root: {
        criterionId: 'root',
        children: [
          { criterionId: 'g1', children: [] },
          { criterionId: 'q1', children: [] },
        ],
      },
      criteria: {
        g1: { id: 'g1', label: 'Gate', type: 'gate' },
        q1: {
          id: 'q1',
          label: 'Quality',
          type: 'qualification',
          descriptor: {
            levels: [{ id: 'high', label: 'High' }, { id: 'low', label: 'Low' }],
            neutralIndex: 1,
            goodIndex: 0,
          },
        },
      },
    };
    const result = aggregate(
      evaluation(
        model({
          valueTree,
          derivedScales: [{
            criterionId: 'q1',
            values: [
              { levelId: 'high', value: 100, admissibleRange: [100, 100] },
              { levelId: 'low', value: 0, admissibleRange: [0, 0] },
            ],
            consistencyMargin: 1,
            derivedAt: '',
          }],
          weights: {
            weights: [{ criterionId: 'q1', weight: 1.0, admissibleRange: [1, 1] }],
            consistencyMargin: 1,
            derivedAt: '',
          },
        }),
        {
          options: [{ id: 'p1', label: 'P1', createdAt: '' }],
          performances: [
            { optionId: 'p1', criterionId: 'g1', value: 'pass' },
            { optionId: 'p1', criterionId: 'q1', value: 'high' },
          ],
        },
      ),
    );
    const r = result.optionResults[0];
    expect(r.hardRejected).toBe(false);
    expect(r.bandId).toBe('approved');
    expect(r.globalValue).toBe(100);
  });

  it('Tier 2 — veto triggers when score below veto level', () => {
    const valueTree: ValueTree = {
      root: { criterionId: 'root', children: [{ criterionId: 'q1', children: [] }] },
      criteria: {
        q1: {
          id: 'q1',
          label: 'Q1',
          type: 'qualification',
          vetoLevelId: 'mid',
          descriptor: {
            levels: [
              { id: 'high', label: 'High' },
              { id: 'mid', label: 'Mid' },
              { id: 'low', label: 'Low' },
            ],
            neutralIndex: 1,
            goodIndex: 0,
          },
        },
      },
    };
    const result = aggregate(
      evaluation(
        model({
          valueTree,
          derivedScales: [{
            criterionId: 'q1',
            values: [
              { levelId: 'high', value: 100, admissibleRange: [100, 100] },
              { levelId: 'mid', value: 0, admissibleRange: [0, 0] },
              { levelId: 'low', value: -50, admissibleRange: [-50, -50] },
            ],
            consistencyMargin: 1,
            derivedAt: '',
          }],
          weights: {
            weights: [{ criterionId: 'q1', weight: 1.0, admissibleRange: [1, 1] }],
            consistencyMargin: 1,
            derivedAt: '',
          },
        }),
        {
          options: [{ id: 'p1', label: 'P1', createdAt: '' }],
          performances: [{ optionId: 'p1', criterionId: 'q1', value: 'low' }],
        },
      ),
    );
    const r = result.optionResults[0];
    expect(r.hardRejected).toBe(true);
    expect(r.vetoedByCriterion).toBe('q1');
  });

  it('classifies into the band between thresholds', () => {
    const valueTree: ValueTree = {
      root: { criterionId: 'root', children: [{ criterionId: 'q1', children: [] }] },
      criteria: {
        q1: {
          id: 'q1',
          label: 'Q1',
          type: 'qualification',
          descriptor: {
            levels: [{ id: 'high', label: 'H' }, { id: 'low', label: 'L' }],
            neutralIndex: 1,
            goodIndex: 0,
          },
        },
      },
    };
    const result = aggregate(
      evaluation(
        model({
          valueTree,
          derivedScales: [{
            criterionId: 'q1',
            values: [
              { levelId: 'high', value: 100, admissibleRange: [100, 100] },
              { levelId: 'low', value: 55, admissibleRange: [55, 55] },
            ],
            consistencyMargin: 1,
            derivedAt: '',
          }],
          weights: {
            weights: [{ criterionId: 'q1', weight: 1.0, admissibleRange: [1, 1] }],
            consistencyMargin: 1,
            derivedAt: '',
          },
        }),
        {
          options: [{ id: 'p1', label: 'P1', createdAt: '' }],
          performances: [{ optionId: 'p1', criterionId: 'q1', value: 'low' }],
        },
      ),
    );
    expect(result.optionResults[0].bandId).toBe('conditional');
    expect(result.optionResults[0].globalValue).toBe(55);
  });

  it('additive model: V(p) = Σ kᵢ · vᵢ(p)', () => {
    const valueTree: ValueTree = {
      root: {
        criterionId: 'root',
        children: [
          { criterionId: 'q1', children: [] },
          { criterionId: 'q2', children: [] },
        ],
      },
      criteria: {
        q1: {
          id: 'q1', label: 'Q1', type: 'qualification',
          descriptor: { levels: [{ id: 'h', label: 'H' }, { id: 'l', label: 'L' }], neutralIndex: 1, goodIndex: 0 },
        },
        q2: {
          id: 'q2', label: 'Q2', type: 'qualification',
          descriptor: { levels: [{ id: 'h', label: 'H' }, { id: 'l', label: 'L' }], neutralIndex: 1, goodIndex: 0 },
        },
      },
    };
    // Weights: q1=0.6, q2=0.4; scores: q1=80, q2=50 → V = 0.6*80+0.4*50 = 68
    const result = aggregate(
      evaluation(
        model({
          valueTree,
          derivedScales: [
            { criterionId: 'q1', values: [{ levelId: 'h', value: 80, admissibleRange: [80, 80] }, { levelId: 'l', value: 0, admissibleRange: [0, 0] }], consistencyMargin: 1, derivedAt: '' },
            { criterionId: 'q2', values: [{ levelId: 'h', value: 50, admissibleRange: [50, 50] }, { levelId: 'l', value: 0, admissibleRange: [0, 0] }], consistencyMargin: 1, derivedAt: '' },
          ],
          weights: {
            weights: [
              { criterionId: 'q1', weight: 0.6, admissibleRange: [0.6, 0.6] },
              { criterionId: 'q2', weight: 0.4, admissibleRange: [0.4, 0.4] },
            ],
            consistencyMargin: 1,
            derivedAt: '',
          },
        }),
        {
          options: [{ id: 'p1', label: 'P1', createdAt: '' }],
          performances: [
            { optionId: 'p1', criterionId: 'q1', value: 'h' },
            { optionId: 'p1', criterionId: 'q2', value: 'h' },
          ],
        },
      ),
    );
    const r = result.optionResults[0];
    expect(r.globalValue).toBeCloseTo(68, 1);
    expect(r.bandId).toBe('conditional'); // 68 < 70
  });
});

describe('scoreProfile — MACBETH decision cut-offs from reference profiles', () => {
  const valueTree: ValueTree = {
    root: {
      criterionId: 'root',
      children: [
        { criterionId: 'q1', children: [] },
        { criterionId: 'q2', children: [] },
      ],
    },
    criteria: {
      q1: {
        id: 'q1', label: 'Latência', type: 'qualification',
        descriptor: { levels: [{ id: 'fast', label: '0 ms' }, { id: 'mid', label: '100 ms' }, { id: 'slow', label: '500 ms' }], neutralIndex: 2, goodIndex: 0 },
      },
      q2: {
        id: 'q2', label: 'Saturação', type: 'qualification',
        descriptor: { levels: [{ id: 'low', label: '10%' }, { id: 'high', label: '90%' }], neutralIndex: 1, goodIndex: 0 },
      },
    },
  };
  const m = model({
    valueTree,
    derivedScales: [
      { criterionId: 'q1', values: [
        { levelId: 'fast', value: 100, admissibleRange: [100, 100] },
        { levelId: 'mid', value: 60, admissibleRange: [60, 60] },
        { levelId: 'slow', value: 0, admissibleRange: [0, 0] },
      ], consistencyMargin: 1, derivedAt: '' },
      { criterionId: 'q2', values: [
        { levelId: 'low', value: 100, admissibleRange: [100, 100] },
        { levelId: 'high', value: 0, admissibleRange: [0, 0] },
      ], consistencyMargin: 1, derivedAt: '' },
    ],
    weights: {
      weights: [
        { criterionId: 'q1', weight: 0.7, admissibleRange: [0.7, 0.7] },
        { criterionId: 'q2', weight: 0.3, admissibleRange: [0.3, 0.3] },
      ],
      consistencyMargin: 1, derivedAt: '',
    },
  });

  it('computes the global V(p) of a reference profile (weighted additive)', () => {
    // q1=mid(60)*0.7 + q2=low(100)*0.3 = 42 + 30 = 72
    expect(scoreProfile(m, { q1: 'mid', q2: 'low' })).toBeCloseTo(72, 5);
  });

  it('reflects global impact across all criteria, not partial comparisons', () => {
    // worst profile: q1=slow(0), q2=high(0) → 0 ; best: fast(100), low(100) → 100
    expect(scoreProfile(m, { q1: 'slow', q2: 'high' })).toBeCloseTo(0, 5);
    expect(scoreProfile(m, { q1: 'fast', q2: 'low' })).toBeCloseTo(100, 5);
  });

  it('returns null when the model has no weights yet (cut-off underivable)', () => {
    const noWeights = model({ valueTree, derivedScales: m.derivedScales });
    expect(scoreProfile(noWeights, { q1: 'mid', q2: 'low' })).toBeNull();
  });
});

describe('Hierarchical aggregation — composite factors', () => {
  // Tree:
  //   root
  //   ├── health (composite)   [root weight 0.4]
  //   │   ├── lat (qual)        [within health: 0.6]
  //   │   └── sat (qual)        [within health: 0.4]
  //   └── crit (qual)           [root weight 0.6]
  const valueTree: ValueTree = {
    root: {
      criterionId: 'root',
      children: [
        {
          criterionId: 'health',
          children: [
            { criterionId: 'lat', children: [] },
            { criterionId: 'sat', children: [] },
          ],
        },
        { criterionId: 'crit', children: [] },
      ],
    },
    criteria: {
      health: { id: 'health', label: 'HealthStatus', type: 'composite' },
      lat: {
        id: 'lat', label: 'Latência', type: 'qualification',
        descriptor: { levels: [{ id: 'fast', label: 'Rápido' }, { id: 'slow', label: 'Lento' }], neutralIndex: 1, goodIndex: 0 },
      },
      sat: {
        id: 'sat', label: 'Saturação', type: 'qualification',
        descriptor: { levels: [{ id: 'low', label: 'Baixa' }, { id: 'high', label: 'Alta' }], neutralIndex: 1, goodIndex: 0 },
      },
      crit: {
        id: 'crit', label: 'Criticidade', type: 'qualification',
        descriptor: { levels: [{ id: 'lo', label: 'Baixa' }, { id: 'hi', label: 'Alta' }], neutralIndex: 1, goodIndex: 0 },
      },
    },
  };

  function hierModel() {
    return model({
      valueTree,
      derivedScales: [
        { criterionId: 'lat', values: [{ levelId: 'fast', value: 100, admissibleRange: [100, 100] }, { levelId: 'slow', value: 0, admissibleRange: [0, 0] }], consistencyMargin: 1, derivedAt: '' },
        { criterionId: 'sat', values: [{ levelId: 'low', value: 100, admissibleRange: [100, 100] }, { levelId: 'high', value: 0, admissibleRange: [0, 0] }], consistencyMargin: 1, derivedAt: '' },
        { criterionId: 'crit', values: [{ levelId: 'lo', value: 100, admissibleRange: [100, 100] }, { levelId: 'hi', value: 0, admissibleRange: [0, 0] }], consistencyMargin: 1, derivedAt: '' },
      ],
      // root group: health 0.4, crit 0.6
      weights: {
        weights: [
          { criterionId: 'health', weight: 0.4, admissibleRange: [0.4, 0.4] },
          { criterionId: 'crit', weight: 0.6, admissibleRange: [0.6, 0.6] },
        ],
        consistencyMargin: 1, derivedAt: '',
      },
      // health group: lat 0.6, sat 0.4
      subWeights: {
        health: {
          weights: [
            { criterionId: 'lat', weight: 0.6, admissibleRange: [0.6, 0.6] },
            { criterionId: 'sat', weight: 0.4, admissibleRange: [0.4, 0.4] },
          ],
          consistencyMargin: 1, derivedAt: '',
        },
      },
    });
  }

  it('aggregate(): composite value feeds the global score', () => {
    // lat=fast(100), sat=high(0) → health = 0.6*100 + 0.4*0 = 60
    // crit=hi(0)            → global = 0.4*60 + 0.6*0 = 24
    const result = aggregate(
      evaluation(hierModel(), {
        options: [{ id: 'p1', label: 'P1', createdAt: '' }],
        performances: [
          { optionId: 'p1', criterionId: 'lat', value: 'fast' },
          { optionId: 'p1', criterionId: 'sat', value: 'high' },
          { optionId: 'p1', criterionId: 'crit', value: 'hi' },
        ],
      }),
    );
    const r = result.optionResults[0];
    expect(r.criterionScores['health']).toBeCloseTo(60, 5); // composite node scored
    expect(r.globalValue).toBeCloseTo(24, 5);
  });

  it('aggregate(): best profile is 100 across the whole tree', () => {
    const result = aggregate(
      evaluation(hierModel(), {
        options: [{ id: 'p1', label: 'P1', createdAt: '' }],
        performances: [
          { optionId: 'p1', criterionId: 'lat', value: 'fast' },
          { optionId: 'p1', criterionId: 'sat', value: 'low' },
          { optionId: 'p1', criterionId: 'crit', value: 'lo' },
        ],
      }),
    );
    const r = result.optionResults[0];
    expect(r.criterionScores['health']).toBeCloseTo(100, 5);
    expect(r.globalValue).toBeCloseTo(100, 5);
  });

  it('scoreProfile(): reference profile is scored through the hierarchy', () => {
    // lat=fast(100), sat=high(0) → health=60 ; crit=hi(0) → 0.4*60 = 24
    expect(scoreProfile(hierModel(), { lat: 'fast', sat: 'high', crit: 'hi' })).toBeCloseTo(24, 5);
  });
});
