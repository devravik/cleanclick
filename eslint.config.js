import globals from 'globals';

export default [
  {
    ignores: ['dist/', 'node_modules/', '.webpack-cache/'],
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        ...globals.jest,
        browser: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }],
      'no-console': 'warn',
      'no-undef': 'error',
    },
  },
];
