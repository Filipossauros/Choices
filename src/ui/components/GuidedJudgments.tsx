import { useState, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { MacbethJudgment, MacbethCategory } from '../../domain/types';
import { CATEGORIES, GRADED_CATEGORIES, categoryWording, type JudgmentContext } from '../../domain/categories';

/**
 * Guided, pair-by-pair judgment entry — a plain-language alternative to the
 * full MACBETH matrix. Walks the user through every upper-triangle pair of
 * `items` one at a time.
 *
 * Keys are `idA__idB` with idA the more-attractive (earlier) item, exactly
 * matching JudgmentMatrixEditor — so the guided and advanced modes read and
 * write the same judgment record interchangeably.
 *
 * TWO STEPS, NOT SEVEN BUTTONS
 * Asking for one of seven categories in a single move conflates two different
 * decisions — *which* is better and *by how much* — and only works if the first
 * one was already settled somewhere else. In the weighting screen it was: the
 * ranking in step 1 fixed the direction, so the question had to end with "if you
 * think it is worth less, go back and reorder the list", which is not an answer
 * anyone can give where they are standing. With `onInvert` the respondent states
 * the direction here, including "tanto me faz", and the ranking follows them.
 */

export interface GuidedItem {
  id: string;
  label: string;
}

/**
 * Re-exported from the domain ladder so the guided flow, the matrix and the
 * direct-input modes all name the categories identically.
 */
export const GUIDE_CATS = CATEGORIES;

interface Props {
  items: GuidedItem[];
  judgments: Record<string, MacbethJudgment>;
  onChange: (j: Record<string, MacbethJudgment>) => void;
  /** Renders the plain-language question for a pair (more vs less attractive). */
  renderQuestion: (more: GuidedItem, less: GuidedItem) => ReactNode;
  /**
   * Which question the ladder answers — it decides the wording of every rung.
   * `preference` compares two whole alternatives; `improvement` moves one
   * criterion up a level.
   */
  context?: JudgmentContext;
  /**
   * Called when the respondent picks the *lower-ranked* item as the better one.
   * The parent is expected to move `lessId` above `moreId` and store `cat` for
   * the re-oriented pair. Omit it where the order is not the user's to change —
   * the levels of a descriptor, for instance.
   */
  onInvert?: (moreId: string, lessId: string, cat: MacbethCategory) => void;
  /**
   * Whether this particular pair may be inverted. Some pairs are not a matter of
   * opinion — the weighting matrix compares every criterion against a reference
   * "improve nothing" item, and preferring *that* is not a preference, it is a
   * negative swing. Such a pair skips the direction step and keeps the C0 escape.
   */
  canInvert?: (more: GuidedItem, less: GuidedItem) => boolean;
  /** Show the C0–C6 codes beside each rung. Off unless the model is being audited. */
  showCodes?: boolean;
  emptyHint?: string;
  /** Shown in place of the question once every pair has an answer. */
  doneHint?: string;
  /** Called whenever the currently active pair changes (key = `idA__idB`). */
  onActivePairChange?: (key: string | null) => void;
}

/** Which side of the pair the respondent said is better. */
type Direction = 'more' | 'less' | 'equal';

export default function GuidedJudgments({
  items, judgments, onChange, renderQuestion, context = 'improvement',
  onInvert, canInvert, showCodes = false, emptyHint, doneHint, onActivePairChange,
}: Props) {
  const { t } = useTranslation();
  const [pairIdx, setPairIdx] = useState(0);
  /**
   * Whether the user has stepped *back into* an already-complete set to change
   * an answer.
   *
   * Completion itself is derived from the judgments rather than latched when
   * the last question is answered: they can also arrive all at once (the ROC
   * fill, the direct-weights mode, an imported model), and a latched flag
   * missed every one of those — leaving the run sitting on "Pergunta 1 de 3"
   * while reporting 3/3 answered.
   */
  const [reviewing, setReviewing] = useState(false);
  /** Direction chosen for the pair on screen, before a magnitude is given. */
  const [pendingDir, setPendingDir] = useState<Direction | null>(null);

  // Upper-triangle pairs, same order/keys as JudgmentMatrixEditor.
  const pairs: { idA: string; idB: string }[] = [];
  for (let ri = 0; ri < items.length - 1; ri++) {
    for (let ci = ri + 1; ci < items.length; ci++) {
      pairs.push({ idA: items[ri].id, idB: items[ci].id });
    }
  }

  const total = pairs.length;
  const safeIdx = total > 0 ? Math.min(pairIdx, total - 1) : 0;

  // When the set of elements changes (e.g. switching criterion/group, or
  // reordering), jump to the first unanswered pair instead of keeping the
  // previous index — otherwise the questions appear to start "in the middle".
  const itemsKey = items.map((it) => it.id).join('|');
  useEffect(() => {
    const firstUnanswered = pairs.findIndex((p) => !judgments[`${p.idA}__${p.idB}`]);
    setReviewing(false);
    setPendingDir(null);
    setPairIdx(firstUnanswered === -1 ? Math.max(0, pairs.length - 1) : firstUnanswered);
  }, [itemsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPendingDir(null);
    if (total === 0) { onActivePairChange?.(null); return; }
    const { idA, idB } = pairs[safeIdx];
    onActivePairChange?.(`${idA}__${idB}`);
  }, [safeIdx, total]); // eslint-disable-line react-hooks/exhaustive-deps

  if (total === 0) {
    return <p className="text-sm text-gray-400 italic">{emptyHint ? t(emptyHint) : t('São necessários pelo menos 2 elementos.')}</p>;
  }

  const { idA, idB } = pairs[safeIdx];
  const moreItem = items.find((it) => it.id === idA)!;
  const lessItem = items.find((it) => it.id === idB)!;

  const key = `${idA}__${idB}`;
  const currentJ = judgments[key];
  const currentCat: MacbethCategory | null = currentJ
    ? currentJ.kind === 'exact'
      ? currentJ.category
      : currentJ.lo
    : null;

  /** Direction step only exists where the parent can act on an inversion. */
  const asksDirection = context === 'preference' && !!onInvert && (canInvert?.(moreItem, lessItem) ?? true);
  // An answered pair is already filed in the current orientation, so the stored
  // answer *is* the direction: C0 means "tanto me faz", anything else means the
  // left item won.
  const answeredDir: Direction | null = currentCat === null ? null : currentCat === 0 ? 'equal' : 'more';
  const dir: Direction | null = pendingDir ?? answeredDir ?? (asksDirection ? null : 'more');

  function setDirection(d: Direction) {
    if (d === 'equal') { pick(0); return; }
    setPendingDir(d);
  }

  function advanceFrom(next: Record<string, MacbethJudgment>) {
    const nextUnanswered = pairs.findIndex((p, i) => i !== safeIdx && !next[`${p.idA}__${p.idB}`]);
    if (nextUnanswered !== -1) setPairIdx(nextUnanswered);
    else setReviewing(false); // that was the last gap — show the summary
    setPendingDir(null);
  }

  function pick(cat: MacbethCategory) {
    // The respondent chose the lower-ranked item: hand the inversion to the
    // parent, which owns the ranking, rather than storing a backwards key here.
    if (cat > 0 && dir === 'less' && onInvert) {
      onInvert(idA, idB, cat);
      const optimistic = { ...judgments, [`${idB}__${idA}`]: { kind: 'exact' as const, category: cat } };
      delete optimistic[key];
      advanceFrom(optimistic);
      return;
    }
    const next = { ...judgments, [key]: { kind: 'exact' as const, category: cat } };
    onChange(next);
    advanceFrom(next);
  }

  const answered = pairs.filter((p) => judgments[`${p.idA}__${p.idB}`] !== undefined).length;

  /** All pairs answered: say so and offer a way back in, rather than re-asking. */
  if (answered === total && !reviewing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{t('{{total}} de {{total}} comparações', { total })}</span>
          <span className="text-green-700 font-semibold">✓ {t('completo')}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full w-full" />
        </div>
        <div className="border border-green-200 bg-green-50 rounded-2xl p-5 space-y-3">
          <p className="text-sm text-green-900">
            {doneHint ? t(doneHint) : t('Respondeu a todas as comparações.')}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setReviewing(true); setPairIdx(0); }}
              className="px-3.5 py-1.5 text-sm font-medium rounded-lg border border-green-300 text-green-900 hover:bg-green-100"
            >
              {t('Rever as respostas')}
            </button>
          </div>
        </div>
        {/* The answers themselves, so "completo" is inspectable in place. */}
        <div className="flex flex-wrap gap-1.5">
          {pairs.map((p, i) => {
            const j = judgments[`${p.idA}__${p.idB}`];
            const c = (j ? (j.kind === 'exact' ? j.category : j.lo) : 0) as MacbethCategory;
            return (
              <button
                key={i}
                onClick={() => { setReviewing(true); setPairIdx(i); }}
                className="text-[11px] px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:border-indigo-300"
                title={`${items.find((it) => it.id === p.idA)?.label} vs ${items.find((it) => it.id === p.idB)?.label}`}
              >
                {i + 1}. <span className="font-semibold text-indigo-700">{t(categoryWording(c, context).label)}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const chosenItem = dir === 'less' ? lessItem : moreItem;

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{t('Pergunta {{n}} de {{total}}', { n: safeIdx + 1, total })}</span>
          <span>{t('{{a}}/{{total}} respondidas', { a: answered, total })}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(answered / total) * 100}%` }} />
        </div>
      </div>

      {/* Pair overview dots */}
      {total > 1 && (
        <div className="flex flex-wrap gap-1">
          {pairs.map((p, i) => {
            const done = !!judgments[`${p.idA}__${p.idB}`];
            const active = i === safeIdx;
            return (
              <button
                key={i}
                onClick={() => setPairIdx(i)}
                title={`${items.find((it) => it.id === p.idA)?.label} vs ${items.find((it) => it.id === p.idB)?.label}`}
                className={`w-5 h-5 rounded-full border text-[9px] font-bold transition-all ${
                  active
                    ? 'bg-accent border-blue-700 text-white scale-110'
                    : done
                    ? 'bg-green-500 border-green-600 text-white'
                    : 'bg-gray-100 border-gray-300 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      )}

      {/* Question card */}
      <div className="border border-gray-200 rounded-2xl bg-white p-5 space-y-4">
        <div className="text-lg font-bold text-gray-800 leading-snug tracking-tight">
          {renderQuestion(moreItem, lessItem)}
        </div>

        {/* Step 1 — which one. Only where the parent can act on the answer. */}
        {asksDirection && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-700">{t('Qual escolhe?')}</p>
            <div className="flex flex-wrap gap-2">
              {([
                { d: 'more' as const, label: moreItem.label, grow: true },
                { d: 'equal' as const, label: t('Tanto me faz'), grow: false },
                { d: 'less' as const, label: lessItem.label, grow: true },
              ]).map(({ d, label, grow }) => {
                const on = dir === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDirection(d)}
                    aria-pressed={on}
                    className={`${grow ? 'flex-1 min-w-[9rem]' : 'shrink-0'} px-4 py-2.5 rounded-xl border-[1.5px] text-sm transition-colors ${
                      on
                        ? 'border-green-500 bg-green-50 text-green-800 font-semibold'
                        : `border-gray-200 bg-white hover:border-green-300 ${grow ? 'text-gray-700 font-medium' : 'text-gray-500'}`
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2 — by how much. A staircase, not a flat row: the bar heights
            make the size of each step visible before the label is read. */}
        {dir !== null && dir !== 'equal' && (
          <div className="space-y-2">
            {asksDirection && (
              <p className="text-sm font-semibold text-gray-700">
                {t('Com que folga prefere «{{label}}»?', { label: chosenItem.label })}
              </p>
            )}
            <div className="flex items-end gap-1.5 sm:gap-2">
              {GRADED_CATEGORIES.map((cat) => {
                const active = currentCat === cat.value && dir === answeredDir;
                const wording = categoryWording(cat.value, context);
                return (
                  <button
                    key={cat.value}
                    onClick={() => pick(cat.value)}
                    title={`${t(wording.label)} — ${t(wording.gloss)}`}
                    aria-pressed={active}
                    className={`flex-1 min-w-0 flex flex-col items-center px-1 pt-2.5 pb-2 rounded-xl border-[1.5px] transition-colors ${
                      active ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-200'
                    }`}
                  >
                    {/* Fixed-height well so every bar sits on the same baseline:
                        otherwise a two-line label pushes its bar up and the
                        staircase — the whole point of the shape — disappears. */}
                    <span className="w-full h-[5.25rem] flex items-end" aria-hidden="true">
                      <span
                        className={`w-full rounded-md ${active ? 'bg-indigo-500' : 'bg-indigo-100'}`}
                        style={{ height: cat.weight }}
                      />
                    </span>
                    <span className={`mt-1.5 min-h-[2.5em] flex items-center text-[11px] font-bold leading-tight text-center ${active ? 'text-indigo-700' : 'text-gray-700'}`}>
                      {t(wording.label)}
                    </span>
                    {showCodes && <span className="text-[9px] font-mono text-gray-400">{cat.code}</span>}
                  </button>
                );
              })}
            </div>
            {/* The consequence of the chosen rung, spelled out: the only part of
                this screen the respondent can actually check against themselves. */}
            {currentCat !== null && currentCat > 0 && dir === answeredDir && (
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-gray-700">«{t(categoryWording(currentCat, context).label)}»</span>
                {' — '}{t(categoryWording(currentCat, context).gloss)}.
              </p>
            )}
          </div>
        )}

        {/* C0 lives outside the ladder: it answers a different question
            (sameness), and inside the ladder it gets picked by accident. */}
        {!asksDirection && (
          <button
            onClick={() => pick(0)}
            aria-pressed={currentCat === 0}
            className={`text-xs rounded-lg px-3 py-1.5 border transition-colors ${
              currentCat === 0
                ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-semibold'
                : 'border-gray-200 text-gray-500 hover:border-indigo-200'
            }`}
          >
            {t(categoryWording(0, context).label)} — {t(categoryWording(0, context).gloss)}
          </button>
        )}
        {asksDirection && dir === 'equal' && (
          <p className="text-xs text-gray-500">
            <span className="font-semibold text-gray-700">«{t('Tanto me faz')}»</span>
            {' — '}{t('escolheria à sorte')}.
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setPairIdx(Math.max(0, safeIdx - 1))}
          disabled={safeIdx === 0}
          className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 text-gray-600"
        >
          {t('← Anterior')}
        </button>
        <button
          onClick={() => setPairIdx(Math.min(total - 1, safeIdx + 1))}
          disabled={safeIdx === total - 1}
          className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 text-gray-600"
        >
          {t('Próxima →')}
        </button>
      </div>

      {/* MACBETH reference — the bridge between what is on screen and what goes
          into the report, for anyone who has to defend the model. Shown with the
          codes, since on its own it introduces a vocabulary simple mode is
          deliberately not using. */}
      {showCodes && (
      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer hover:text-gray-700 font-medium">{t('Equivalência com as categorias MACBETH')}</summary>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
          {GUIDE_CATS.map((c) => (
            <span key={c.value} className="px-2 py-1 bg-gray-50 border border-gray-100 rounded-lg">
              <strong className="font-mono">{c.code}</strong>
              {' '}{t(c.label)} — {t(categoryWording(c.value, context).label)}
            </span>
          ))}
        </div>
        <p className="mt-2 text-gray-400 leading-relaxed">
          {t('As categorias são ordinais: uma diferença Elevada (C4) tem de ser maior que uma Moderada (C3), e assim por diante. A verificação de consistência confirma que as respostas não se contradizem.')}
        </p>
      </details>
      )}
    </div>
  );
}
