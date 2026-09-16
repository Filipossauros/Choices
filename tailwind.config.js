/** @type {import('tailwindcss').Config} */

/**
 * "Calibre" design tokens.
 *
 * The app styles itself with Tailwind utilities inline, so the cheapest way to
 * restyle every screen coherently is to redefine the scales those utilities
 * already name rather than rewrite thousands of class strings:
 *
 *  - `gray`   → lilac-tinted neutrals, so the greys read as chosen rather than
 *               inherited and sit under the violet accent without clashing.
 *  - `blue` / `indigo` → the single violet signal colour. Both map to the same
 *               ramp because the app used them interchangeably for interactive
 *               affordances; collapsing them removes the accidental two-accent
 *               look.
 *  - `green`/`emerald`, `amber`/`yellow`, `red`/`rose` → pastel semantic
 *               families reserved for decision outcomes. Keeping semantics on
 *               their own hues means the accent never competes with a verdict.
 *
 * Pastels are used as *surfaces*; text always takes the dark end of the ramp,
 * which is what keeps a soft palette legible enough for formal use.
 */
const violet = {
  50: '#F7F5FF', 100: '#EDEAFF', 200: '#DDD7FA', 300: '#C3B8F5',
  400: '#9A88F0', 500: '#6C5CE7', 600: '#5B49DE', 700: '#4B3AC4',
  800: '#3C2E9C', 900: '#2E2378',
};
const mint = {
  50: '#F0FAF5', 100: '#D4F0E2', 200: '#B2E4CD', 300: '#84D2AF',
  400: '#4FBA8C', 500: '#2A9C6D', 600: '#14795A', 700: '#0D6149',
  800: '#0A4D3A', 900: '#073D2E',
};
const peach = {
  50: '#FFF9F0', 100: '#FFE7CB', 200: '#FFD5A3', 300: '#F8BC70',
  400: '#EDA042', 500: '#CE8117', 600: '#A2680B', 700: '#825308',
  800: '#674206', 900: '#4E3204',
};
const rose = {
  50: '#FFF5F4', 100: '#FFDBD6', 200: '#FFC0B8', 300: '#F89C90',
  400: '#EE7264', 500: '#D64C3D', 600: '#B0332A', 700: '#8E2921',
  800: '#71211B', 900: '#571914',
};
const sky = {
  50: '#F3F8FF', 100: '#DCEAFF', 200: '#BFD8FB', 300: '#94BDF5',
  400: '#639CEC', 500: '#3B7BDA', 600: '#245FA6', 700: '#1D4C86',
  800: '#173C6B', 900: '#122E52',
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gray: {
          50: '#F5F4FA', 100: '#EEEDF6', 200: '#E7E5F1', 300: '#CFCBE2',
          400: '#8E93A6', 500: '#6E7285', 600: '#5D6275', 700: '#454A5C',
          800: '#333747', 900: '#232633',
        },
        slate: {
          50: '#F5F4FA', 100: '#EEEDF6', 200: '#E7E5F1', 300: '#CFCBE2',
          400: '#8E93A6', 500: '#6E7285', 600: '#5D6275', 700: '#454A5C',
          800: '#2A2D3A', 900: '#1B1D28',
        },
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
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        sm: '0.375rem',
        md: '0.625rem',
        lg: '0.75rem',
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
