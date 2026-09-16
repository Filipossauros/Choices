/**
 * Replacement for `window.confirm` / `window.alert`.
 *
 * The native dialogs are unstyled, untranslatable, ignore dark mode, block the
 * whole tab, and are silently suppressed by some browsers — a confirmation that
 * may never appear is a poor guard for "this deletes your judgments". This one
 * renders in-page, is keyboard-operable (Escape cancels, focus is trapped to the
 * buttons, the confirming action is focused on open), and reads as a dialog to
 * assistive technology.
 *
 * `useDialogs` exposes the same shape as the native calls — `await confirm(…)`,
 * `await alert(…)` — so call sites keep reading as a linear sequence.
 */
import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

interface DialogRequest {
  title: string;
  body?: string;
  /** Label of the confirming button; absent for a plain acknowledgement. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions get a rose confirm button instead of the accent one. */
  danger?: boolean;
}

interface DialogApi {
  confirm: (req: DialogRequest) => Promise<boolean>;
  alert: (req: Omit<DialogRequest, 'confirmLabel' | 'cancelLabel' | 'danger'>) => Promise<void>;
}

const DialogContext = createContext<DialogApi | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [request, setRequest] = useState<(DialogRequest & { kind: 'confirm' | 'alert' }) | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setRequest(null);
  }, []);

  const api = useRef<DialogApi>({
    confirm: (req) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setRequest({ ...req, kind: 'confirm' });
      }),
    alert: (req) =>
      new Promise<void>((resolve) => {
        resolver.current = () => resolve();
        setRequest({ ...req, kind: 'alert' });
      }),
  }).current;

  useEffect(() => {
    if (!request) return;
    confirmRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
        return;
      }
      if (e.key !== 'Tab') return;
      // Keep focus inside the dialog: tabbing out of a modal leaves the user
      // operating a page they cannot see.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>('button');
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [request, close]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      {request && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-4 bg-gray-900/40 backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close(false);
          }}
        >
          <div
            ref={panelRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            aria-describedby={request.body ? 'dialog-body' : undefined}
            className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-xl p-5 space-y-3"
          >
            <h2 id="dialog-title" className="text-base font-semibold text-gray-900">
              {request.title}
            </h2>
            {request.body && (
              <p id="dialog-body" className="text-sm text-gray-600 leading-relaxed">
                {request.body}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              {request.kind === 'confirm' && (
                <button
                  onClick={() => close(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  {request.cancelLabel ?? t('Cancelar')}
                </button>
              )}
              <button
                ref={confirmRef}
                onClick={() => close(true)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg text-white ${
                  request.danger ? 'bg-danger hover:bg-danger-strong' : 'bg-accent hover:bg-accent-strong'
                }`}
              >
                {request.kind === 'alert' ? t('Entendido') : request.confirmLabel ?? t('Continuar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialogs(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialogs must be inside DialogProvider');
  return ctx;
}
