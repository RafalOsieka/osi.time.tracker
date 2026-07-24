# Design — finish-nuxt-ui-style-migration

## Context

Two conventions already coexist in the app:

```
                  STYLE CONVENTION DRIFT
   ┌────────────────────────────┬────────────────────────────┐
   │  Aligned (post-migration)  │  Legacy (pre-migration)     │
   ├────────────────────────────┼────────────────────────────┤
   │  clients.vue    0 lines    │  TimerEntryRow    ~50 lines │
   │  projects.vue   (Tailwind) │  TimerTaskGroup   ~70 lines │
   │                            │  index.vue        ~47 lines │
   │                            │  sync/[date].vue ~100 lines │
   └────────────────────────────┴────────────────────────────┘
```

This change finishes the migration so the whole app matches `CODING_STANDARDS.md §4`. It is deliberately mechanical + presentational; the structural refactor of `sync/[date].vue`'s script is a **separate** change (`refactor-sync-day-composables`).

## Decisions

### 1. Scoped CSS → Tailwind mapping
The residual CSS is trivial layout that maps 1:1 to utilities. Migrate directly:

| Scoped CSS | Tailwind |
| --- | --- |
| `display:flex; align-items:center; gap:1rem` | `flex items-center gap-4` |
| `font-family: monospace; text-align:right` | `font-mono text-right` |
| `color: var(--ui-text-muted)` | `text-muted` |
| `border-bottom: 1px solid var(--ui-border)` | `border-b border-default` |

**Keep as inline `:style`:** the dynamic `ch`-based widths (`titleInputWidth`, `projectSelectWidth`) — these are computed and cannot be static utilities. This is explicitly allowed by §4 ("residual only when utilities are insufficient") and is not "residual scoped CSS".

### 2. Inline edit: `UInput`, not ghost-button-as-text
Nuxt UI v4 has **no** dedicated inline-edit/editable-cell primitive (confirmed via the nuxt-ui skill + MCP). The idiomatic replacement is `UInput` variants:

```
  inline-edit pattern (no custom CSS):
  ┌──────────────────────────────────────────────┐
  │  display:  UInput variant="none"  (plain text)│
  │      │ focus / activate                       │
  │      ▼                                          │
  │  edit:     UInput variant="ghost"              │
  │            @blur=commit @keydown.enter=commit  │
  │            @keydown.esc=revert                 │
  └──────────────────────────────────────────────┘
```

`variant="none"` renders `text-highlighted bg-transparent focus:outline-none` (looks like text); `variant="ghost"` adds a subtle hover/focus surface. This deletes the `.timer-entry__edit-trigger` overrides (background/padding/font resets + hover underline) rather than porting them to Tailwind. Commit/revert semantics and `data-testid`/labels are preserved (aligns with REQ-131's smart-input commit/revert model).

### 3. Sidebar: drop the custom `#item` slot
`navItems` already carries `label` + `icon`, and `UNavigationMenu` renders those plus a native `NuxtLink` (`<a href="/clients">`). The only thing the custom slot added was per-item `data-testid`s.

```
  BEFORE                          AFTER
  <nav aria-label>                <nav aria-label>      ← keep (landmark, REQ-071)
    UNavigationMenu                 UNavigationMenu
      #item slot  ← drop             (native icon+label)
        span data-testid            item.to → <a href>  ← e2e targets this
      ui: undefined ← dead          (removed)
```

Keep the outer `<nav aria-label="Main navigation">` (Nuxt UI does not emit this landmark; REQ-071 depends on it). Remove the dead `ui: undefined`.

## Test impact

```
  WHO DEPENDS ON  data-testid="nav-link-*"
  ─────────────────────────────────────────────────────────────
  e2e (REAL component — must re-point to a[href=…]):
   ├─ shell.spec.ts                 asserts 5 links visible, clicks reports
   ├─ clients-remote-config-ui.spec clicks nav-link-clients
   └─ projects-ui.spec.ts           clicks nav-link-projects

  nuxt (NO dependency on the slot — stay green):
   ├─ shell.spec.ts REQ-065         asserts item.to hrefs
   ├─ shell.spec.ts REQ-071         asserts aria-label only
   └─ page-render/layout            fully stub AppSidebar
```

Re-point e2e selectors to `[data-testid="app-sidebar"] a[href="…"]` (`/` for Timer, `/clients`, `/projects`, `/reports`, `/settings`).

## Non-goals / risks
- **Not** refactoring `sync/[date].vue`'s script logic (separate change).
- **Not** changing any API, DB, or i18n catalog.
- Risk: e2e selector drift — mitigated by keeping the `app-sidebar` container testid and switching only per-link locators to hrefs.
