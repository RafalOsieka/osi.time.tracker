// https://eslint.nuxt.com
import withNuxt from './apps/web/.nuxt/eslint.config.mjs';
import prettier from 'eslint-config-prettier';
import oxlint from 'eslint-plugin-oxlint';
import vueA11y from 'eslint-plugin-vuejs-accessibility';
import vueI18n from '@intlify/eslint-plugin-vue-i18n';
import tsParser from '@typescript-eslint/parser';
import viteConfig from './vite.config.ts';

export default withNuxt()
  .prepend({
    // This prepend is need, as for some reason the default configuration
    // is missing the typescript parser for vue (script lang="ts"),
    // which causes some false lint issues being reported.
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
      },
    },
  })
  .append(vueA11y.configs['flat/recommended']) // Accessibility rules (before Prettier)
  .append({
    rules: {
      // Nuxt UI form controls render native inputs; declare them as control components
      // so label-has-for can verify label association without inline disables.
      'vuejs-accessibility/label-has-for': [
        'error',
        {
          controlComponents: [
            // Nuxt UI
            'UInput',
            'UTextarea',
            'USelect',
            'USelectMenu',
            'UInputMenu',
            'UInputNumber',
            'UInputDate',
            'UInputTime',
            'UInputTags',
            'UPinInput',
            'UCheckbox',
            'UCheckboxGroup',
            'URadioGroup',
            'USwitch',
            'USlider',
            'UFileUpload',
          ],
          required: { some: ['nesting', 'id'] },
        },
      ],
    },
  })
  .append(...vueI18n.configs['flat/recommended']) // i18n rules (before Prettier)
  .append({
    rules: {
      // Enforce no raw text in templates; ignore icon-only content, punctuation,
      // numeric/unit literals, and data-* attribute values.
      '@intlify/vue-i18n/no-raw-text': [
        'error',
        {
          ignoreNodes: ['script', 'style'],
          ignorePattern: '^[-#:()&+×/°′″%.,!?@\\s]+$',
          ignoreText: ['OSI Time Tracker'],
        },
      ],
    },
    settings: {
      'vue-i18n': {
        localeDir: './apps/web/i18n/locales/*.json',
        messageSyntaxVersion: '^9.0.0',
      },
    },
  })
  .append({
    files: ['apps/extension/**/*.{vue,ts,js}'],
    settings: {
      'vue-i18n': {
        localeDir: './apps/extension/src/i18n/*.json',
        messageSyntaxVersion: '^9.0.0',
      },
    },
  })
  .append({
    files: ['**/*.vue'],
    rules: {
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
  })
  .append({
    // Server-rendered markup is visible before Vue attaches handlers; acting on it
    // early is silently lost (or submits forms natively). See docs/e2e-guideline.md.
    files: ['apps/web/test/e2e/ui/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression[callee.property.name="goto"]:not(:has(Property[key.name="waitUntil"][value.value="hydration"]))',
          message: "Pass `{ waitUntil: 'hydration' }` to page.goto() in UI e2e tests.",
        },
        {
          selector: 'CallExpression[callee.property.name="reload"]',
          message: 'Use reloadHydrated(page) from helpers/ui instead of page.reload().',
        },
      ],
    },
  })
  .override('nuxt/typescript/rules', {
    rules: {
      // Enforce no-explicit-any rule to guarantee boundary types and avoid type erosion.
      // Escape hatch: oxlint-disable-next-line typescript/no-explicit-any -- reason.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  })
  // Oxlint rules live in the `lint` block of vite.config.ts (Vite+).
  .append(...oxlint.buildFromOxlintConfig(viteConfig.lint))
  .append(prettier) // Keep last: disables ESLint stylistic rules that conflict with Oxfmt.
  .append({
    ignores: [
      '.nuxt',
      '.output',
      'node_modules',
      'dist',
      'apps/web/.nuxt',
      'apps/web/.output',
      'apps/migrator/migrations',
      'packages/*/dist',
      'apps/extension/dist',
      'apps/web/app/pages/**/*.vue',
      'apps/web/app/layouts/**/*.vue',
    ],
  });
