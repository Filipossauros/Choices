/**
 * Changing your mind mid-elicitation.
 *
 * The weighting screen used to fix *which* criterion mattered more in a separate
 * ranking step, so a respondent who disagreed at question time was told to go
 * back and reorder a list. Now they answer where they are, and the ranking
 * follows. What these tests pin is that following the respondent is lossless:
 * every answer already given survives the reordering, re-filed — never dropped,
 * never silently changed in size.
 */
import { describe, it, expect } from 'vitest';
import { reorientJudgments, moveBefore } from '../../domain/judgments';
import type { MacbethJudgment } from '../../domain/types';

const exact = (category: 0 | 1 | 2 | 3 | 4 | 5 | 6): MacbethJudgment => ({ kind: 'exact', category });

describe('moveBefore', () => {
  it('inserts rather than swaps, so nothing jumps over the moved item', () => {
    // "I prefer C to A" with A > B > C: C goes above A, and B keeps its place
    // relative to A. A swap would have pushed A below B, which nobody claimed.
    expect(moveBefore(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
  });

  it('is a no-op when either id is absent', () => {
    expect(moveBefore(['a', 'b'], 'z', 'a')).toEqual(['a', 'b']);
    expect(moveBefore(['a', 'b'], 'a', 'z')).toEqual(['a', 'b']);
  });

  it('leaves an already-correct order alone', () => {
    expect(moveBefore(['a', 'b', 'c'], 'b', 'c')).toEqual(['a', 'b', 'c']);
  });
});

describe('reorientJudgments', () => {
  it('re-files a pair whose order flipped, keeping the category', () => {
    const out = reorientJudgments(['b', 'a'], { a__b: exact(4) });
    expect(out).toEqual({ b__a: exact(4) });
  });

  it('leaves pairs that did not flip untouched', () => {
    const out = reorientJudgments(['a', 'b', 'c'], { a__b: exact(2), b__c: exact(5) });
    expect(out).toEqual({ a__b: exact(2), b__c: exact(5) });
  });

  it('ranks ids missing from the order last, keeping the key they had', () => {
    // This is how the weighting matrix's "improve nothing" reference item stays
    // pinned to the bottom without this module knowing it exists.
    const out = reorientJudgments(['a', 'b'], { a__NEUTRAL: exact(3), b__NEUTRAL: exact(1) });
    expect(out).toEqual({ a__NEUTRAL: exact(3), b__NEUTRAL: exact(1) });
  });

  it('keeps every answer when a criterion is promoted to the top', () => {
    const order = ['seg', 'inter', 'tec'];
    const judgments = {
      seg__inter: exact(4),
      seg__tec: exact(5),
      inter__tec: exact(3),
      seg__NEUTRAL: exact(6),
      inter__NEUTRAL: exact(4),
      tec__NEUTRAL: exact(2),
    };
    // The respondent says they prefer Tecnologia to Segurança.
    const next = moveBefore(order, 'tec', 'seg');
    expect(next).toEqual(['tec', 'seg', 'inter']);

    const out = reorientJudgments(next, judgments);
    expect(Object.keys(out)).toHaveLength(Object.keys(judgments).length);
    // Both pairs involving `tec` flip — "tec beats seg, and seg beat inter" ⟹
    // tec beats inter too — and each keeps the size it was given.
    expect(out.tec__seg).toEqual(exact(5));
    expect(out.tec__inter).toEqual(exact(3));
    // The pair the respondent did not touch is unchanged.
    expect(out.seg__inter).toEqual(exact(4));
    // Reference comparisons never flip.
    expect(out.tec__NEUTRAL).toEqual(exact(2));
  });
});
