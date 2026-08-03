## Context

`app/pages/index.vue` holds `windowDays = 7` and derives its range through `computeWindowRange()` in `app/utils/timerViewGrouping.ts`, which aligns the window start to the user's `weekStart` whenever the day count is a multiple of 7. `GET /api/time-entries` (REQ-148) accepts only `from`/`to` instants and deliberately performs no timezone or day-boundary logic — the client owns that conversion. With no entries in the computed window the page falls into `isEmpty` and renders the empty state whose CTA is `timerView.loadMore`, which is why a fresh week looks broken.

`app/components/AppTimer.vue` uses `UInputMenu` in autocomplete mode. It does not auto-select the first match in code: `selectedTaskId` is only set by an item's `onSelect`. The problem is the combobox's own highlight — while the overlay is open Enter goes to the combobox, and `onEnter()` returns early (`if (overlayOpen.value) return;`). There is therefore no keyboard path that keeps the typed text when a suggestion matches it.

## Goals / Non-Goals

**Goals:**
- The timer view opens on a week that contains work, honouring the user's `weekStart`.
- The client can tell "empty window" from "never tracked", so a first-run empty state is possible.
- A typed title can always be committed as a new task, even when it collides with existing suggestions.
- Keep the boundary contract of REQ-148 (no server-side day/timezone logic) intact.

**Non-Goals:**
- Free week navigation (date picker, next/previous week).
- Any change to task identity, matching, merging, or remote issue refs (see `per-day-remote-issue-refs`).
- Persisting the anchored window across reloads.

## Decisions

### Anchor the window client-side from a tiny server endpoint

Three options were weighed:

| | approach | verdict |
|---|---|---|
| A | client retries `loadMore()` in a loop until non-empty or a cap | rejected: N round trips, visible flicker, arbitrary cap, still cannot prove "never tracked" |
| B | `GET /api/time-entries/latest` → `{ startedAt } \| null`; client centres its own `weekStart`-aligned window | **chosen** |
| C | `initialLoad=true` on `GET /api/time-entries`, server computes `from = max(startedAt) − 7d` | rejected: forces day/week reasoning into the server, breaking REQ-148's timezone purity, and cannot align to the user's `weekStart` (a server-side setting the range endpoint has no business reading) |

B costs one new route and one indexed `ORDER BY startedAt DESC LIMIT 1` read. It keeps every day-boundary decision on the client, where the effective timezone already lives, and its `null` case is precisely the "never tracked" signal the empty state needs. `computeWindowRange()` gains an optional anchor instant instead of always using `now`, so `weekStart` alignment and the `load more` step are unchanged.

The anchor is fetched once per page load; `load more` and `weekStart` changes re-derive from the cached anchor rather than re-fetching. The page renders a signpost plus a "back to this week" control whenever the anchored window is not the current week — showing a stale week silently would trade one confusion for a worse one.

### Use `UInputMenu`'s `create-item` rather than custom key handling

Alternatives: (i) intercept Enter and suppress the combobox highlight, (ii) add a modifier shortcut, (iii) `create-item` + `@create`. (i) fights reka-ui's combobox semantics and would regress REQ-146's "Enter selects while the overlay is open"; (ii) is undiscoverable. Nuxt UI v4's `create-item` renders a first-class sentinel row that is mouse- and keyboard-reachable, and `@create` maps straight onto the existing `applyFreeformTitle()`, which already nulls `selectedTaskId`. No new state machine.

The sentinel is shown even when an exact match exists (`create-item="always"` semantics) — that collision is the whole point of the feature.

### The sentinel still goes through find-or-create

A project-less create resolves in the project-less scope, so a second `title1` with no project binds to the existing project-less `title1` rather than creating a duplicate row. That is deliberate: REQ-136 uniqueness stays untouched and "one bucket per name per scope" is preserved. Distinguishing two same-named tasks by remote issue is the other change's job.

## Risks / Trade-offs

- **Anchoring can confuse.** Landing on a past week without noticing is worse than an empty page; mitigated by the mandatory signpost and the "back to this week" control.
- **One extra request on first paint.** Trivial, and it can run in parallel with the entry-range request when the anchor turns out to be in the current week (the common case) — the range request is simply re-issued when the anchor moves the window.
- **`create-item` behaviour depends on the Nuxt UI version.** If the installed `UInputMenu` lacks `create-item`, the fallback is an explicitly appended sentinel item plus an `onSelect` that calls `applyFreeformTitle()` — same contract, more local code.
- **Users who genuinely want a duplicate row** will still bind to the existing project-less task. Accepted; the follow-up change addresses same-name disambiguation.
