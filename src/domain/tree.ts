/**
 * Value-tree traversal and weight helpers for hierarchical criteria.
 *
 * The tree is `model.valueTree.root` (an implicit composite with id ROOT_ID)
 * whose `children` are ValueTreeNodes. Every node references a Criterion in
 * `model.valueTree.criteria` (except the root, which is implicit). Composite
 * criteria are internal nodes that aggregate their children; gate and
 * qualification criteria are leaves.
 *
 * Weights live per group: the root group's weights are `model.weights`; each
 * composite's children weights are `model.subWeights[compositeId]`. The
 * *effective* weight of a leaf is the product of the group weights along its
 * path from the root — and, because every group sums to 1, the effective
 * weights of all leaves also sum to 1.
 */

import type {
  EvaluationModel,
  ValueTree,
  ValueTreeNode,
  Criterion,
  QualificationCriterion,
  Weights,
} from './types';
import { ROOT_ID } from './types';

// ─── Lookups ─────────────────────────────────────────────────────────────────

/** Find a node by criterion id (depth-first), including the root. */
export function findNode(tree: ValueTree, id: string): ValueTreeNode | null {
  function walk(node: ValueTreeNode): ValueTreeNode | null {
    if (node.criterionId === id) return node;
    for (const c of node.children) {
      const hit = walk(c);
      if (hit) return hit;
    }
    return null;
  }
  return walk(tree.root);
}

/** The id of the parent group of a criterion (ROOT_ID for top-level), or null. */
export function parentOf(tree: ValueTree, id: string): string | null {
  function walk(node: ValueTreeNode): string | null {
    for (const c of node.children) {
      if (c.criterionId === id) return node.criterionId;
      const hit = walk(c);
      if (hit) return hit;
    }
    return null;
  }
  return walk(tree.root);
}

/** Labels from the root (exclusive) down to — and excluding — the given id. */
export function ancestorLabels(model: EvaluationModel, id: string): string[] {
  const { criteria } = model.valueTree;
  const labels: string[] = [];
  let current = parentOf(model.valueTree, id);
  while (current && current !== ROOT_ID) {
    labels.unshift(criteria[current]?.label ?? current);
    current = parentOf(model.valueTree, current);
  }
  return labels;
}

/** True when the node is a leaf (no children) — i.e. gate or qualification. */
export function isLeafNode(node: ValueTreeNode): boolean {
  return node.children.length === 0;
}

// ─── Collections ─────────────────────────────────────────────────────────────

/** All qualification criteria anywhere in the tree (the scorable leaves). */
export function qualificationCriteria(model: EvaluationModel): QualificationCriterion[] {
  return Object.values(model.valueTree.criteria).filter(
    (c): c is QualificationCriterion => c.type === 'qualification',
  );
}

export interface Group {
  /** Parent node id (ROOT_ID for the top-level group). */
  parentId: string;
  /** Breadcrumb-style label ("HealthStatus" or "Fatores de topo" for root). */
  label: string;
  /** Depth from the root (0 = root group). */
  depth: number;
  /** Direct children that participate in weighting (excludes gates). */
  childIds: string[];
}

/**
 * Every weighting group in pre-order (root first): the root plus each composite
 * node. Gate children are excluded — gates are eliminatory, not weighted.
 */
export function weightingGroups(model: EvaluationModel): Group[] {
  const { criteria } = model.valueTree;
  const groups: Group[] = [];
  function walk(node: ValueTreeNode, depth: number) {
    const isRoot = node.criterionId === ROOT_ID;
    const crit = criteria[node.criterionId];
    if (isRoot || crit?.type === 'composite') {
      const childIds = node.children
        .filter((c) => criteria[c.criterionId]?.type !== 'gate')
        .map((c) => c.criterionId);
      groups.push({
        parentId: node.criterionId,
        label: isRoot ? 'Fatores de topo' : crit?.label ?? node.criterionId,
        depth,
        childIds,
      });
    }
    for (const c of node.children) walk(c, depth + 1);
  }
  walk(model.valueTree.root, 0);
  return groups;
}

