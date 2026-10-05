import type ui from '@nuxt/ui/vite';

/**
 * Nuxt UI in plain Vue mode (design D1): explicit component imports, no router, and our own
 * light/dark state instead of the system-aware color mode. Icons are bundled at build time so the
 * extension pages never fetch them. Shared by the build (`vite.config.ts`) and the unit tests.
 */
export const nuxtUiOptions = {
  router: false,
  colorMode: false,
  components: false,
  autoImport: false,
  dts: false,
  icon: { clientBundle: { scan: true } },
  experimental: { componentDetection: true },
  ui: { colors: { primary: 'cyan', neutral: 'slate' } },
} satisfies Parameters<typeof ui>[0];
