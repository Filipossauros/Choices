import { describe, it, expect } from 'vitest';
import { deriveScale } from '../scaling';
import type { Descriptor, JudgmentMatrix } from '../../domain/types';

function desc(ids: string[], neutralIdx: number, goodIdx: number): Descriptor {
  return {
    levels: ids.map((id) => ({ id, label: id })),
    neutralIndex: neutralIdx,
    goodIndex: goodIdx,
  };
}

function matrix(
  judgments: Record<string, { kind: 'exact'; category: 0 | 1 | 2 | 3 | 4 | 5 | 6 }>,
): JudgmentMatrix {
  return {
    id: 'test',
    kind: 'scale',
    assessorId: 'assessor-default',
    judgments,
    updatedAt: new Date().toISOString(),
  };
}

describe('MACBETH scale derivation', () => {
  it('anchors: Neutral = 0 and Good = 100', async () => {
    // Levels (best→worst): G, N, W  with neutral=N(idx1), good=G(idx0)
    const d = desc(['G', 'N', 'W'], 1, 0);
    const m = matrix({
      'G__N': { kind: 'exact', category: 3 },
      'G__W': { kind: 'exact', category: 5 },
      'N__W': { kind: 'exact', category: 3 },
    });
    const scale = await deriveScale('c1', d, m);
    const N = scale.values.find((v) => v.levelId === 'N')!;
    const G = scale.values.find((v) => v.levelId === 'G')!;
    expect(N.value).toBeCloseTo(0, 1);
    expect(G.value).toBeCloseTo(100, 1);
  });

  it('intermediate level falls strictly between 0 and 100', async () => {
    // G=good(idx0), M, N=neutral(idx2)
    const d = desc(['G', 'M', 'N'], 2, 0);
    const m = matrix({
      'G__M': { kind: 'exact', category: 2 },
      'G__N': { kind: 'exact', category: 4 },
      'M__N': { kind: 'exact', category: 3 },
    });
    const scale = await deriveScale('c1', d, m);
    const mid = scale.values.find((v) => v.levelId === 'M')!;
    expect(mid.value).toBeGreaterThan(0);
    expect(mid.value).toBeLessThan(100);
  });

  it('values respect monotone ordering (best to worst)', async () => {
    const d = desc(['A', 'B', 'C', 'D'], 3, 0); // D=neutral, A=good
    const m = matrix({
      'A__B': { kind: 'exact', category: 2 },
      'A__C': { kind: 'exact', category: 4 },
      'A__D': { kind: 'exact', category: 5 },
      'B__C': { kind: 'exact', category: 3 },
      'B__D': { kind: 'exact', category: 4 },
      'C__D': { kind: 'exact', category: 2 },
    });
    const scale = await deriveScale('c1', d, m);
    const vals = ['A', 'B', 'C', 'D'].map(
      (id) => scale.values.find((v) => v.levelId === id)!.value,
    );
    for (let i = 0; i < vals.length - 1; i++) {
      expect(vals[i]).toBeGreaterThanOrEqual(vals[i + 1]);
    }
  });

  it('provides admissible range: lo ≤ value ≤ hi', async () => {
    const d = desc(['G', 'M', 'N'], 2, 0);
    const m = matrix({
      'G__M': { kind: 'exact', category: 3 },
      'G__N': { kind: 'exact', category: 5 },
      'M__N': { kind: 'exact', category: 3 },
    });
    const scale = await deriveScale('c1', d, m);
    for (const sv of scale.values) {
      expect(sv.admissibleRange[0]).toBeLessThanOrEqual(sv.value + 0.01);
      expect(sv.admissibleRange[1]).toBeGreaterThanOrEqual(sv.value - 0.01);
    }
  });

  it('consistency margin > 0 for valid matrix', async () => {
    const d = desc(['G', 'N'], 1, 0);
    const m = matrix({ 'G__N': { kind: 'exact', category: 3 } });
    const scale = await deriveScale('c1', d, m);
    expect(scale.consistencyMargin).toBeGreaterThan(0);
  });
});