// ─── Weights ─────────────────────────────────────────────────────────────────

/** The Weights for a group (root → model.weights, composite → subWeights[id]). */
export function weightsForGroup(model: EvaluationModel, parentId: string): Weights | undefined {
  return parentId === ROOT_ID ? model.weights : model.subWeights?.[parentId];
}

/** Immutable patch that stores a group's derived weights in the right slot. */
export function setGroupWeights(
  model: EvaluationModel,
  parentId: string,
  weights: Weights,
): Partial<EvaluationModel> {
  if (parentId === ROOT_ID) return { weights };
  return { subWeights: { ...(model.subWeights ?? {}), [parentId]: weights } };
}

/** True when this group has its weights derived and consistent (z > 0). */
export function groupConsistent(model: EvaluationModel, group: Group): boolean {
  if (group.childIds.length === 0) return true;
  if (group.childIds.length === 1) return true; // trivial: single child = 100%
  const w = weightsForGroup(model, group.parentId);
  return !!w && w.consistencyMargin > 0;
}

/** True when every weighting group in the tree is consistent. */
export function allGroupsConsistent(model: EvaluationModel): boolean {
  const groups = weightingGroups(model);
  const scorable = groups.filter((g) => g.childIds.length > 0);
  if (scorable.length === 0) return false;
  return scorable.every((g) => groupConsistent(model, g));
}

/** What a model still needs before it can score anything. */
export interface ModelReadiness {
  /** Every qualification criterion has a consistent scale and every group has weights. */
  ready: boolean;
  hasCriteria: boolean;
  scalesReady: boolean;
  weightsReady: boolean;
  /** Labels of qualification criteria whose scale is missing or inconsistent. */
  pendingScales: string[];
}

/**
 * Whether a model can produce results. Evaluations embed a *snapshot* of the
 * model, so starting one from a model that is not ready produces an evaluation
 * that can never be aggregated — callers use this to warn before that happens.
 */
export function modelReadiness(model: EvaluationModel): ModelReadiness {
  const quals = qualificationCriteria(model);
  const pendingScales = quals
    .filter((c) => !model.derivedScales.some((s) => s.criterionId === c.id && s.consistencyMargin > 0))
    .map((c) => c.label);
  const hasCriteria = quals.length > 0;
  const scalesReady = hasCriteria && pendingScales.length === 0;
  const weightsReady = allGroupsConsistent(model);
  return {
    ready: hasCriteria && scalesReady && weightsReady,
    hasCriteria,
    scalesReady,
    weightsReady,
    pendingScales,
  };
}

/**
 * Effective (global) weight of a group *node itself* — the product of group
 * weights from the root down to `parentId`. ROOT_ID → 1. A single-child group
 * on the path contributes a factor of 1. Returns null when an ancestor group on
 * the path has no derived weights yet (the global weight is then undefined).
 *
 * Multiplying this by a child's local weight gives that child's global weight in
 * the model — letting the weighting UI show "local vs. global" side by side.
 */
export function groupEffectiveWeight(model: EvaluationModel, parentId: string): number | null {
  const { criteria } = model.valueTree;
  let factor = 1;
  let current = parentId;
  while (current !== ROOT_ID) {
    const parent = parentOf(model.valueTree, current);
    if (parent == null) return null;
    const siblings = (findNode(model.valueTree, parent)?.children ?? []).filter(
      (c) => criteria[c.criterionId]?.type !== 'gate',
    );
    if (siblings.length > 1) {
      const cw = weightsForGroup(model, parent)?.weights.find((x) => x.criterionId === current)?.weight;
      if (cw == null) return null; // ancestor group not derived yet
      factor *= cw;
    }
    current = parent;
  }
  return factor;
}

