import { useState, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { MacbethJudgment, MacbethCategory } from '../../domain/types';
import { CATEGORIES } from '../../domain/categories';

/**
 * Guided, pair-by-pair judgment entry — a plain-language alternative to the
 * full MACBETH matrix. Walks the user through every upper-triangle pair of
 * `items` one at a time, asking a single attractiveness-difference question
 * and offering the seven C0–C6 categories as buttons.
 *
 * Keys are `idA__idB` with idA the more-attractive (earlier) item, exactly
 * matching JudgmentMatrixEditor — so the guided and advanced modes read and
 * write the same judgment record interchangeably.
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
  emptyHint?: string;
  /** Called whenever the currently active pair changes (key = `idA__idB`). */
  onActivePairChange?: (key: string | null) => void;
}

export default function GuidedJudgments({ items, judgments, onChange, renderQuestion, emptyHint, onActivePairChange }: Props) {
  const { t } = useTranslation();
  const [pairIdx, setPairIdx] = useState(0);

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
    setPairIdx(firstUnanswered === -1 ? 0 : firstUnanswered);
  }, [itemsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
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

  function pick(cat: MacbethCategory) {
    onChange({ ...judgments, [key]: { kind: 'exact', category: cat } });
    const nextUnanswered = pairs.findIndex((p, i) => i > safeIdx && !judgments[`${p.idA}__${p.idB}`]);
    if (nextUnanswered !== -1) setPairIdx(nextUnanswered);
    else if (safeIdx < total - 1) setPairIdx(safeIdx + 1);
  }

  const answered = pairs.filter((p) => judgments[`${p.idA}__${p.idB}`] !== undefined).length;

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
                    ? 'bg-blue-600 border-blue-700 text-white scale-110'
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

        {/* A staircase, not a flat row: the bar heights make the size of each
            step visible before the label is read, which a list of names alone
            never conveys. */}
        <div className="flex items-end gap-1.5 sm:gap-2">
          {CATEGORIES.map((cat) => {
            const active = currentCat === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => pick(cat.value)}
                title={t(cat.hint)}
                aria-pressed={active}
                className={`flex-1 min-w-0 flex flex-col items-center gap-1.5 px-1 pt-2.5 pb-2 rounded-xl border-[1.5px] transition-colors ${
                  active ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-200'
                }`}
              >
                <span
                  className={`w-full rounded-md ${active ? 'bg-indigo-500' : 'bg-indigo-100'}`}
                  style={{ height: cat.weight }}
                  aria-hidden="true"
                />
                <span className={`text-[11px] font-bold leading-tight text-center ${active ? 'text-indigo-700' : 'text-gray-700'}`}>
                  {t(cat.label)}
                </span>
                <span className="text-[9px] font-mono text-gray-400">{cat.code}</span>
              </button>
            );
          })}
        </div>
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

      {/* MACBETH reference */}
      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer hover:text-gray-700 font-medium">{t('Referência MACBETH — as sete categorias')}</summary>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1">
          {GUIDE_CATS.map((c) => (
            <span key={c.value} className="px-2 py-1 bg-gray-50 border border-gray-100 rounded-lg">
              <strong>{c.code}</strong> — {t(c.label)}
            </span>
          ))}
        </div>
        <p className="mt-2 text-gray-400 leading-relaxed">
          {t('As categorias são ordinais: uma diferença Elevada (C4) tem de ser maior que uma Moderada (C3), e assim por diante. A verificação de consistência confirma que as respostas não se contradizem.')}
        </p>
      </details>
    </div>
  );
}
