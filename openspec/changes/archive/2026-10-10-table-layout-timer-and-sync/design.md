# Design

## Context

- Both pages build rows on `CompactExpandableRow.vue`, a per-row grid below `lg` and a flex row from `lg` up. Slot widths come from each row: `RemoteIssuePicker` is `shrink-0`, the Sync issue is `max-w-48`, and the Sync duration cluster grows past `min-w-[4.5rem]`. Expanded entries (`TimerEntryRow`) are their own flex rows with `pl-7`, and Sync details (`SyncRowDetail`) are two panes of sentences.
- Each Timer day is a separate list in `pages/index.vue`. The day total sits in a `justify-between` header.
- Inline editors are `UInput size="xs"` (`px-2`, `text-sm`). Picker buttons are `UButton size="xs"` (`px-2`, `text-xs`). Icon buttons are 24px with a 16px icon. Their text therefore starts 8px (4px for icons) after the cell edge, while a header label starts on it.
- The page scrolls inside `UDashboardPanel`'s body (`overflow-y-auto p-4 sm:p-6`), under the navbar. The sidebar is 12–20rem wide (4rem collapsed), so the list is about 720px wide at `lg` with the default sidebar, and wider on a tablet without one.
- Remote logs (`useRemoteDayLogs`) load at page entry, one fetch per tracker for the day's linked issues, keyed per tracker with `loading`/`errorKey`/`loaded`. Day summaries come from `shared/utils/remote-sync-day-totals.ts`.
- No test asserts layout geometry today.
- Visual reference: `mockups/timer-and-sync.html`. It is static and includes a theme switch, list-width presets (343/600/720/912/1100), Sync scenarios (loaded, loading, extension not approved) and a cell-edge overlay. Nuxt UI renders the real components. The mockup fixes structure, column tracks, alignment, spacing and states.

## Goals / Non-Goals

**Goals:**
- One reusable column-list primitive that both pages use, with typed column keys.
- Alignment that holds by construction and is pinned by e2e geometry checks.
- Every existing `data-testid`, accessible name and editing flow stays, except the hooks for the removed summaries.

**Non-Goals:**
- Turning other pages (Projects, Trackers, reports, which use `UTable`) into the primitive.
- Arrow-key grid navigation.

## Decisions

### D1. CSS grid with subgrid rows and ARIA table roles
A list container defines `grid-template-columns` once. Each row is `col-span-full grid grid-cols-subgrid`, and so are detail rows, status rows and day headings, so every row places cells on the same tracks. The roles are `table`, `row`, `columnheader`, `cell`, plus `rowheader` for Timer day headings. The day date stays an `h2` inside it (REQ-154). Expansion keeps `aria-expanded` and `aria-controls`.
- *Alternative: native `<table>` with `table-layout: fixed`.* Fixed tracks and `colspan` work, but the narrow layout has to re-place cells onto other lines (D5). That needs grid placement, which a table cannot do without overriding its display, and then table semantics must be restored with roles anyway.
- *Alternative: `UTable`.* Sticky headers and expansion come for free, but the cells hold inline editors, cross-column spans, day heading rows and a multi-line narrow layout. Fighting TanStack's row model for each of these costs more than the primitive.
- *Alternative: `role="treegrid"`.* It is the strictly correct role for expandable rows, but it requires roving focus and arrow-key navigation. Tab order is what both pages offer today.

### D2. A typed column definition per list
Each page declares its columns as a `const` array of `{ key, track, header?, headerSrOnly?, align? }`. `track` is either a fixed `rem` width or `{ fr, min }`, rendered as `minmax(min, Nfr)`. The list builds the template from it. Cells take `col` (and optionally `to` for spans) typed as that list's key union, so a typo is a type error, and placement never relies on index arithmetic at call sites. Tracks follow the mockup:
- Timer: `1.5rem 1.25rem minmax(8rem,3fr) minmax(7rem,1.2fr) 4.5rem 5rem 1.5rem`.
- Sync: `1.5rem 1.5rem minmax(8rem,3fr) minmax(6rem,1.5fr) minmax(6rem,1fr) 5rem 6rem 1.5rem`.

Fixed tracks hold predictable content: toggle, count, `#id`, durations and action. Text tracks scale with the list only (REQ-497).
- *Alternative: `auto` tracks sized by content, as in the PDF.* This matches the PDF, but columns jump on edits, links and load more (verified in an early mockup round).
- *Alternative: every track in `rem`.* This is stable, but at 720px the Sync title would get about 36px.

### D3. Text-edge alignment by moving control padding into the gap
Controls keep their padding and hover fill and pull it into the 12px column gap with a negative start margin equal to the padding. Text controls get `-ms-2` with `w-[calc(100%+0.5rem)]` (InlineEditText root, project and activity buttons, "Link"). Icon-only controls get `-ms-1`. `RemoteIssuePicker`'s linked button moves from `justify-center` to `justify-start`. Edit mode uses the same `px-2`, so activating does not move the text (REQ-498). The Sync activity button becomes content-wide instead of `w-full`.
- *Alternative: indent the headers by 8px.* One column mixes plain text (`#4821`, day labels, "—") and controls, so a fixed header indent matches only one kind.

