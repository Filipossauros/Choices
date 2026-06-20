import { v4 as uuidv4 } from 'uuid';
import type { DecisionBand } from './types';

/** Default 3-band decision scale for a new model (recomendado / reservas / não). */
export function defaultDecisionScale(): DecisionBand[] {
  return [
    { id: uuidv4(), label: 'Recomendado', minScore: 70, color: '#16a34a' },
    { id: uuidv4(), label: 'Recomendado com reservas', minScore: 40, color: '#d97706' },
    { id: uuidv4(), label: 'Não recomendado', minScore: 0, color: '#dc2626' },
  ];
}

/** Bands sorted from highest to lowest minScore. */
export function sortBands(scale: DecisionBand[]): DecisionBand[] {
  return [...scale].sort((a, b) => b.minScore - a.minScore);
}

/** A band with its resolved interval on the V(p) axis and base-zone flag. */
export interface BandView {
  band: DecisionBand;
  /** Inclusive lower bound. Ignored when `isBase` (the base is a catch-all). */
  lower: number;
  /** Exclusive upper bound; null for the top band (unbounded above). */
  upper: number | null;
  /** The lowest band is a catch-all: it holds everything below the band above. */
  isBase: boolean;
}

/**
 * Sorted bands paired with their intervals. The lowest band is flagged as the
 * base/catch-all so consumers (charts, legends, reports) never show a misleading
 * "≥ minScore" for it nor let its (possibly sentinel) value distort an axis.
 */
export function displayBands(scale: DecisionBand[]): BandView[] {
  const sorted = sortBands(scale);
  const n = sorted.length;
  return sorted.map((band, i) => ({
    band,
    lower: band.minScore,
    upper: i === 0 ? null : sorted[i - 1].minScore,
    isBase: n > 1 && i === n - 1,
  }));
}

const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));

/** The highest band whose minScore the value reaches; null if scale is empty. */
export function classify(value: number, scale: DecisionBand[]): DecisionBand | null {
  const sorted = sortBands(scale);
  for (const band of sorted) {
    if (value >= band.minScore) return band;
  }
  return sorted[sorted.length - 1] ?? null;
}

/** Human-readable interval label for a band, e.g. "40 – 70", "≥ 70" or "< 40". */
export function bandRangeLabel(band: DecisionBand, scale: DecisionBand[]): string {
  const v = displayBands(scale).find((x) => x.band.id === band.id);
  if (!v) return `≥ ${fmt(band.minScore)}`;
  if (v.isBase) return v.upper != null ? `< ${fmt(v.upper)}` : 'todos';
  if (v.upper == null) return `≥ ${fmt(v.lower)}`;
  return `${fmt(v.lower)} – ${fmt(v.upper)}`;
}
