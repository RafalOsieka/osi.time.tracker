import type ui from '@nuxt/ui/vite';

/**
 * Nuxt UI in plain Vue mode (design D1): explicit component imports, no router, and our own
 * light/dark state instead of the system-aware color mode. Icons are bundled at build time so the
 * extension pages never fetch them. Shared by the build (`vite.config.ts`) and the unit tests.
 *
 * The theme mirrors the web app's `apps/web/app/app.config.ts` for the components the extension
 * uses: keep the two in sync when the web app's design system changes.
 */
export const nuxtUiOptions = {
  router: false,
  colorMode: false,
  components: false,
  autoImport: false,
  dts: false,
  icon: { clientBundle: { scan: true } },
  experimental: { componentDetection: true },
  ui: {
    colors: { primary: 'cyan', neutral: 'slate', warning: 'amber' },
    // Floating surfaces rise above the cards in dark mode, and the dialog scrim dims the page.
    modal: {
      slots: { content: 'dark:bg-elevated', title: 'text-base', footer: 'justify-end gap-2' },
      variants: { overlay: { true: { overlay: 'bg-neutral-900/35 dark:bg-black/55' } } },
    },
    // Tinted tiles and chips (soft buttons) carry real colour in both themes.
    button: {
      compoundVariants: [
        {
          color: 'primary',
          variant: 'soft',
          class:
            'bg-primary-100/80 hover:bg-primary-100 active:bg-primary-100 disabled:bg-primary-100/60 aria-disabled:bg-primary-100/60 dark:bg-primary/16 dark:hover:bg-primary/24 dark:active:bg-primary/24 dark:disabled:bg-primary/10 dark:aria-disabled:bg-primary/10',
        },
        {
          color: 'error',
          variant: 'soft',
          class:
            'dark:bg-error/16 dark:hover:bg-error/24 dark:active:bg-error/24 dark:disabled:bg-error/10 dark:aria-disabled:bg-error/10',
        },
      ],
    },
    // Warning and error alerts use their own warm ramps, not a 10% tint of the status colour.
    alert: {
      compoundVariants: [
        {
          color: 'warning',
          variant: ['soft', 'subtle'],
          class: {
            root: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-400/25',
            icon: 'text-amber-600 dark:text-amber-400',
          },
        },
        {
          color: 'error',
          variant: ['soft', 'subtle'],
          class: {
            root: 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-400/25',
            icon: 'text-red-600 dark:text-red-400',
          },
        },
      ],
    },
    tooltip: { slots: { content: 'dark:bg-elevated' } },
    select: {
      slots: {
        content: 'dark:bg-elevated',
        item: 'dark:data-highlighted:not-data-disabled:before:bg-accented/60',
      },
    },
    toast: { slots: { root: 'dark:bg-elevated' } },
    // Cards sit one layer above the page in dark mode (layered greys), white on slate in light.
    card: {
      variants: {
        variant: {
          outline: { root: 'bg-default dark:bg-muted ring ring-default divide-y divide-default' },
        },
      },
    },
  },
} satisfies Parameters<typeof ui>[0];
