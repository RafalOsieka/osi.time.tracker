// https://eslint.nuxt.com
import withNuxt from './.nuxt/eslint.config.mjs';
import prettier from 'eslint-config-prettier';
import vueA11y from 'eslint-plugin-vuejs-accessibility';
import vueI18n from '@intlify/eslint-plugin-vue-i18n';

export default withNuxt()
  // Project-specific rule overrides go here.
  .append(vueA11y.configs['flat/recommended']) // Accessibility rules (before Prettier)
  .append({
    rules: {
      // PrimeVue InputText and Password render native inputs; declare them as control components
      // so label-has-for can verify label association without inline disables.
      'vuejs-accessibility/label-has-for': [
        'error',
        {
          controlComponents: ['InputText', 'Password'],
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
        localeDir: './i18n/locales/*.json',
        messageSyntaxVersion: '^9.0.0',
      },
    },
  })
  .append(prettier) // Keep last: disables ESLint stylistic rules that conflict with Prettier.
  .append({
    ignores: ['.nuxt', '.output', 'node_modules', 'dist', 'server/db/migrations'],
  });
