/**
 * ROC weight simulation, direct-weight inversion, and the category ladder.
 * Simulated judgments must be usable as a real starting point — i.e. consistent
 * under the same LP as elicited ones — and must never flatten a ranking the
 * user actually gave.
 */
import { describe, it, expect } from 'vitest';
import { rocWeights, simulateWeighting, judgmentsFromWeights } from '../simulate';
import { deriveWeights, ALL_NEUTRAL } from '../weighting';
import { categoryForRatio, categoryLabel, CATEGORIES } from '../../domain/categories';

describe('rocWeights', () => {
  it('sums to 1 and decreases with rank', () => {
    for (const n of [1, 2, 3, 5, 8]) {
      const w = rocWeights(n);
      expect(w).toHaveLength(n);
      expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
      for (let i = 1; i < n; i++) expect(w[i]).toBeLessThan(w[i - 1]);
    }
  });

  it('matches the textbook centroid for n = 3', () => {
    // w1 = (1 + 1/2 + 1/3)/3, w2 = (1/2 + 1/3)/3, w3 = (1/3)/3
    const [a, b, c] = rocWeights(3);
    expect(a).toBeCloseTo(0.6111, 3);
    expect(b).toBeCloseTo(0.2778, 3);
    expect(c).toBeCloseTo(0.1111, 3);
  });

  it('gives a single criterion all the weight, and nothing for none', () => {
    expect(rocWeights(1)).toEqual([1]);
    expect(rocWeights(0)).toEqual([]);
  });
});

describe('simulateWeighting', () => {
  it('covers every pair plus the all-neutral reference', () => {
    const { judgments, suggestedKeys } = simulateWeighting(['a', 'b', 'c']);
    // 3 criterion pairs + 3 comparisons against the reference
    expect(Object.keys(judgments)).toHaveLength(6);
    expect(suggestedKeys).toHaveLength(6);
    expect(judgments['a__b']).toBeDefined();
    expect(judgments['a__c']).toBeDefined();
    expect(judgments['b__c']).toBeDefined();
    expect(judgments[`a__${ALL_NEUTRAL}`]).toBeDefined();
  });

  it('never flattens the ranking to indifference', () => {
    const { judgments } = simulateWeighting(['a', 'b', 'c', 'd', 'e']);
    for (const j of Object.values(judgments)) {
      expect(j.kind).toBe('exact');
      if (j.kind === 'exact') expect(j.category).toBeGreaterThanOrEqual(1);
    }
  });

  it('keeps the ranking order: a wider rank gap means a bigger category', () => {
    const { judgments } = simulateWeighting(['a', 'b', 'c']);
    const cat = (k: string) => {
      const j = judgments[k];
      return j.kind === 'exact' ? j.category : j.lo;
    };
    expect(cat('a__c')).toBeGreaterThanOrEqual(cat('a__b'));
  });

  it('produces judgments the real LP accepts as consistent', async () => {
    const ids = ['a', 'b', 'c'];
    const { judgments } = simulateWeighting(ids);
    const w = await deriveWeights(ids, judgments);
    expect(w.consistencyMargin).toBeGreaterThan(0);
    expect(w.weights.reduce((s, x) => s + x.weight, 0)).toBeCloseTo(1, 1);
    // The derived order must still match the ranking that seeded it.
    const byId = Object.fromEntries(w.weights.map((x) => [x.criterionId, x.weight]));
    expect(byId.a).toBeGreaterThan(byId.b);
    expect(byId.b).toBeGreaterThan(byId.c);
  });

  it('handles an empty ranking', () => {
    const r = simulateWeighting([]);
    expect(r.judgments).toEqual({});
    expect(r.weights).toEqual([]);
  });
});

describe('judgmentsFromWeights', () => {
  it('reads dragged weights back as MACBETH judgments in rank order', () => {
    const j = judgmentsFromWeights(['a', 'b', 'c'], { a: 0.5, b: 0.3, c: 0.2 });
    expect(j['a__b']).toBeDefined();
    expect(j['a__c']).toBeDefined();
    expect(j['b__c']).toBeDefined();
    const cat = (k: string) => { const x = j[k]; return x.kind === 'exact' ? x.category : x.lo; };
    // a–c is a wider gap than a–b, so it cannot be the smaller category
    expect(cat('a__c')).toBeGreaterThanOrEqual(cat('a__b'));
  });

  it('orders pairs by weight even when the id order disagrees', () => {
    const j = judgmentsFromWeights(['a', 'b'], { a: 0.2, b: 0.8 });
    // b outweighs a, so b must be the more-attractive side of the key
    expect(j['b__a']).toBeDefined();
    expect(j['a__b']).toBeUndefined();
  });

  it('treats equal weights as indifference between the pair', () => {
    const j = judgmentsFromWeights(['a', 'b'], { a: 0.5, b: 0.5 });
    const x = j['a__b'] ?? j['b__a'];
    expect(x.kind === 'exact' && x.category).toBe(0);
  });
});

describe('category ladder', () => {
  it('names the seven categories in a strictly growing staircase', () => {
    expect(CATEGORIES).toHaveLength(7);
    expect(CATEGORIES.map((c) => c.label)).toEqual([
      'Nula', 'Muito baixa', 'Baixa', 'Moderada', 'Elevada', 'Muito elevada', 'Extrema',
    ]);
    for (let i = 1; i < CATEGORIES.length; i++) {
      expect(CATEGORIES[i].weight).toBeGreaterThan(CATEGORIES[i - 1].weight);
      expect(CATEGORIES[i].value).toBe(i);
    }
    expect(categoryLabel(4)).toBe('Elevada');
  });

  it('maps a ratio to a category monotonically, with the extremes pinned', () => {
    expect(categoryForRatio(0, 100)).toBe(0);
    expect(categoryForRatio(100, 100)).toBe(6);
    let prev = -1;
    for (let r = 0; r <= 100; r += 5) {
      const c = categoryForRatio(r, 100);
      expect(c).toBeGreaterThanOrEqual(prev);
      prev = c;
    }
  });

  it('is sign-insensitive and safe on a zero span', () => {
    expect(categoryForRatio(-50, 100)).toBe(categoryForRatio(50, 100));
    expect(categoryForRatio(10, 0)).toBe(0);
  });
});
