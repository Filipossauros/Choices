import { describe, it, expect } from 'vitest';
import { deriveWeights, ALL_NEUTRAL } from '../weighting';
import type { MacbethJudgment } from '../../domain/types';

function j(category: 0 | 1 | 2 | 3 | 4 | 5 | 6): MacbethJudgment {
  return { kind: 'exact', category };
}

describe('deriveWeights', () => {
  it('empty criteria returns zero-length weights immediately', async () => {
    const r = await deriveWeights([], {});
    expect(r.weights).toHaveLength(0);
    expect(r.consistencyMargin).toBe(0);
  });

  it('single criterion always gets normalised weight = 1', async () => {
    const judgments: Record<string, MacbethJudgment> = {
      [`c1__${ALL_NEUTRAL}`]: j(3),
    };
    const r = await deriveWeights(['c1'], judgments);
    expect(r.weights).toHaveLength(1);
    expect(r.weights[0].criterionId).toBe('c1');
    expect(r.weights[0].weight).toBeCloseTo(1, 5);
  });

  it('weights always sum to 1', async () => {
    const judgments: Record<string, MacbethJudgment> = {
      [`c1__c2`]: j(2),
      [`c1__${ALL_NEUTRAL}`]: j(4),
      [`c2__${ALL_NEUTRAL}`]: j(2),
    };
    const r = await deriveWeights(['c1', 'c2'], judgments);
    const total = r.weights.reduce((s, w) => s + w.weight, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it('criterion judged more attractive than another gets a higher weight', async () => {
    // c1 is strongly preferred over c2 (C4 vs C2 swing from neutral)
    const judgments: Record<string, MacbethJudgment> = {
      [`c1__c2`]: j(3),
      [`c1__${ALL_NEUTRAL}`]: j(5),
      [`c2__${ALL_NEUTRAL}`]: j(2),
    };
    const r = await deriveWeights(['c1', 'c2'], judgments);
    const w1 = r.weights.find((w) => w.criterionId === 'c1')!.weight;
    const w2 = r.weights.find((w) => w.criterionId === 'c2')!.weight;
    expect(w1).toBeGreaterThan(w2);
  });

  it('consistency margin > 0 for consistent swing judgments', async () => {
    const judgments: Record<string, MacbethJudgment> = {
      [`c1__c2`]: j(3),
      [`c1__${ALL_NEUTRAL}`]: j(5),
      [`c2__${ALL_NEUTRAL}`]: j(2),
    };
    const r = await deriveWeights(['c1', 'c2'], judgments);
    expect(r.consistencyMargin).toBeGreaterThan(0);
  });

  it('three criteria: ordering preserved relative to all-neutral swings', async () => {
    // c1 (C5) > c2 (C3) > c3 (C1) in swing attractiveness
    const judgments: Record<string, MacbethJudgment> = {
      [`c1__c2`]: j(3),
      [`c1__c3`]: j(5),
      [`c2__c3`]: j(3),
      [`c1__${ALL_NEUTRAL}`]: j(5),
      [`c2__${ALL_NEUTRAL}`]: j(3),
      [`c3__${ALL_NEUTRAL}`]: j(1),
    };
    const r = await deriveWeights(['c1', 'c2', 'c3'], judgments);
    const w1 = r.weights.find((w) => w.criterionId === 'c1')!.weight;
    const w2 = r.weights.find((w) => w.criterionId === 'c2')!.weight;
    const w3 = r.weights.find((w) => w.criterionId === 'c3')!.weight;
    expect(w1).toBeGreaterThan(w2);
    expect(w2).toBeGreaterThan(w3);
  });
});
