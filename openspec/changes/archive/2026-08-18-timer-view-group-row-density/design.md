## Context

See proposal.md for motivation and the delta specs (REQ-265, REQ-107, REQ-131, REQ-178) for the behavior contract.

Today `TimerTaskGroup` and `TimerEntryRow` size title/project display fields with `ch` widths on readonly `UInput`s (REQ-178's previous "MAY"). The group header is a single nowrap flex row; `TimeInput` compact mode is `width: 5.5ch` **outer**, so `UInput` padding clips `HH:mm`. Unlinked remote status is the visible `(unlinked)` / `(niepołączone)` phrase beside the existing pencil.

`index.vue` stays the feed orchestrator. No day-section extraction. No API or grouping changes. `combineWithEntryDay` stays: inline times do not change the local date.

## Goals / Non-Goals

**Goals:**
- Slot-owned widths so truncate and display→edit swaps do not jump the row.
- Viewport `lg` (same cut as shell REQ-066) switches one-row vs two-line group headers.
- Reuse existing i18n phrases as accessible names / tooltips.

**Non-Goals:**
- Design-level restatement of proposal non-goals (date popover, PWA, `TimerDaySection`).
- New shared primitive beyond `OverflowTooltip` (a thin `UTooltip` wrapper that enables only on overflow) and existing Nuxt UI pieces (`UTooltip`, `UBadge`, `UInput`, `UPopover`, `TimeInput`).
- Container-query breakpoints. Overflow is measured with `scrollWidth > clientWidth` (no `ResizeObserver`).

## Decisions

### 1. Keep REQ-178 `UInput` display; drop `ch` widths

| Option | Notes |
|--------|--------|
| **A. `UInput` in a flex/`min-w-0` slot, `w-full`, CSS truncate** | Honors REQ-178 (no `UButton`-as-text); slot owns width | **chosen** |
| B. Display `UButton` + swap to `UInput` | Better native truncate, but contradicts REQ-178 |
| C. Keep `ch` widths and only cap with `max-w-full` | Two siblings each `max-w-full` still overflow together |

Title slot: `flex-1 min-w-0` with `UInput` none/ghost. Project slot: pinned `w-48 min-w-0` so the title wins leftover space; the control is a `UButton` that opens a non-modal `UPopover` listbox (one click; `USelect` overlay swallowed the first click and jumped). Editor/list fills the same box. Delete `titleDisplayWidth` / `titleInputWidth` / `projectSelectWidth` style bindings. Untitled groups use the same title and project slots; project is disabled until a title exists.

### 2. Tooltip only when the text overflows

| Option | Notes |
|--------|--------|
| A. Always attach `UTooltip` (full value) | Simple, but a short title sits in a `w-full` slot so the tip is centered on empty space |
| **B. Tooltip only when `scrollWidth > clientWidth`** | Matches “show the rest of a truncated name”; no tip when the string fits | **chosen** |
| C. Native `title` | Fails keyboard focus (REQ-265) |

`OverflowTooltip` measures the nested input (and re-measures on resize / text change). `UTooltip` is `disabled` when the value fits; when shown, `content.align` is `start` so the tip sits on the text, not the slot midpoint. Wrap the display control, not the editor. Existing `aria-label`s stay. Unlinked-status icon keeps an always-on tooltip (there is no overflow).

### 3. Two-line header at viewport `lg`, not content width

REQ-265 ties the split to the shell desktop rail breakpoint (viewport `lg`). Implement with Tailwind `lg:` on the group header (one flex row at `lg+`; stacked two rows below).

| Option | Notes |
|--------|--------|
| **A. Viewport `lg:`** | One breakpoint, matches sidebar drawer vs rail | **chosen** |
| B. Always two-line | Simpler CSS; wastes vertical scan on a 30-day feed at 1440px |
| C. Container query on the content panel | Would two-line a rail-open ~750px column; second mental model, not what REQ-265 says |

**Consequence:** at `lg` with the rail open, content can be ~736px on a **single** row. Truncate + frozen `shrink-0` chrome (count, duration, remote, continue) MUST prevent overflow there. That is acceptable; it is the case the slot model exists for.

Line 1 (below `lg`): toggle, title slot, duration, continue.  
Line 2: project slot, remote status + picker. A live group uses the same animated stop control as the shell widget.

### 4. Count `UBadge`; compact remote-issue chrome

- Count: fixed-width `UBadge` (`w-5`) immediately left of the title; visible `1`–`9` or `9+`; `aria-label` = existing `timerView.entryCount` / `entryCountOne` with the real count.
- Linked: `#<id>` is the only in-flow control; click opens the remote URL. Hover/focus reveals an Edit dropdown (pencil + localized Edit) that opens the picker. The `#id` and the unlinked icon share a reserved `w-6` / `min-w-6` slot so a one-digit id aligns with the icon.
- Unlinked (tracker present): compact activating `i-lucide-link-2-off` (`size="xs"`) whose tooltip and accessible name are the sentence `timerView.remoteIssue.unlinked` (not a parenthetical phrase).
- No tracker / no project: the same icon, disabled and dimmed (`text-dimmed`), with a reason tooltip. Always reserve the slot.
- Remote Sync page unlinked copy is unchanged.

### 5. Duration chrome, not a fake button

Copy AppTimer's utilities onto group and entry totals: `min-w-[4.5rem] font-mono tabular-nums` (right-aligned on the row). Keep them `<span>`s. AppTimer's elapsed stays the activating `UButton`.

| Option | Notes |
|--------|--------|
| **A. Shared utility classes on a span** | Visual parity, no dishonest control | **chosen** |
| B. Disabled / no-op `UButton` | Matches padding exactly; extra tab stops, no action |
| C. New `DurationText` component | YAGNI for three class names |

Day heading total uses the same utilities on the duration portion of `timerView.dayTotal`.

### 6. Compact `TimeInput` reserves padding

Change compact from `width: 5.5ch` (outer) to a reserved slot (`w-[10ch]`) that fits `HH:mm` **plus** default outlined `UInput` padding/border. Display is a readonly `UInput variant="none"` in that slot; the editor is compact `TimeInput` `variant="outline"` `size="xs"` filling the same box, with matching `text-sm/4 tabular-nums` so the digits do not jump.

Do not introduce a date field. `combineWithEntryDay` remains.

### 8. Live group action is stop, not a phrase

Drop the visible live label. When `isLive`, the group action is the same square stop control as `AppTimer` (`i-lucide-square`, error, `animate-timer-stop-icon`). Click emits `stop` → `useTimer().stop()`. Idle groups keep play/continue.

### 9. Untitled groups share named-group chrome

No group-level bulk-assign button. Untitled title shows `(no title)` / `(brak tytułu)` and commits via `POST /api/time-entries/reassign` with the day's untitled entry ids. Project assign is disabled until a title exists (`timerView.projectRequiresTitle`). Continue/stop match named groups. The bulk-assign API remains for other callers.

### 10. Compact `xs` row chrome

Group wrapper `py-1`; expand, title, project, continue, entry times, and delete use `size="xs"`. Project must not re-apply `text-sm` over the `xs` type size.

### 7. Tests stay on the existing surfaces

- Nuxt: `timer-task-group.spec.ts`, `timer-entry-row.spec.ts` — long-name tooltip/title, badge vs phrase, unlinked icon not visible phrase, editor activation does not rely on `ch` styles.
- Unit: TimeInput compact shows `09:00` without a `5.5ch` outer width (assert class/style contract).
- E2E: extend `timer-view-ui` for badge + unlinked icon presence and an existing inline time/title edit (no date). Overflow/truncate is asserted in nuxt, not brittle screenshot e2e.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Single row at `lg` + open rail still overflows | Title `flex-1 min-w-0`; chrome `shrink-0`; project `max-w-*` |
| `UInput` truncate is weaker than a button | `truncate` + `min-w-0` on the input `ui` slots; verify in nuxt with a long fixture |
| `UTooltip` around an input fights click-to-edit | Tooltip on display only; editor has no tooltip |
| Compact TimeInput used in the add-entry dialog grows slightly | Accept; full `HH:mm` visibility is required everywhere compact is used |
| Two-line below `lg` also hits phones | Unpolished side effect; PWA change owns a real phone stack later |

## Migration Plan

Frontend-only. Deploy with the web app; no migration or rollback beyond reverting the UI commit. i18n keys are reused, not removed, so older clients are unaffected.

## Open Questions

None — unlinked glyph is `i-lucide-link-2-off`.
