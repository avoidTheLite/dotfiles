/**
 * Mirrors ~/dotfiles/eslint/eslint.base.js so `npm run lint` works in a
 * standalone app (Node resolves plugins from this project). If you merge into
 * a monorepo that hoists tooling, you may switch to extending the dotfiles base
 * like project-template/eslint.config.js.
 */
import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import n from 'eslint-plugin-n';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        process: 'readonly',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      import: importPlugin,
      n,
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', disallowTypeAnnotations: false },
      ],
      'import/extensions': [
        'error',
        'ignorePackages',
        {
          ts: 'always',
          tsx: 'always',
        },
      ],
      'n/prefer-node-protocol': 'error',
    },
  },
  eslintConfigPrettier,
];
