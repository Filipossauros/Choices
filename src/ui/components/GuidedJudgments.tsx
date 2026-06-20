import { useState, type ReactNode } from 'react';
import type { MacbethJudgment, MacbethCategory } from '../../domain/types';

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

export const GUIDE_CATS: {
  value: MacbethCategory;
  label: string;
  bg: string;
  text: string;
  hint: string;
}[] = [
  { value: 0, label: 'Indiferente', bg: 'bg-gray-100 hover:bg-gray-200 border-gray-300', text: 'text-gray-700', hint: 'C0 — a diferença não tem relevância prática' },
  { value: 1, label: 'Muito fraca', bg: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300', text: 'text-emerald-800', hint: 'C1 — diferença quase imperceptível' },
  { value: 2, label: 'Fraca', bg: 'bg-teal-50 hover:bg-teal-100 border-teal-300', text: 'text-teal-800', hint: 'C2 — diferença pequena mas perceptível' },
  { value: 3, label: 'Moderada', bg: 'bg-yellow-50 hover:bg-yellow-100 border-yellow-400', text: 'text-yellow-800', hint: 'C3 — diferença claramente sentida' },
  { value: 4, label: 'Forte', bg: 'bg-orange-50 hover:bg-orange-100 border-orange-400', text: 'text-orange-800', hint: 'C4 — diferença significativa' },
  { value: 5, label: 'Muito forte', bg: 'bg-red-50 hover:bg-red-100 border-red-400', text: 'text-red-800', hint: 'C5 — diferença muito marcada' },
  { value: 6, label: 'Extrema', bg: 'bg-red-100 hover:bg-red-200 border-red-600', text: 'text-red-900', hint: 'C6 — diferença máxima concebível' },
];

interface Props {
  items: GuidedItem[];
  judgments: Record<string, MacbethJudgment>;
  onChange: (j: Record<string, MacbethJudgment>) => void;
  /** Renders the plain-language question for a pair (more vs less attractive). */
  renderQuestion: (more: GuidedItem, less: GuidedItem) => ReactNode;
  emptyHint?: string;
}

export default function GuidedJudgments({ items, judgments, onChange, renderQuestion, emptyHint }: Props) {
  const [pairIdx, setPairIdx] = useState(0);

  // Upper-triangle pairs, same order/keys as JudgmentMatrixEditor.
  const pairs: { idA: string; idB: string }[] = [];
  for (let ri = 0; ri < items.length - 1; ri++) {
    for (let ci = ri + 1; ci < items.length; ci++) {
      pairs.push({ idA: items[ri].id, idB: items[ci].id });
    }
  }

  const total = pairs.length;
  if (total === 0) {
    return <p className="text-sm text-gray-400 italic">{emptyHint ?? 'São necessários pelo menos 2 elementos.'}</p>;
  }

  const safeIdx = Math.min(pairIdx, total - 1);
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
          <span>Pergunta {safeIdx + 1} de {total}</span>
          <span>{answered}/{total} respondidas</span>
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
      <div className="border border-blue-200 rounded-2xl bg-blue-50 p-5 space-y-4">
        <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Diferença de atratividade</p>
        <div className="text-base font-medium text-gray-800 leading-snug">
          {renderQuestion(moreItem, lessItem)}
        </div>

        {/* Category buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {GUIDE_CATS.map((cat) => {
            const active = currentCat === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => pick(cat.value)}
                title={cat.hint}
                className={`flex flex-col items-center gap-0.5 px-3 py-2.5 border rounded-xl text-xs font-semibold transition-all ${cat.bg} ${cat.text} ${
                  active ? 'ring-2 ring-blue-500 ring-offset-1 scale-105 shadow-sm' : ''
                }`}
              >
                <span className="text-[10px] font-normal opacity-60">C{cat.value}</span>
                {cat.label}
              </button>
            );
          })}
        </div>

        {currentJ && (
          <p className="text-xs text-blue-700 font-medium">
            ✓ Resposta registada: <strong>{GUIDE_CATS.find((c) => c.value === currentCat)?.label}</strong>
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
          ← Anterior
        </button>
        <button
          onClick={() => setPairIdx(Math.min(total - 1, safeIdx + 1))}
          disabled={safeIdx === total - 1}
          className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 text-gray-600"
        >
          Próxima →
        </button>
      </div>

      {/* MACBETH reference */}
      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer hover:text-gray-700 font-medium">Referência MACBETH — categorias C0–C6</summary>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1">
          {GUIDE_CATS.map((c) => (
            <span key={c.value} className="px-2 py-1 bg-gray-50 border border-gray-100 rounded-lg">
              <strong>C{c.value}</strong> — {c.label}
            </span>
          ))}
        </div>
        <p className="mt-2 text-gray-400 leading-relaxed">
          As categorias são ordinais: a diferença C4 (Forte) deve ser maior que C3 (Moderada), e assim por diante.
          A verificação de consistência confirma que a ordenação cardinal das respostas não contém contradições.
        </p>
      </details>
    </div>
  );
}
