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

/** The highest band whose minScore the value reaches; null if scale is empty. */
export function classify(value: number, scale: DecisionBand[]): DecisionBand | null {
  const sorted = sortBands(scale);
  for (const band of sorted) {
    if (value >= band.minScore) return band;
  }
  return sorted[sorted.length - 1] ?? null;
}

/** Human-readable interval label for a band, e.g. "[40, 70)" or "≥ 70". */
export function bandRangeLabel(band: DecisionBand, scale: DecisionBand[]): string {
  const sorted = sortBands(scale);
  const idx = sorted.findIndex((b) => b.id === band.id);
  const upper = idx > 0 ? sorted[idx - 1].minScore : null;
  if (upper === null) return `≥ ${band.minScore}`;
  return `${band.minScore} – ${upper}`;
}
