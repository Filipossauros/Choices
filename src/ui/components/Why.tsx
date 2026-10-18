import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';

/**
 * The one place a screen explains the method.
 *
 * The app had grown seven different ways of explaining things — the screen
 * lead, a second lead paragraph, sky-blue context cards, grey footnotes,
 * `title` tooltips, accordions, and a permanent gloss under every option — and
 * six of them could be on screen at once, none of them going away once read.
 * This is the single surface that replaces the first five: one per screen,
 * closed by default, always in the same place, always with the same name.
 *
 * What goes in: why the step exists, what the method is doing, the caveat that
 * matters once. What stays out: anything needed to answer the question in front
 * of you — that belongs in the question.
 */
export default function Why({
  label = 'porquê?',
  children,
  className = '',
}: {
  /** Overridden where a more specific question reads better ("como funciona?"). */
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <details className={`group/why ${className}`}>
      <summary className="inline-flex items-center gap-1 cursor-pointer select-none text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-2 marker:content-['']">
        {t(label)}
        <span className="text-[9px] not-italic transition-transform group-open/why:rotate-180" aria-hidden="true">⌄</span>
      </summary>
      <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-gray-700 leading-relaxed space-y-2">
        {children}
      </div>
    </details>
  );
}
