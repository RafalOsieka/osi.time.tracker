// https://eslint.nuxt.com
import withNuxt from './.nuxt/eslint.config.mjs';
import prettier from 'eslint-config-prettier';

export default withNuxt()
  // Project-specific rule overrides go here.
  .append(prettier) // Keep last: disables ESLint stylistic rules that conflict with Prettier.
  .append({
    ignores: ['.nuxt', '.output', 'node_modules', 'dist', 'server/db/migrations'],
  });
