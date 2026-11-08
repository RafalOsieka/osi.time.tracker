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
    // Tinted tiles and chips (soft buttons) carry real colour in both themes (the dark delete
    // tile a deep clean red, not maroon, as in the web app), a warning outline
    // reaches the 3:1 control outline, and the destructive
    // solid stays a true red with white text in dark mode too.
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
            'dark:bg-red-900/60 dark:hover:bg-red-900/85 dark:active:bg-red-900/85 dark:disabled:bg-red-900/30 dark:aria-disabled:bg-red-900/30',
        },
        {
          color: 'warning',
          variant: 'outline',
          class: 'ring-warning dark:ring-warning/70',
        },
        {
          color: 'error',
          variant: 'solid',
          class:
            'dark:bg-red-600 dark:text-white dark:hover:bg-red-700 dark:active:bg-red-700 dark:disabled:bg-red-600 dark:aria-disabled:bg-red-600',
        },
      ],
    },
    // One alert recipe in both themes, as in the web app: a neutral surface and body, with the
    // colour only on the edge and the icon. The icon sits on the title line, and the explanation
    // fills the measure beside the action instead of breaking early. A two-sentence body may
    // put its reassurance on a line of its own with a line break in the message.
    alert: {
      slots: { description: 'opacity-100 whitespace-pre-line text-pretty' },
      variants: {
        orientation: { horizontal: { root: 'items-start', actions: 'self-center' } },
      },
      compoundVariants: [
        {
          color: 'warning',
          variant: ['soft', 'subtle'],
          class: {
            root: 'bg-default text-default ring-amber-400/70 dark:bg-elevated dark:ring-amber-400/40',
            title: 'text-highlighted',
            icon: 'text-warning',
          },
        },
        {
          color: 'error',
          variant: ['soft', 'subtle'],
          class: {
            root: 'bg-default text-default ring-red-400/60 dark:bg-elevated dark:ring-red-400/40',
            title: 'text-highlighted',
            icon: 'text-red-600 dark:text-red-400',
          },
        },
      ],
    },
    formField: { slots: { help: 'text-pretty', description: 'text-pretty' } },
    // Badges and count chips are fully rounded pills, so a status never looks like a button.
    // Warning badges use the same amber ramp as warning alerts.
    badge: {
      variants: {
        size: {
          xs: { base: 'rounded-full' },
          sm: { base: 'rounded-full px-2' },
          md: { base: 'rounded-full px-2.5' },
          lg: { base: 'rounded-full px-3' },
          xl: { base: 'rounded-full px-3' },
        },
      },
      compoundVariants: [
        {
          color: 'warning',
          variant: 'soft',
          class: 'bg-amber-50 text-amber-700 dark:bg-amber-400/12 dark:text-amber-300',
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
    // Toasts fit the right gutter beside the 640px setup column at desktop width, clear of its
    // row actions.
    toaster: { slots: { viewport: 'sm:w-72' } },
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
