// @ts-check
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '**/out/',
    '**/build/',
    '**/release/',
    '**/coverage/',
    '**/.turbo/',
    '.yarn/',
    'openspec/',
  ]),

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  {
    files: ['**/*.tsx'],
    extends: [reactHooks.configs.flat.recommended],
  },

  // UI code runs in a browser (or Electron renderer/preload), not in Node.
  {
    files: ['packages/ui/**', 'packages/app/**', 'apps/desktop/src/{renderer,preload}/**'],
    languageOptions: { globals: { ...globals.browser } },
  },

  // Dependency direction: apps -> app -> ui, core. See CLAUDE.md "Layout".
  {
    files: ['packages/core/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: ['react', 'react-dom'],
          patterns: [
            { group: ['node:*'], message: 'core is platform-agnostic: no Node.js modules.' },
            { group: ['@mdconnect/*'], message: 'core depends on no other workspace.' },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/ui/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@mdconnect/app', '@mdconnect/core'],
              message: 'ui is a leaf design system: it may not import app or core.',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // Must stay last: turns off stylistic rules that conflict with Prettier.
  prettier,
);
