/**
 * "Calibre" — the app's palette, resolved through CSS variables.
 *
 * WHY VARIABLES AND NOT TWO SETS OF CLASSES
 * Dark mode used to be a block of `.dark .bg-gray-50 { … !important }` rules in
 * index.css, matching on class name. That cannot work in general: it never sees
 * `bg-indigo-50/60` (the opacity modifier makes a different class), never sees
 * an inline `style={{ color: '#334155' }}`, and needs a new line for every shade
 * anyone happens to use — so the failures were invisible surfaces discovered one
 * screenshot at a time. Here each shade *is* a variable, so `.dark` redefines
 * the colour itself and every utility built on it follows, opacity modifiers
 * included.
 *
 * WHAT EACH BAND MEANS
 * Counting the codebase's own usage settles it: 50–100 are almost only
 * backgrounds (177 uses, 0 as text), 200–300 almost only borders (172), and
 * 400–900 almost only text (542). So in dark mode 50–300 get darker and 400–900
 * get lighter — the ramp keeps its meaning instead of being inverted wholesale.
 *
 * Solid accent fills (a violet button with white on it) are the one case that
 * does not fit: they need the *same* saturated colour in both modes, while
 * `text-indigo-700` beside them needs to flip. Rather than force one shade to do
 * both, filled controls use the semantic `accent` / `danger` / `caution` /
 * `positive` tokens below, which stay saturated throughout.
 */

const ramp = (name) => ({
  50: `rgb(var(--${name}-50) / <alpha-value>)`,
  100: `rgb(var(--${name}-100) / <alpha-value>)`,
  200: `rgb(var(--${name}-200) / <alpha-value>)`,
  300: `rgb(var(--${name}-300) / <alpha-value>)`,
  400: `rgb(var(--${name}-400) / <alpha-value>)`,
  500: `rgb(var(--${name}-500) / <alpha-value>)`,
  600: `rgb(var(--${name}-600) / <alpha-value>)`,
  700: `rgb(var(--${name}-700) / <alpha-value>)`,
  800: `rgb(var(--${name}-800) / <alpha-value>)`,
  900: `rgb(var(--${name}-900) / <alpha-value>)`,
});

const violet = ramp('v');
const mint = ramp('m');
const peach = ramp('p');
const rose = ramp('r');
const sky = ramp('s');
const neutral = ramp('n');

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // `bg-white` is the card surface, not the colour white: in dark mode a
        // card has to sit *above* the page, so it is lighter than the background.
        white: 'rgb(var(--surface) / <alpha-value>)',

        gray: neutral,
        slate: neutral,

        // One violet signal colour under every name the codebase reaches for.
        blue: violet,
        indigo: violet,
        violet,
        purple: violet,

        green: mint,
        emerald: mint,
        teal: mint,

        amber: peach,
        yellow: peach,
        orange: peach,

        red: rose,
        rose,

        sky,
        cyan: sky,

        // Semantic fills — saturated in both modes, always carrying white text.
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          strong: 'rgb(var(--accent-strong) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
          strong: 'rgb(var(--danger-strong) / <alpha-value>)',
        },
        caution: {
          DEFAULT: 'rgb(var(--caution) / <alpha-value>)',
          strong: 'rgb(var(--caution-strong) / <alpha-value>)',
        },
        positive: {
          DEFAULT: 'rgb(var(--positive) / <alpha-value>)',
          strong: 'rgb(var(--positive-strong) / <alpha-value>)',
        },
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        sm: '0.375rem',
        md: '0.625rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      transitionTimingFunction: {
        // Decelerating: fast to start, settling at the end. Used for anything
        // that moves because the user did something.
        settle: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
};
