/**
 * Reusable sub-models and model robustness.
 *
 * `insertSubtree` is the one operation here that can corrupt a model, so these
 * tests pin the invariants that matter: no id collisions with the host, no
 * collisions between two imports of the same source, and derived scales that
 * still resolve after the remap.
 */
import { describe, it, expect } from 'vitest';
import { insertSubtree, modelRobustness, findNode, qualificationCriteria } from '../../domain/tree';
import type { EvaluationModel, ValueTree } from '../../domain/types';
import { MODEL_VERSION, ROOT_ID } from '../../domain/types';

let counter = 0;
const newId = () => `gen-${++counter}`;

const descriptor = () => ({
  levels: [{ id: 'hi', label: 'Alto' }, { id: 'lo', label: 'Baixo' }],
  neutralIndex: 1,
  goodIndex: 0,
});

function base(over: Partial<EvaluationModel> = {}): EvaluationModel {
  return {
    kind: 'model',
    id: 'm',
    modelVersion: MODEL_VERSION,
    label: 'Host',
    createdAt: '',
    updatedAt: '',
    valueTree: { root: { criterionId: ROOT_ID, children: [] }, criteria: {} },
    judgmentMatrices: [],
    derivedScales: [],
    decisionScale: [],
    ...over,
  };
}

/** A standalone model: one factor with two scored children, scales derived. */
function source(): EvaluationModel {
  const valueTree: ValueTree = {
    root: {
      criterionId: ROOT_ID,
      children: [
        { criterionId: 'mat', children: [] },
        { criterionId: 'sup', children: [] },
      ],
    },
    criteria: {
      mat: { id: 'mat', label: 'Maturidade', type: 'qualification', descriptor: descriptor() },
      sup: { id: 'sup', label: 'Suporte', type: 'qualification', descriptor: descriptor() },
    },
  };
  return base({
    id: 'src',
    label: 'Obsolescência tecnológica',
    valueTree,
    derivedScales: [
      {
        criterionId: 'mat',
        values: [
          { levelId: 'hi', value: 100, admissibleRange: [100, 100] },
          { levelId: 'lo', value: 0, admissibleRange: [0, 0] },
        ],
        consistencyMargin: 1,
        derivedAt: '',
      },
    ],
    weights: {
      weights: [
        { criterionId: 'mat', weight: 0.6, admissibleRange: [0.6, 0.6] },
        { criterionId: 'sup', weight: 0.4, admissibleRange: [0.4, 0.4] },
      ],
      consistencyMargin: 1,
      derivedAt: '',
    },
  });
}

/** A host that already owns a criterion, to prove imports do not clash. */
function host(): EvaluationModel {
  return base({
    valueTree: {
      root: { criterionId: ROOT_ID, children: [{ criterionId: 'seg', children: [] }] },
      criteria: { seg: { id: 'seg', label: 'Segurança', type: 'qualification', descriptor: descriptor() } },
    },
  });
}

