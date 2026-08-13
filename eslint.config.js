import js from '@eslint/js';

export default [
  {
    ignores: ['docs/**', 'global/**', '.wrangler/**'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        document: 'readonly', window: 'readonly', navigator: 'readonly', localStorage: 'readonly',
        fetch: 'readonly', console: 'readonly', URL: 'readonly', Blob: 'readonly', FileReader: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly', confirm: 'readonly', location: 'readonly',
      },
    },
  },
  {
    files: ['worker/**/*.js', 'plugins/proofmode/src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        Response: 'readonly', Request: 'readonly', URL: 'readonly', fetch: 'readonly',
        atob: 'readonly', TextDecoder: 'readonly',
      },
    },
  },
  {
    files: [
      'scripts/**/*.js', 'scripts/**/*.mjs', 'scripts/**/*.cjs',
      'tools/**/scripts/**/*.js', 'tools/**/scripts/**/*.mjs', 'tools/**/scripts/**/*.cjs',
      'e2e/proofmode-mcp.pw.mjs',
    ],
    ignores: ['scripts/verify-mcp-config.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly', process: 'readonly', fetch: 'readonly', Buffer: 'readonly', URL: 'readonly', setTimeout: 'readonly',
      },
    },
  },
  {
    files: ['**/*.test.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        describe: 'readonly', it: 'readonly', test: 'readonly', expect: 'readonly',
      },
    },
  },
];
