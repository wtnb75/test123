import js from '@eslint/js';
import parser from '@typescript-eslint/parser';
import plugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: ['dist/**']
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': plugin
    },
    rules: {
      ...plugin.configs.recommended.rules,
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
];
