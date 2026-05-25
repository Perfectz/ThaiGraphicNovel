/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Trebuchet MS"', 'Verdana', 'sans-serif'],
        body: ['"Nunito"', '"Trebuchet MS"', 'Verdana', 'sans-serif'],
      },
      // Design-system color aliases — see src/styles/tokens.css.
      //
      // Names are deliberately non-clashing with Tailwind's stock palette
      // (cyan-*, amber-*, etc.) so existing components keep working during
      // the incremental migration. Migrated code should prefer these tokens
      // over raw Tailwind color shades.
      colors: {
        ink: {
          DEFAULT: 'var(--ink)',
          raised: 'var(--ink-raised)',
          elevated: 'var(--ink-elevated)',
        },
        paper: {
          DEFAULT: 'var(--paper)',
          muted: 'var(--paper-muted)',
          quiet: 'var(--paper-quiet)',
        },
        hairline: 'var(--hairline)',
        // Primary accent — aliased as `accent` so it doesn't shadow Tailwind's cyan-* scale.
        accent: {
          DEFAULT: 'var(--cyan)',
          soft: 'var(--cyan-soft)',
        },
        // Semantic — each carries one meaning.
        jade: 'var(--jade)',
        ember: 'var(--ember)',
        // Coaching tone — aliased as `coach` to avoid shadowing Tailwind's amber-* scale.
        coach: 'var(--amber)',
      },
      boxShadow: {
        rpg: '0 16px 0 rgba(55, 27, 18, 0.28), 0 24px 50px rgba(31, 41, 55, 0.35)',
        // Flat elevation for cards — no neon glow.
        card: '0 8px 24px rgba(0, 0, 0, 0.32)',
      },
    },
  },
  plugins: [],
};
