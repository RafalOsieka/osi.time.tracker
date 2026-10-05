import type { ButtonProps } from '@nuxt/ui';

/**
 * Compile-time guard: Nuxt UI's variant props come from theme types the Vite plugin generates in
 * `node_modules/.nuxt-ui`. When those are missing, every variant prop silently accepts any value,
 * so this assignment stops compiling instead. The `type-check` script builds first to generate them.
 */
export const nuxtUiThemeTypesResolved: 'not-a-color' extends NonNullable<ButtonProps['color']>
  ? never
  : true = true;