describe('insertSubtree', () => {
  it('grafts the source as one factor named after the model', () => {
    const patch = insertSubtree(host(), ROOT_ID, source(), newId);
    const tree = patch.valueTree!;
    expect(tree.root.children).toHaveLength(2);
    const added = tree.root.children[1];
    const factor = tree.criteria[added.criterionId];
    expect(factor.type).toBe('composite');
    expect(factor.label).toBe('Obsolescência tecnológica');
    expect(added.children).toHaveLength(2);
  });

  it('regenerates every id, keeping the host untouched', () => {
    const h = host();
    const patch = insertSubtree(h, ROOT_ID, source(), newId);
    const tree = patch.valueTree!;
    expect(tree.criteria.seg).toBeDefined();          // host criterion survives
    expect(tree.criteria.mat).toBeUndefined();        // source ids are gone
    expect(tree.criteria.sup).toBeUndefined();
    expect(h.valueTree.root.children).toHaveLength(1); // input not mutated
  });

  it('lets the same source be imported twice without collisions', () => {
    const once = insertSubtree(host(), ROOT_ID, source(), newId);
    const twice = insertSubtree(
      { ...host(), ...once } as EvaluationModel,
      ROOT_ID,
      source(),
      newId,
    );
    const tree = twice.valueTree!;
    expect(tree.root.children).toHaveLength(3);
    const ids = Object.keys(tree.criteria);
    expect(new Set(ids).size).toBe(ids.length);
    // Four imported qualification criteria (two per import) plus the host's.
    expect(qualificationCriteria({ ...host(), ...twice } as EvaluationModel)).toHaveLength(5);
  });

  it('carries derived scales across, remapped so they still resolve', () => {
    const patch = insertSubtree(host(), ROOT_ID, source(), newId);
    const model = { ...host(), ...patch } as EvaluationModel;
    const imported = model.derivedScales.find((s) => s.criterionId !== 'seg');
    expect(imported).toBeDefined();
    const crit = model.valueTree.criteria[imported!.criterionId];
    expect(crit.type).toBe('qualification');
    if (crit.type === 'qualification') {
      // Every scale entry must name a level that exists on the new descriptor.
      for (const v of imported!.values) {
        expect(crit.descriptor.levels.some((l) => l.id === v.levelId)).toBe(true);
      }
    }
  });

  it("remaps the source's own weights onto the new factor's group", () => {
    const patch = insertSubtree(host(), ROOT_ID, source(), newId);
    const tree = patch.valueTree!;
    const factorId = tree.root.children[1].criterionId;
    const group = patch.subWeights?.[factorId];
    expect(group).toBeDefined();
    const childIds = tree.root.children[1].children.map((c) => c.criterionId);
    for (const cw of group!.weights) expect(childIds).toContain(cw.criterionId);
  });

  it('can graft under a composite, not just the root', () => {
    const h = base({
      valueTree: {
        root: { criterionId: ROOT_ID, children: [{ criterionId: 'arq', children: [] }] },
        criteria: { arq: { id: 'arq', label: 'Arquitetura', type: 'composite' } },
      },
    });
    const patch = insertSubtree(h, 'arq', source(), newId);
    const node = findNode(patch.valueTree!, 'arq')!;
    expect(node.children).toHaveLength(1);
  });
});

describe('modelRobustness', () => {
  const weights = (lo: number, hi: number) => ({
    weights: [
      { criterionId: 'a', weight: 0.5, admissibleRange: [lo, hi] as [number, number] },
      { criterionId: 'b', weight: 0.5, admissibleRange: [lo, hi] as [number, number] },
    ],
    consistencyMargin: 1,
    derivedAt: '',
  });
  const twoCrit = (): ValueTree => ({
    root: {
      criterionId: ROOT_ID,
      children: [{ criterionId: 'a', children: [] }, { criterionId: 'b', children: [] }],
    },
    criteria: {
      a: { id: 'a', label: 'A', type: 'qualification', descriptor: descriptor() },
      b: { id: 'b', label: 'B', type: 'qualification', descriptor: descriptor() },
    },
  });

  it('marks a wide admissible range as loose and a narrow one as firm', () => {
    const loose = modelRobustness(base({ valueTree: twoCrit(), weights: weights(0.05, 0.9) }));
    expect(loose.weights.every((w) => w.loose)).toBe(true);

    const firm = modelRobustness(base({ valueTree: twoCrit(), weights: weights(0.47, 0.53) }));
    expect(firm.weights.every((w) => w.loose)).toBe(false);
  });

  it('scores determination higher when the judgments pin more down', () => {
    const loose = modelRobustness(base({ valueTree: twoCrit(), weights: weights(0.05, 0.9) }));
    const firm = modelRobustness(base({ valueTree: twoCrit(), weights: weights(0.47, 0.53) }));
    expect(firm.determination).toBeGreaterThan(loose.determination);
    expect(firm.determination).toBeLessThanOrEqual(1);
    expect(loose.determination).toBeGreaterThanOrEqual(0);
  });

  it('ignores anchored scale levels, which are pinned by construction', () => {
    const r = modelRobustness(
      base({
        valueTree: twoCrit(),
        weights: weights(0.5, 0.5),
        derivedScales: [{
          criterionId: 'a',
          values: [
            { levelId: 'hi', value: 100, admissibleRange: [100, 100] },
            { levelId: 'lo', value: 0, admissibleRange: [0, 0] },
          ],
          consistencyMargin: 1,
          derivedAt: '',
        }],
      }),
    );
    expect(r.scales).toHaveLength(0);
  });

  it('reports nothing, and no determination, for an empty model', () => {
    const r = modelRobustness(base());
    expect(r.weights).toEqual([]);
    expect(r.determination).toBe(0);
  });
});
