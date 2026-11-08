/** Segment widths the framework fixes per size, released to the segment's own width. */
const DATE_SEGMENT =
  'data-[segment=day]:w-auto data-[segment=month]:w-auto data-[segment=year]:w-auto';
const TIME_SEGMENT = 'not-data-[segment=literal]:w-auto';

/** The segment being typed in carries one cyan wash in both themes (the framework's grey focus
 * fill is invisible on a white field). */
const FOCUSED_SEGMENT = {
  variant: ['outline', 'soft', 'subtle', 'ghost', 'none'],
  class: {
    segment:
      'focus:bg-primary-100 group-hover:focus:bg-primary-100 focus:text-highlighted dark:focus:bg-primary/20 dark:group-hover:focus:bg-primary/20',
  },
};

/** The same segment and gap override for every field size (a size variant outranks a slot). */
function tightSegments(segment: string) {
  const slots = { base: 'gap-0', segment };
  return { xs: slots, sm: slots, md: slots, lg: slots, xl: slots };
}

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
          true: {
            childLink: 'before:bg-primary-100/80 dark:before:bg-primary/12 text-primary',
            childLinkIcon: 'text-primary',
          },
        },
      },
      compoundVariants: [
        {
          variant: 'pill',
          active: true,
          highlight: false,
          class: { link: 'before:bg-primary-100/80 dark:before:bg-primary/12' },
        },
      ],
    },
    // Floating surfaces rise above the cards in dark mode (the elevated layer), and the scrim
    // behind a dialog dims the page in both themes rather than washing it out. Items inside a
    // raised surface highlight on the accented layer, since the elevated one is their ground.
    modal: {
      slots: {
        content: 'dark:bg-elevated',
        footer: 'justify-end gap-2',
      },
      variants: {
        overlay: { true: { overlay: 'bg-neutral-900/35 dark:bg-black/55' } },
      },
      // A centred dialog is placed with margins, not a -50% translate: with an odd height the
      // translate leaves it half a pixel off the grid and smears every horizontal 1px stroke.
      compoundVariants: [
        {
          scrollable: false,
          fullscreen: false,
          class: { content: 'inset-0 m-auto h-fit translate-x-0 translate-y-0' },
        },
      ],
    },
    slideover: {
      slots: { overlay: 'bg-neutral-900/35 dark:bg-black/55', content: 'dark:bg-elevated' },
    },
    // Tinted tiles and chips (soft buttons) carry real colour in both themes: a cyan-100 wash in
    // light mode, a stronger tint in dark mode, where 10% reads as grey.
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
            'dark:bg-error/22 dark:hover:bg-error/30 dark:active:bg-error/30 dark:disabled:bg-error/10 dark:aria-disabled:bg-error/10',
        },
      ],
    },
    // Warning and error alerts use their own warm ramps, not a 10% tint of the status colour
    // (amber over white read beige, amber over slate read olive). In dark mode a warning is a
    // raised neutral surface with an amber edge and icon: any amber wash over slate reads brown.
    alert: {
      compoundVariants: [
        {
          color: 'warning',
          variant: ['soft', 'subtle'],
          class: {
            root: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-elevated dark:text-default dark:ring-amber-400/40',
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
    popover: { slots: { content: 'dark:bg-elevated' } },
    tooltip: { slots: { content: 'dark:bg-elevated' } },
    dropdownMenu: {
      slots: { content: 'dark:bg-elevated' },
      variants: {
        active: {
          false: {
            item: 'dark:data-highlighted:before:bg-accented/60 dark:data-[state=open]:before:bg-accented/60',
          },
        },
      },
    },
    select: {
      slots: {
        content: 'dark:bg-elevated',
        item: 'dark:data-highlighted:not-data-disabled:before:bg-accented/60',
      },
    },
    selectMenu: {
      slots: {
        content: 'dark:bg-elevated',
        item: 'dark:data-highlighted:not-data-disabled:before:bg-accented/60',
      },
    },
    inputMenu: {
      slots: {
        content: 'dark:bg-elevated',
        item: 'dark:data-highlighted:not-data-disabled:before:bg-accented/60',
      },
    },
    // Date and time fields read as one value ("7.11.2026", "09:00"), not as boxes spread across
    // the field: segments take their own width with tabular figures and literals sit tight.
    inputDate: {
      slots: { segment: 'px-0.5 tabular-nums data-[segment=literal]:px-0' },
      variants: { size: tightSegments(DATE_SEGMENT) },
      compoundVariants: [FOCUSED_SEGMENT],
    },
    inputTime: {
      slots: { segment: 'px-0.5 tabular-nums data-[segment=literal]:px-0' },
      variants: { size: tightSegments(TIME_SEGMENT) },
      compoundVariants: [FOCUSED_SEGMENT],
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
