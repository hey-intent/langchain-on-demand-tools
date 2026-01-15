// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // Add any custom rules here
    },
  },
  // Config files without type checking
  {
    files: ['*.config.ts', '*.config.js'],
    extends: [tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        project: false,
      },
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'eslint.config.js', 'vitest.config.ts'],
  }
);