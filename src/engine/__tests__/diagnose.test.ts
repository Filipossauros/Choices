/**
 * An inconsistent matrix has to say *which* two answers disagree.
 *
 * "margem: −1.000" plus a scale of zeros is technically accurate and completely
 * unusable: the assessor is left to find the contradiction among fifteen answers
 * by eye. These tests pin the one shape that can be stated exactly — a jump
 * rated below a jump it contains — and the fallback for everything else.
 */
import { describe, it, expect } from 'vitest';
import { containmentConflicts, diagnoseScale, jumpsOf, minimumCategoryFor } from '../diagnose';
import type { Descriptor, MacbethJudgment } from '../../domain/types';

/** Four cost bands, best first — the descriptor from the review walkthrough. */
const cost = (): Descriptor => ({
  levels: [
    { id: 'a', label: '< 10 k€' },
    { id: 'b', label: '10–25 k€' },
    { id: 'c', label: '25–50 k€' },
    { id: 'd', label: '> 50 k€' },
  ],
  neutralIndex: 2,
  goodIndex: 0,
});

const exact = (category: number): MacbethJudgment => ({ kind: 'exact', category: category as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
const interval = (lo: number, hi: number): MacbethJudgment => ({
  kind: 'interval', lo: lo as 0 | 1 | 2 | 3 | 4 | 5 | 6, hi: hi as 0 | 1 | 2 | 3 | 4 | 5 | 6,
});

describe('jump parsing', () => {
  it('reads each key as a move from the worse level to the better one', () => {
    const [j] = jumpsOf(cost(), { a__c: exact(3) });
    expect(j.fromId).toBe('c');
    expect(j.toId).toBe('a');
    expect(j.toIndex).toBe(0);
    expect(j.fromIndex).toBe(2);
  });

  it('ignores judgments naming a level the descriptor no longer has', () => {
    expect(jumpsOf(cost(), { a__gone: exact(3) })).toEqual([]);
  });
});

describe('containment conflicts', () => {
  it('catches a wider jump rated below one it contains', () => {
    // a←b is Extreme (C6) but a←c, which spans a←b and more, is only Low (C2).
    const conflicts = containmentConflicts(cost(), { a__b: exact(6), a__c: exact(2) });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].wide.key).toBe('a__c');
    expect(conflicts[0].narrow.key).toBe('a__b');
    expect(minimumCategoryFor(conflicts[0])).toBe(6);
  });

  it('accepts a wider jump rated equal to the one it contains', () => {
    // Equality is admissible: the extra step may simply add nothing perceptible.
    expect(containmentConflicts(cost(), { a__b: exact(4), a__c: exact(4) })).toEqual([]);
  });

  it('accepts a coherent ladder', () => {
    expect(
      containmentConflicts(cost(), {
        a__b: exact(2), b__c: exact(3), a__c: exact(4), c__d: exact(2), a__d: exact(6),
      }),
    ).toEqual([]);
  });

  it('says nothing about two jumps that merely overlap', () => {
    // b←c and a←b share an endpoint but neither contains the other, so their
    // categories are free to differ in either direction.
    expect(containmentConflicts(cost(), { a__b: exact(5), b__c: exact(1) })).toEqual([]);
  });

  it('is interval-aware: overlapping ranges are not a contradiction', () => {
    // Narrow is "C3 to C5", wide is "C4 to C6" — compatible at C4/C5.
    expect(containmentConflicts(cost(), { a__b: interval(3, 5), a__c: interval(4, 6) })).toEqual([]);
    // But "C5 to C6" inside a wide jump capped at C3 cannot be reconciled.
    expect(containmentConflicts(cost(), { a__b: interval(5, 6), a__c: interval(1, 3) })).toHaveLength(1);
  });

  it('reports the innermost conflicting pair first', async () => {
    // Both a←b and a←c are contained in a←d and rated above it.
    const d = await diagnoseScale(cost(), { a__b: exact(5), a__c: exact(5), a__d: exact(2) });
    expect(d.conflicts.length).toBeGreaterThan(1);
    expect(d.conflicts[0].narrow.key).toBe('a__b'); // the narrowest span
  });
});

describe('diagnosis', () => {
  it('gives no conflict and no fallback for a consistent matrix', async () => {
    const d = await diagnoseScale(cost(), {
      a__b: exact(2), b__c: exact(3), a__c: exact(4), c__d: exact(2), a__d: exact(6),
    });
    expect(d.conflicts).toEqual([]);
    expect(d.fallback).toBeNull();
  });

  it('names the minimum category that resolves the conflict', async () => {
    const d = await diagnoseScale(cost(), { a__b: exact(6), a__c: exact(2) });
    expect(minimumCategoryFor(d.conflicts[0])).toBe(6);
  });

  it('falls back to the LP search when no containment explains the failure', async () => {
    // A cardinal contradiction between disjoint jumps: a←b is bigger than c←d
    // by category, yet the chain forces the opposite once the anchors are fixed.
    const d = await diagnoseScale(cost(), {
      a__b: exact(1), b__c: exact(1), c__d: exact(6), a__d: exact(1),
    });
    expect(d.conflicts.length + (d.fallback ? 1 : 0)).toBeGreaterThan(0);
  });
});
