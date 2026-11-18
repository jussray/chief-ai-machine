import js from '@eslint/js';

export default [
  {
    ignores: ['docs/**', 'global/**', '.wrangler/**', 'mobile/**'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        document: 'readonly', window: 'readonly', navigator: 'readonly', localStorage: 'readonly',
        fetch: 'readonly', console: 'readonly', URL: 'readonly', Blob: 'readonly', FileReader: 'readonly', CustomEvent: 'readonly',
        TextEncoder: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', confirm: 'readonly', location: 'readonly',
      },
    },
  },
  {
    files: ['worker/**/*.js', 'plugins/proofmode/src/**/*.js', 'plugins/proofmode/worker.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        Response: 'readonly', Request: 'readonly', URL: 'readonly', fetch: 'readonly',
        atob: 'readonly', btoa: 'readonly', crypto: 'readonly', TextDecoder: 'readonly', TextEncoder: 'readonly', Blob: 'readonly', DecompressionStream: 'readonly',
        Headers: 'readonly', Uint8Array: 'readonly',
      },
    },
  },
  {
    files: ['worker/federated-relay-v31.js'],
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^_' }],
      'no-control-regex': 'off',
    },
  },
  {
    files: ['security/**/*.js', 'security/**/*.mjs', 'test/reciprocal-ingress.test.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        Response: 'readonly', Request: 'readonly', URL: 'readonly', fetch: 'readonly',
        crypto: 'readonly', TextEncoder: 'readonly', console: 'readonly',
      },
    },
  },
  {
    files: [
      'scripts/**/*.js', 'scripts/**/*.mjs', 'scripts/**/*.cjs',
      'tools/**/scripts/**/*.js', 'tools/**/scripts/**/*.mjs', 'tools/**/scripts/**/*.cjs',
      'e2e/**/*.pw.mjs', 'playwright.config.js', 'playwright.*.config.mjs',
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
    files: ['**/*.test.js', '**/*.spec.js', 'test/**/*.mjs', 'tests/**/*.mjs', '.github/skills/**/tests/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        describe: 'readonly', it: 'readonly', test: 'readonly', expect: 'readonly',
        window: 'readonly', document: 'readonly', navigator: 'readonly',
        URL: 'readonly', Request: 'readonly', Response: 'readonly', Headers: 'readonly',
        fetch: 'readonly', console: 'readonly', Buffer: 'readonly', process: 'readonly',
        crypto: 'readonly', TextEncoder: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
      },
    },
    rules: {
      'no-redeclare': 'off',
    },
  },
  {
    files: ['security/reciprocal-ingress.mjs', 'src/config/visionGuardrails.js'],
    rules: {
      'no-control-regex': 'off',
    },
  },
];
