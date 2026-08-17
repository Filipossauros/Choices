/**
 * Sibling reordering in the value tree. Order is presentational — weights and
 * judgments are keyed by criterion id — so these tests pin the mechanics
 * (position, subtree integrity, bounds) rather than any model semantics.
 */
import { describe, it, expect } from 'vitest';
import { reorderChild, findNode } from '../../domain/tree';
import type { ValueTree } from '../../domain/types';
import { ROOT_ID } from '../../domain/types';

/** root → [a, f(→ f1, f2), b] */
function tree(): ValueTree {
  return {
    root: {
      criterionId: ROOT_ID,
      children: [
        { criterionId: 'a', children: [] },
        {
          criterionId: 'f',
          children: [
            { criterionId: 'f1', children: [] },
            { criterionId: 'f2', children: [] },
          ],
        },
        { criterionId: 'b', children: [] },
      ],
    },
    criteria: {
      a: { id: 'a', label: 'A', type: 'gate' },
      b: { id: 'b', label: 'B', type: 'gate' },
      f: { id: 'f', label: 'F', type: 'composite' },
      f1: { id: 'f1', label: 'F1', type: 'gate' },
      f2: { id: 'f2', label: 'F2', type: 'gate' },
    },
  };
}

const order = (t: ValueTree, parentId: string) =>
  (findNode(t, parentId)?.children ?? []).map((c) => c.criterionId);

describe('reorderChild', () => {
  it('moves a top-level child down', () => {
    expect(order(reorderChild(tree(), ROOT_ID, 0, 2), ROOT_ID)).toEqual(['f', 'b', 'a']);
  });

  it('moves a top-level child up', () => {
    expect(order(reorderChild(tree(), ROOT_ID, 2, 0), ROOT_ID)).toEqual(['b', 'a', 'f']);
  });

  it('reorders inside a composite without touching the root order', () => {
    const next = reorderChild(tree(), 'f', 1, 0);
    expect(order(next, 'f')).toEqual(['f2', 'f1']);
    expect(order(next, ROOT_ID)).toEqual(['a', 'f', 'b']);
  });

  it('carries the moved subtree with it', () => {
    const next = reorderChild(tree(), ROOT_ID, 1, 0);
    expect(order(next, ROOT_ID)).toEqual(['f', 'a', 'b']);
    expect(order(next, 'f')).toEqual(['f1', 'f2']);
  });

  it('clamps an out-of-range destination to the end', () => {
    expect(order(reorderChild(tree(), ROOT_ID, 0, 99), ROOT_ID)).toEqual(['f', 'b', 'a']);
  });

  it('ignores an out-of-range source and an unknown parent', () => {
    expect(order(reorderChild(tree(), ROOT_ID, 7, 0), ROOT_ID)).toEqual(['a', 'f', 'b']);
    expect(order(reorderChild(tree(), 'nope', 0, 1), ROOT_ID)).toEqual(['a', 'f', 'b']);
  });

  it('does not mutate the input tree', () => {
    const original = tree();
    reorderChild(original, ROOT_ID, 0, 2);
    expect(order(original, ROOT_ID)).toEqual(['a', 'f', 'b']);
  });

  it('leaves the criteria map untouched', () => {
    const next = reorderChild(tree(), ROOT_ID, 0, 2);
    expect(Object.keys(next.criteria).sort()).toEqual(['a', 'b', 'f', 'f1', 'f2']);
  });
});
