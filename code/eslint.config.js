import js from '@eslint/js';
import globals from 'globals';
import pluginVue from 'eslint-plugin-vue';

export default [
  {
    ignores: [
      '**/node_modules/**', '**/dist/**', '**/unpackage/**', '**/TestEvidence/**', '**/BuildArtifacts/**',
      'uniCloud-tcb/cloudfunctions/game-service/lib/domain.cjs',
    ],
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.{js,mjs,cjs,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
        uni: 'readonly', wx: 'readonly', uniCloud: 'readonly', getApp: 'readonly', WeixinJSBridge: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-empty-pattern': 'off',
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
  },
];