/**
 * Effective (global) weight of every qualification leaf: the product of group
 * weights along its path to the root. The returned map sums to ~1 over all
 * leaves. A group with a single child contributes a factor of 1.
 */
export function effectiveWeights(model: EvaluationModel): Map<string, number> {
  const { criteria } = model.valueTree;
  const out = new Map<string, number>();
  function walk(node: ValueTreeNode, acc: number) {
    const crit = criteria[node.criterionId];
    const isGroup = node.criterionId === ROOT_ID || crit?.type === 'composite';
    if (isGroup) {
      const w = weightsForGroup(model, node.criterionId);
      const wmap = new Map((w?.weights ?? []).map((x) => [x.criterionId, x.weight]));
      const nonGate = node.children.filter((c) => criteria[c.criterionId]?.type !== 'gate');
      for (const child of node.children) {
        if (criteria[child.criterionId]?.type === 'gate') continue;
        // Single-child group: weight is trivially 1.
        const cw = nonGate.length === 1 ? 1 : wmap.get(child.criterionId) ?? 0;
        walk(child, acc * cw);
      }
    } else if (crit?.type === 'qualification') {
      out.set(node.criterionId, acc);
    }
  }
  walk(model.valueTree.root, 1);
  return out;
}

// ─── Tree mutations (pure) ───────────────────────────────────────────────────

function mapNode(node: ValueTreeNode, fn: (n: ValueTreeNode) => ValueTreeNode): ValueTreeNode {
  const mapped = fn(node);
  return { ...mapped, children: mapped.children.map((c) => mapNode(c, fn)) };
}

/** Add a child node under `parentId`. Returns a new tree. */
export function addChild(tree: ValueTree, parentId: string, criterion: Criterion): ValueTree {
  const root = mapNode(tree.root, (n) =>
    n.criterionId === parentId
      ? { ...n, children: [...n.children, { criterionId: criterion.id, children: [] }] }
      : n,
  );
  return { root, criteria: { ...tree.criteria, [criterion.id]: criterion } };
}

/** Update a criterion's definition in place (no structural change). */
export function updateCriterion(tree: ValueTree, criterion: Criterion): ValueTree {
  return { ...tree, criteria: { ...tree.criteria, [criterion.id]: criterion } };
}

/**
 * Move a child to a new position within the same parent group. `toIndex` is the
 * target slot in the list *after* the item is lifted out, so moving down by one
 * means `toIndex === fromIndex + 1` is a no-op — callers should pass the final
 * intended index. Purely presentational: weights and judgments are keyed by
 * criterion id, so sibling order carries no model meaning.
 */
export function reorderChild(
  tree: ValueTree,
  parentId: string,
  fromIndex: number,
  toIndex: number,
): ValueTree {
  const root = mapNode(tree.root, (n) => {
    if (n.criterionId !== parentId) return n;
    if (fromIndex < 0 || fromIndex >= n.children.length) return n;
    const children = [...n.children];
    const [moved] = children.splice(fromIndex, 1);
    children.splice(Math.max(0, Math.min(toIndex, children.length)), 0, moved);
    return { ...n, children };
  });
  return { ...tree, root };
}

/** Remove a node and its whole subtree; prunes orphaned criteria entries. */
export function removeNode(tree: ValueTree, id: string): ValueTree {
  function strip(node: ValueTreeNode): ValueTreeNode {
    return { ...node, children: node.children.filter((c) => c.criterionId !== id).map(strip) };
  }
  const root = strip(tree.root);
  // Collect ids still present, drop the rest from the criteria map.
  const live = new Set<string>();
  (function collect(n: ValueTreeNode) {
    if (n.criterionId !== ROOT_ID) live.add(n.criterionId);
    n.children.forEach(collect);
  })(root);
  const criteria = Object.fromEntries(
    Object.entries(tree.criteria).filter(([cid]) => live.has(cid)),
  );
  return { root, criteria };
}
