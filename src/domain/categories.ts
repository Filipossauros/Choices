/**
 * MACBETH judgment categories — the single source of truth for how the seven
 * difference categories are named and rendered.
 *
 * The ladder deliberately uses the *baixa → moderada → elevada* family rather
 * than *fraca → forte*: the ordering is unambiguous in Portuguese (nobody has
 * to decide whether "bastante" outranks "muito"), and the `weight` below drives
 * a staircase in the UI so the size of each step is visible before the label is
 * read.
 */
import type { MacbethCategory } from './types';

export interface CategorySpec {
  value: MacbethCategory;
  /** Full name shown in the picker and in reports. */
  label: string;
  /** Canonical MACBETH code, kept for traceability. */
  code: string;
  /** Relative bar height (px) — makes the increment legible at a glance. */
  weight: number;
  /** One-line explanation shown on hover. */
  hint: string;
}

export const CATEGORIES: CategorySpec[] = [
  { value: 0, label: 'Nula',          code: 'C0', weight: 6,  hint: 'Nenhuma diferença com relevância prática' },
  { value: 1, label: 'Muito baixa',   code: 'C1', weight: 14, hint: 'Diferença quase imperceptível' },
  { value: 2, label: 'Baixa',         code: 'C2', weight: 24, hint: 'Diferença pequena mas perceptível' },
  { value: 3, label: 'Moderada',      code: 'C3', weight: 36, hint: 'Diferença claramente sentida' },
  { value: 4, label: 'Elevada',       code: 'C4', weight: 50, hint: 'Diferença significativa' },
  { value: 5, label: 'Muito elevada', code: 'C5', weight: 66, hint: 'Diferença muito marcada' },
  { value: 6, label: 'Extrema',       code: 'C6', weight: 84, hint: 'A maior diferença concebível' },
];

export function categoryLabel(c: MacbethCategory): string {
  return CATEGORIES[c]?.label ?? String(c);
}

export function categoryCode(c: MacbethCategory): string {
  return CATEGORIES[c]?.code ?? `C${c}`;
}

/**
 * The category a normalized difference falls into. Used by the direct-input
 * modes (value ruler, weight sliders) to translate a position back into the
 * MACBETH vocabulary live, so those modes stay inside the method instead of
 * bypassing it.
 *
 * `delta` and `span` share units; the ratio is bucketed over the seven
 * categories with the same spacing the staircase shows.
 */
export function categoryForRatio(delta: number, span: number): MacbethCategory {
  if (span <= 0) return 0;
  const r = Math.abs(delta) / span;
  if (r < 0.02) return 0;
  if (r < 0.12) return 1;
  if (r < 0.26) return 2;
  if (r < 0.44) return 3;
  if (r < 0.64) return 4;
  if (r < 0.86) return 5;
  return 6;
}
