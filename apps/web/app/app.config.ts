export default defineAppConfig({
  ui: {
    colors: {
      primary: 'cyan',
      neutral: 'slate',
      warning: 'amber',
    },
    // The selected navigation item sits on a cyan wash rather than a grey one.
    navigationMenu: {
      variants: {
        active: {
          true: { childLink: 'before:bg-primary/10 text-primary', childLinkIcon: 'text-primary' },
        },
      },
      compoundVariants: [
        {
          variant: 'pill',
          active: true,
          highlight: false,
          class: { link: 'before:bg-primary/10' },
        },
      ],
    },
    // Cards sit one layer above the page in dark mode (layered greys), flush with it in light.
    card: {
      variants: {
        variant: {
          outline: { root: 'bg-default dark:bg-muted ring ring-default divide-y divide-default' },
        },
      },
    },
    // One table style for every list: quiet 12px headers, 44px rows, primary text in cells
    // (pages emphasise their first column themselves).
    table: {
      slots: {
        th: 'px-4 py-2.5 text-xs font-medium text-muted text-start [&:has([role=checkbox])]:pe-0',
        td: 'px-4 py-3 text-sm text-default whitespace-nowrap [&:has([role=checkbox])]:pe-0',
        separator: 'absolute z-1 start-0 w-full h-px bg-(--ui-border)',
      },
    },
  },
});
