## Context

See `proposal.md` for motivation. The page currently splits its outer header between
`SyncDayHeader` (long date heading plus four navigation actions) and the page (two day-level bulk
actions plus Export). The monthly report already establishes a compact period-switcher pattern.

## Goals / Non-Goals

**Goals:**

- Give the page one clear header hierarchy and one primary action.
- Keep date routing and calendar behavior inside the existing header component.
- Remove obsolete day-level bulk-selection state changes without disturbing task-level selection.

**Non-Goals:**

- Extracting a generic period-navigation component before a third proven use case exists.
- Moving summaries, table rendering, or export orchestration out of the page.
- Changing the date route format or adding persisted review state.

## Decisions

### Keep a feature-specific header component

`SyncDayHeader` will render the stable title and the full right-side action cluster. It will receive
the compact date label and Export state from the page, emit navigation and export intents, and retain
the date popover's local input state.

**Alternative considered:** compose `TableHeader` with separate period controls in the page. That
component assumes a create action and cannot express a date switcher without broadening an otherwise
simple API.

### Make the localized date label the calendar trigger

The center label will use a short localized day/month/year representation without a weekday. Making
it the popover trigger preserves arbitrary-date navigation while removing the separate Today and Pick
date buttons.

**Alternative considered:** keep a calendar-icon button beside the label. This preserves the current
affordance but adds another control to a header being simplified.

### Remove only day-level bulk-selection helpers

The page-level helper functions, controls, translations, and dedicated tests will be removed.
Task inclusion, select-all/deselect-all within expanded task details, default selection, and summary
recalculation remain unchanged.

**Alternative considered:** relocate day-level bulk actions near the table. Their reported lack of
use does not justify retaining the additional destructive selection surface.

## Risks / Trade-offs

- [The date label may not look interactive] -> Render it as a button with calendar semantics, focus
  styling, an accessible label, and the existing popover behavior.
- [Removing Today adds clicks for distant dates] -> Arbitrary calendar selection remains available;
  direct previous/next navigation covers the common adjacent-day flow.
- [Header actions may wrap on small screens] -> Use the existing responsive flex-wrap pattern and a
  short locale-aware date while keeping logical keyboard order.
- [Legacy tests may encode removed controls] -> Update only tests whose expected behavior is changed
  and retain stable hooks for unchanged behavior.

## Migration Plan

Ship as a frontend-only replacement with no data migration or compatibility window. Rollback consists
of restoring the previous header controls, helper functions, translations, and corresponding tests.