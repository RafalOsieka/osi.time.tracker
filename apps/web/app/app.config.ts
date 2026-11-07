export default defineAppConfig({
  ui: {
    colors: {
      primary: 'cyan',
      neutral: 'zinc',
      warning: 'amber',
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
