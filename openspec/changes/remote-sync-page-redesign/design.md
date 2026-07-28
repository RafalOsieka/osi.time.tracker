## Context

`app/pages/sync/[date].vue` is a single 661-line component: one `role="list"` wrapper, every task rendered fully expanded with its entry checkboxes, rounded-duration input, activity select, remote logs and outcome text inline. State lives in four plain `ref<Record<taskId, …>>` maps (`selectedEntryIds`, `activitySelections`, `localIssueRefs`, plus the `useRoundedDurations` overrides), row state comes from the pure `deriveRemoteSyncRowState`, and remote data comes from `useRemoteActivities` / `useRemoteDayLogs`.

The only aggregate shown is `totalSeconds = Σ row.totalSeconds + untitledTotalSeconds`. Rounded values exist per row but are never summed, so the number that matters most — what will actually be pushed — is nowhere on the page. `RemoteDayLogDto.comment` is parsed by both adapters and never rendered. The page is reachable only from a `NuxtLink` in a Timer-view day header.

```
today                                   proposed
─────────────────────────────           ──────────────────────────────────────
[flat list, all expanded]               ‹ Tue 28 Jul ›  [calendar]
day total 07:12                         day total 07:12 · tracked 06:30 · to send 06:45 (+00:15)
                                        ⚠ 00:45 blocked · 00:20 untitled
row: name + state text                  UTable: ☑ | task | issue | activity | tracked → to send | state badge
     entries, rounded, activity,          └ expanded: entries (all/none) · export duration · comment · remote logs
     remote logs, outcome                footer: the same three totals
```

## Goals / Non-Goals

**Goals:**

- Scan a day in one screen; open only the row you need to touch.
- Make the number that leaves the machine explicit, and make the difference from what was tracked visible before export.
- Never lose an existing `data-testid`, so the current e2e suite keeps passing against the new markup.
- Keep all derivation pure and unit-testable; the page stays a renderer.
- No server or contract change.

**Non-Goals:**

- The export review/progress/report modal (separate change).
- Multi-day views, remote-log mutation, a days-with-entries endpoint.

## Decisions

**1. `UTable` with expandable rows, not `UAccordion`.**
Alternative considered: `UAccordion` with a rich body per row — more readable per task, but it cannot align durations into columns, so scanning "which task sends what" stays impossible. `UTable` gives aligned numeric columns, a header select-all, a footer for totals and an `#expanded` slot for the detail body. Trade-off: the summary line must stay short, so the activity select and the state badge are the only interactive controls in the collapsed row; everything else moves into the expansion.

**2. Three totals, each with a single unambiguous definition.**

| Total | Definition | Why it exists |
|---|---|---|
| **Day total** | Σ of every completed entry attributed to the day, including untitled time and rows that cannot be exported | Must equal the Timer view's day total (REQ-111) — the anchor number |
| **Tracked** | Σ of the *selected* entries of the rows that are included in the export | The truthful local basis of the export; differs from day total exactly by what you excluded |
| **To send** | Σ of the export durations of the rows that will actually be pushed | The number you are accountable for remotely |

`to send` counts only pushable rows — a row that is ticked but blocked (unlinked, no activity, no config) contributes to neither `tracked` nor `to send`; its duration is surfaced separately as a `blocked` badge. Alternative considered: counting selected-but-blocked rows in `to send` so the number "feels complete" — rejected, because a total that lies to make the user feel finished is the worst possible failure mode for a billing tool. Deselected exportable time appears as an `excluded` badge, untitled time as an `untitled` badge, so `day total = tracked + blocked + excluded + untitled` always reconciles.

The `tracked → to send` delta is rendered signed (`+00:15` / `−00:03`) at day level and per row, which matters now that `nearest_*` rules can round down.

**3. Totals are a pure function, not template arithmetic.**
`computeRemoteSyncDayTotals(rows, { untitledSeconds, isPushable, isIncluded, selectedSeconds, exportSeconds })` in `shared/utils/` returns `{ dayTotal, tracked, toSend, blocked, excluded, untitled, delta }`. The page passes closures over its existing per-row helpers. This keeps the reconciliation invariant testable in `test/unit` without mounting the page, and lets the export review modal reuse the identical numbers.

**4. Duplicate detection is a client-side heuristic, warning only.**
The remote logs for the day are already fetched per issue. A row is flagged when a fetched log on the same issue and date has a duration equal to the row's export duration. Rendered as a text+icon badge naming the colliding log id and comment, dismissible per row, and it never affects `isPushable` or disables Export. Alternative considered: server-side reconciliation against provenance — more accurate, but it needs an endpoint and it would still be a guess, since a genuine second log of the same length is legitimate.

**5. Row state stays text-first.**
The state column is a `UBadge` carrying an `i-lucide-*` icon **and** the existing translated reason string, so REQ-116's "not colour alone" holds and the reason remains the accessible text. `data-testid="remote-sync-state-{taskId}"` keeps wrapping exactly that text.

**6. Day navigation is route-driven.**
Previous/next buttons and a calendar `UPopover` push `/sync/<iso>`; `date` is already a computed from the route param and `useAsyncData` already watches it, so no state migration is needed. Day boundaries use the user's configured timezone, matching REQ-111. Any date is reachable; an empty day renders the existing empty state.

**7. Testids are preserved, not renamed.**
The redesign is markup-only from the test suite's point of view: every current hook (`remote-sync-row-*`, `remote-sync-state-*`, `remote-sync-rounded-duration-*`, `remote-sync-entry-check-*`, `remote-sync-remote-log-*`, …) is re-attached to the equivalent element in the new structure. New hooks are added for the expansion toggle, the three totals, the badges, bulk actions and day navigation.

## Risks / Trade-offs

- **Detail hidden behind an expansion could hide a blocked reason** → the state badge and the tracked/to-send pair stay in the collapsed row, and blocked rows are grouped together, so nothing actionable requires expanding.
- **E2E tests assert on elements that are now collapsed** → rows that a test needs to interact with must be expanded first; tasks include auditing the existing specs and adding an explicit expand step rather than weakening assertions.
- **Four numbers plus three badges is a lot of header** → they are laid out as one labelled row of chips with the day total first; the reconciliation identity is asserted in unit tests so the set can be trusted at a glance.
- **Duplicate heuristic false positives** (two legitimate equal logs) → warning only, dismissible, never blocks; the colliding log is named so the user can judge.
- **A large single-file page grows further** → the row body, the summary header and the log list move into `app/components/sync/` components so `[date].vue` stays orchestration only.
