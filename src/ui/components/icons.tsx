/**
 * Small consistent line-icon set (1.75 stroke, 24-grid) replacing the emoji
 * iconography. Inherit colour via `currentColor`; size via the `className`.
 */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

function Svg({ className = 'w-4 h-4', children, ...rest }: P) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Drag handle — the conventional six-dot grip. */
export function IconGrip(p: P) {
  return (
    <Svg {...p} strokeWidth={2.5}>
      <path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01" />
    </Svg>
  );
}

/** Gate / habilitação — a doorway. */
export function IconGate(p: P) {
  return (
    <Svg {...p}>
      <path d="M4 21V5a2 2 0 0 1 2-2h9l5 5v13" />
      <path d="M9 21v-7h6v7" />
      <path d="M15 3v5h5" />
    </Svg>
  );
}

/** Qualification — a graded bar chart. */
export function IconQualification(p: P) {
  return (
    <Svg {...p}>
      <path d="M3 3v18h18" />
      <rect x="6.5" y="12" width="3" height="6" rx="0.5" />
      <rect x="11" y="8" width="3" height="10" rx="0.5" />
      <rect x="15.5" y="14" width="3" height="4" rx="0.5" />
    </Svg>
  );
}

/** Composite factor — nested layers. */
export function IconComposite(p: P) {
  return (
    <Svg {...p}>
      <path d="M12 3 21 8l-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </Svg>
  );
}

/** Architecture template — columns. */
export function IconArchitecture(p: P) {
  return (
    <Svg {...p}>
      <path d="M3 9 12 4l9 5" />
      <path d="M5 9v10M19 9v10M9.5 9v10M14.5 9v10" />
      <path d="M3 19h18" />
    </Svg>
  );
}

/** Monitoring template — a pulse/signal. */
export function IconMonitor(p: P) {
  return (
    <Svg {...p}>
      <path d="M3 12h4l2 6 4-14 2 8h6" />
    </Svg>
  );
}

/** Import — tray with a down arrow. */
export function IconImport(p: P) {
  return (
    <Svg {...p}>
      <path d="M12 3v11" />
      <path d="m8 11 4 4 4-4" />
      <path d="M5 21h14a1 1 0 0 0 1-1v-3" />
      <path d="M4 17v3a1 1 0 0 0 1 1" />
    </Svg>
  );
}

/** Export / download. */
export function IconExport(p: P) {
  return (
    <Svg {...p}>
      <path d="M12 15V4" />
      <path d="m8 8 4-4 4 4" />
      <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
    </Svg>
  );
}

/** Check mark. */
export function IconCheck(p: P) {
  return (
    <Svg {...p}>
      <path d="m5 13 4 4L19 7" />
    </Svg>
  );
}

/** A plus. */
export function IconPlus(p: P) {
  return (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

/** Pencil — create / edit a model. */
export function IconPencil(p: P) {
  return (
    <Svg {...p}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Svg>
  );
}

/** Clipboard — apply a model to concrete cases. */
export function IconClipboard(p: P) {
  return (
    <Svg {...p}>
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h4" />
    </Svg>
  );
}

/** Scales of justice — defensibility / decision. */
export function IconScale(p: P) {
  return (
    <Svg {...p}>
      <path d="M12 3v18" />
      <path d="M7 21h10" />
      <path d="M5 7h14" />
      <path d="m5 7-3 6a3 3 0 0 0 6 0L5 7Z" />
      <path d="m19 7-3 6a3 3 0 0 0 6 0l-3-6Z" />
    </Svg>
  );
}
