import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import n from 'eslint-plugin-n';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      import: importPlugin,
      n,
    },
    rules: {
      // The style guide requires `import type` for type-only imports.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', disallowTypeAnnotations: false },
      ],
      // The style guide requires explicit file extensions in relative imports.
      'import/extensions': [
        'error',
        'ignorePackages',
        {
          ts: 'always',
          tsx: 'always',
        },
      ],
      // The style guide requires `node:` protocol imports for built-ins.
      'n/prefer-node-protocol': 'error',
    },
  },
  // Prettier owns formatting and disables conflicting stylistic rules.
  eslintConfigPrettier,
];
