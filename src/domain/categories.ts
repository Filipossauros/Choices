/**
 * MACBETH judgment categories — the single source of truth for how the seven
 * difference categories are named and rendered.
 *
 * WHY EACH CATEGORY HAS THREE NAMES
 * `label` is the method's own vocabulary (Nula → Extrema). It names the
 * *quantity being judged*: a difference of attractiveness. That is precise and
 * unusable — the hints that went with it ("Diferença claramente sentida" for C3,
 * "Diferença significativa" for C4) are synonyms of each other, so a respondent
 * choosing between them has nothing to hold on to and ends up picking by
 * position on screen.
 *
 * So each category also carries a *wording per context*, naming the respondent's
 * own position instead of the abstract quantity, plus a `gloss` stating the
 * behavioural consequence — the thing someone can actually confirm or reject:
 *
 *   preference   when two whole alternatives are being compared
 *                (weighting: "prefiro muito" — era preciso um bom motivo…)
 *   improvement  when one criterion moves up one level
 *                (scales: "melhora muito" — é uma melhoria importante)
 *
 * The ladder stays monotone in both wordings, and `weight` drives a staircase so
 * the size of each step is visible before any label is read. C0–C6 are untouched
 * underneath: the LP, the matrix editor and the report keep using `label`/`code`.
 */
import type { MacbethCategory } from './types';

/** Which question the ladder is answering. */
export type JudgmentContext = 'preference' | 'improvement';

export interface CategoryWording {
  /** What the respondent is saying, in the first person. */
  label: string;
  /** The consequence that makes the choice checkable. */
  gloss: string;
}

export interface CategorySpec {
  value: MacbethCategory;
  /** Method vocabulary — shown in the matrix, the glossary and reports. */
  label: string;
  /** Canonical MACBETH code, kept for traceability. */
  code: string;
  /** Relative bar height (px) — makes the increment legible at a glance. */
  weight: number;
  /** One-line explanation of the *difference*, in method terms. */
  hint: string;
  preference: CategoryWording;
  improvement: CategoryWording;
}

export const CATEGORIES: CategorySpec[] = [
  {
    value: 0, label: 'Nula', code: 'C0', weight: 6,
    hint: 'Nenhuma diferença com relevância prática',
    preference: { label: 'Tanto me faz', gloss: 'escolheria à sorte' },
    improvement: { label: 'Não melhora', gloss: 'na prática é igual' },
  },
  {
    value: 1, label: 'Muito baixa', code: 'C1', weight: 14,
    hint: 'Diferença quase imperceptível',
    preference: { label: 'Prefiro, quase nada', gloss: 'quase não dava pela diferença' },
    improvement: { label: 'Melhora quase nada', gloss: 'é melhor no papel' },
  },
  {
    value: 2, label: 'Baixa', code: 'C2', weight: 24,
    hint: 'Diferença pequena mas perceptível',
    preference: { label: 'Prefiro um pouco', gloss: 'notava-se, mas não mudava a minha escolha' },
    improvement: { label: 'Melhora um pouco', gloss: 'é melhor, mas pouco' },
  },
  {
    value: 3, label: 'Moderada', code: 'C3', weight: 36,
    hint: 'Diferença claramente sentida',
    preference: { label: 'Prefiro moderadamente', gloss: 'conta, e pesava na decisão' },
    improvement: { label: 'Melhora de forma visível', gloss: 'é uma melhoria que se nota' },
  },
  {
    value: 4, label: 'Elevada', code: 'C4', weight: 50,
    hint: 'Diferença significativa',
    preference: { label: 'Prefiro muito', gloss: 'era preciso um bom motivo para escolher a outra' },
    improvement: { label: 'Melhora muito', gloss: 'é uma melhoria importante' },
  },
  {
    value: 5, label: 'Muito elevada', code: 'C5', weight: 66,
    hint: 'Diferença muito marcada',
    preference: { label: 'Prefiro muitíssimo', gloss: 'só escolheria a outra num caso muito especial' },
    improvement: { label: 'Melhora muitíssimo', gloss: 'muda a qualidade da proposta' },
  },
  {
    value: 6, label: 'Extrema', code: 'C6', weight: 84,
    hint: 'A maior diferença concebível',
    preference: { label: 'Não há comparação', gloss: 'nunca escolheria a outra por causa deste ponto' },
    improvement: { label: 'É o salto máximo', gloss: 'é a maior diferença possível neste critério' },
  },
];

/** The six categories that assert a difference. C0 is offered separately: it is
 *  an answer about *sameness*, and mixing it into the ladder invites it by
 *  accident. */
export const GRADED_CATEGORIES = CATEGORIES.filter((c) => c.value > 0);

export function categoryLabel(c: MacbethCategory): string {
  return CATEGORIES[c]?.label ?? String(c);
}

export function categoryCode(c: MacbethCategory): string {
  return CATEGORIES[c]?.code ?? `C${c}`;
}

/** The first-person wording for a category in a given question context. */
export function categoryWording(c: MacbethCategory, context: JudgmentContext): CategoryWording {
  const spec = CATEGORIES[c];
  if (!spec) return { label: String(c), gloss: '' };
  return spec[context];
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
