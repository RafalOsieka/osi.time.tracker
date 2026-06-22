// https://eslint.nuxt.com
import withNuxt from './.nuxt/eslint.config.mjs';
import prettier from 'eslint-config-prettier';
import vueA11y from 'eslint-plugin-vuejs-accessibility';

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
  .append(prettier) // Keep last: disables ESLint stylistic rules that conflict with Prettier.
  .append({
    ignores: ['.nuxt', '.output', 'node_modules', 'dist', 'server/db/migrations'],
  });