### D4. Sticky headers inside the panel body
The header row is `sticky top-0` with the page background and a bottom border, inside the panel body that scrolls. A `stickyHeader` prop (default `true`) keeps the choice reversible in one place. The Sync state column header is `sr-only`.
- *Alternative: a header outside the list, in the page header.* It would scroll with nothing and could not share the column tracks.

### D5. Narrow layout by container query
The list wrapper is `@container/list`. At `@max-[40rem]/list` rows switch from subgrid to a per-row grid with fixed right tracks (duration and action) and explicit line placement. Headers become `sr-only`. Placement per page:
- Timer group: count, title, duration, action on line 1; project and issue on line 2.
- Timer entry: times, duration, delete on line 1; title on line 2.
- Sync row: state and title on line 1; issue and tracked on line 2; activity and "→ to send" on line 3.

The switch follows the list width, so a tablet without a sidebar keeps the columns and a widened sidebar at `lg` wraps (REQ-500).
- *Alternative: keep the viewport `lg` breakpoint.* That is simpler, but it gives a 950px tablet list the fallback while a 660px desktop list keeps a cramped table.

### D6. Timer view as one list
`pages/index.vue` renders one list. Each day emits a heading row (date, Remote Sync link, total in the duration column) followed by its groups. `TimerTaskGroup` renders a row of cells and `TimerEntryRow` a detail row. The skeleton mimics rows. The load-more button and sentinel stay after the list.

### D7. Remote Sync rows, details and errors
- `SyncDayRow` renders cells. The state is an icon cell whose tooltip-styled popover (see Touch below) and accessible name give "label – reason", using distinct icons per kind: arrow-up circle, double check, spinner, alert. The duration cluster splits into tracked and to-send cells, with the delta tooltip on to-send.
- The activity error cell shows an alert icon with the message and a short "Retry". Extension guidance and `ExtensionApprovalRequest` render as a full-width row (`col-start-3 col-end-[-1]`) directly after the task row, before its detail rows.
- `SyncRowDetail` emits detail rows:
  - a local-entries label, then entries with their duration in the tracked column;
  - a remote-logs label, then logs: link-state icon in the state column, `#id · comment` across the issue span, activity, duration in the to-send column, action in the actions column;
  - loading, error and empty states as full-width rows.
- Touch: `UTooltip` (reka `TooltipTrigger`) ignores touch pointers and pointer-caused focus, so a tap would never show the reason. The state and activity-error icons therefore use `UPopover` with `mode="hover"` and `enable-touch`, styled like the tooltip. Reka's `HoverCardTrigger` opens on hover, on focus and, with `enableTouch`, on tap. The reason also stays in the trigger's accessible name.
  - *Alternative: `UTooltip` plus a tap handler.* It would mean two open paths to keep in sync for one icon.

### D8. In-tracker summary as a pure, typed reduction
`computeRemoteSyncDayTotals` shrinks to `{ dayTotal, toSend }`. A new pure `computeInTrackerSummary(logStates, toSendSeconds)` returns a discriminated union:
- `{ status: 'loading' }`;
- `{ status: 'unavailable', trackers: [{ name, messageKey, retryable }] }`;
- `{ status: 'ready', logsSeconds, toSendSeconds, totalSeconds }`.

Logs are deduplicated by `trackerId:remoteLogId` across the per-tracker states. Any loading tracker yields `loading`, and any error yields `unavailable`, so no partial sum is shown (REQ-510). `retryable` is false for errors that a retry cannot fix on this device (extension unavailable). The page renders two summary cards. The removed summaries' i18n keys and `data-testid`s go away.
- *Alternative: derive "in tracker" from finalized export provenance.* It is always available and needs no loading state, but it misses logs added in the tracker, which are exactly what causes double booking.

### D9. Geometry in e2e
New UI e2e assertions use `boundingBox()` at a fixed viewport:
- the right edge of durations is shared across group, entry and day rows;
- the header label `x` equals the first cell content `x` for Project, Issue, Title and Activity (within 1px);
- column widths do not change after an inline edit, after linking an issue and after load more;
- at a 375px viewport, rows have no horizontal overflow.

## Risks / Trade-offs

- [`subgrid` and container queries need current browsers (Chrome/Edge 117+, Firefox 71+/110+, Safari 16+)] → The app already targets evergreen browsers, and the extension is Chrome/Edge only.
- [Table semantics with interactive cells can be verbose in screen readers] → Headers give context ("Project: OSI Time Tracker"), expansion stays a labelled button, and no roving focus is introduced (D1).
- [Icon-only state hides the reason from sighted users until hover] → The reason opens on hover, focus and tap (D7), stays in the accessible name, and the icon shapes are distinct. Accepted as a deliberate choice (proposal).
- [Negative margins can overlap a neighbor's focus ring] → The 12px gap is larger than the 8px bleed. Focus rings use the inset style that Nuxt UI already uses. The cell-edge overlay in the mockup helps verify this.
- [Narrow placement duplicates layout rules per page] → It is kept to container-variant classes beside each row component and covered by the 375px e2e check.

## Migration Plan

UI only, with no data or API change. A rollback is a revert of the change's commits.
