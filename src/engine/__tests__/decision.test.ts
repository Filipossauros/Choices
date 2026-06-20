import { describe, it, expect } from 'vitest';
import { displayBands, bandRangeLabel, classify } from '../../domain/decision';
import type { DecisionBand } from '../../domain/types';

const scale: DecisionBand[] = [
  { id: 'hi', label: 'Aplicar coima', minScore: 50, color: '#dc2626' },
  { id: 'mid', label: 'Advertência', minScore: 20, color: '#d97706' },
  { id: 'base', label: 'Sem ação', minScore: 0, color: '#16a34a' },
];

describe('displayBands', () => {
  it('sorts desc, intervals chain, and flags only the lowest as base', () => {
    const v = displayBands(scale);
    expect(v.map((x) => x.band.id)).toEqual(['hi', 'mid', 'base']);
    expect(v[0]).toMatchObject({ lower: 50, upper: null, isBase: false }); // top: unbounded above
    expect(v[1]).toMatchObject({ lower: 20, upper: 50, isBase: false });
    expect(v[2].isBase).toBe(true);
  });

  it('labels the base as a catch-all, not "≥ minScore"', () => {
    expect(bandRangeLabel(scale[0], scale)).toBe('≥ 50');
    expect(bandRangeLabel(scale[1], scale)).toBe('20 – 50');
    expect(bandRangeLabel(scale[2], scale)).toBe('< 20'); // base, never "≥ 0"
  });

  it('classifies values into the right zone, base catching anything below', () => {
    expect(classify(72, scale)?.id).toBe('hi');
    expect(classify(35, scale)?.id).toBe('mid');
    expect(classify(5, scale)?.id).toBe('base');
    expect(classify(-30, scale)?.id).toBe('base'); // below everything → base
  });
});
