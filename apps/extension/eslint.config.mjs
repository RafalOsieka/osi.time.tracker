import { fileURLToPath } from 'node:url';
import tsParser from '@typescript-eslint/parser';
import vueI18n from '@intlify/eslint-plugin-vue-i18n';
import prettier from 'eslint-config-prettier';
import oxlint from 'eslint-plugin-oxlint';
import vue from 'eslint-plugin-vue';
import vueA11y from 'eslint-plugin-vuejs-accessibility';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  ...vue.configs['flat/recommended'],
  ...vueA11y.configs['flat/recommended'],
  ...vueI18n.configs['flat/recommended'],
  { languageOptions: { ecmaVersion: 'latest', sourceType: 'module' } },
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tsParser },
  },
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tsParser } },
    rules: {
      'vuejs-accessibility/label-has-for': ['error', { required: { some: ['nesting', 'id'] } }],
      '@intlify/vue-i18n/no-raw-text': [
        'error',
        {
          ignoreNodes: ['script', 'style'],
          ignorePattern: '^[-#:()&+×/°′″%.,!?@\\s]+$',
          ignoreText: ['OSI Time Tracker'],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'VariableDeclarator[id.name="props"] > CallExpression[callee.name="defineProps"]',
          message:
            'Destructure defineProps() instead of assigning to `props` (Vue 3.5 keeps destructured props reactive).',
        },
      ],
    },
  },
  {
    settings: {
      'vue-i18n': {
        localeDir: fileURLToPath(new URL('./src/i18n/*.json', import.meta.url)),
        messageSyntaxVersion: '^9.0.0',
      },
    },
  },
  ...oxlint.buildFromOxlintConfigFile(
    fileURLToPath(new URL('../../.oxlintrc.json', import.meta.url)),
  ),
  prettier,
];
