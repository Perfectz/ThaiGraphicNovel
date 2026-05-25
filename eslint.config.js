// Flat config for ESLint 9+. Pinned to a focused rule-set tailored to the
// codebase as it stands today:
//   - typescript-eslint recommended rules (no type-aware rules — keeps lint
//     fast; we already run `tsc --noEmit` for the type-aware pass)
//   - react-hooks for rule-of-hooks and exhaustive-deps
//   - jsx-a11y for screen-reader / keyboard regressions on JSX
//
// Lint runs cleanly on the current tree as a baseline; PRs that introduce
// new violations fail. Existing TODOs (long files, `as` casts, etc.) are
// not linter business — they're tracked in the Q1 task list instead.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

export default tseslint.config(
  {
    // Ignore generated output and binaries up-front so plugins don't
    // walk into them.
    ignores: [
      'dist',
      'dist-pages',
      'build',
      'node_modules',
      'src/generated/**',
      '.agents/**',
      '.claude/**',
      'thai-quest-trailer-v2/**',
      'tmp/**',
      '**/*.config.{js,ts,mjs,cjs}',
      'scripts/**',
      'server/**',
      'microgame-smoke.mjs',
    ],
  },

  // Base JS rules
  js.configs.recommended,

  // TypeScript rules (non-type-aware tier — fast)
  ...tseslint.configs.recommended,

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        // Vite's import.meta.env etc.
        NodeJS: 'readonly',
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      // React hooks safety — non-negotiable for a React app this size.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Accessibility — the game needs to be playable with captioning and
      // keyboard. Start with the recommended subset; tighten later.
      ...jsxA11y.configs.recommended.rules,
      // Hotspot/dialogue UIs intentionally use non-button clickables backed by
      // pointer events; downgrade these to warn so they show up without
      // blocking PRs until we do the a11y pass in Year 2 Q7.
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
      'jsx-a11y/media-has-caption': 'warn',

      // TypeScript ergonomics — strict checks already enforced by tsc. Keep
      // ESLint focused on lint-only concerns.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],

      // General hygiene
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'warn',
    },
  },

  // Test/smoke scripts use console freely
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      'no-console': 'off',
    },
  },
);
