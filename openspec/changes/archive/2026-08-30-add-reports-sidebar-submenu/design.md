## Context

See proposal.md for motivation. Sidebar is `AppSidebar.vue` feeding `UNavigationMenu` (`orientation="vertical"`) with a flat `navItems` list. Reports is a single item `to: '/reports'`. The hub is `app/pages/reports/index.vue`; monthly lives at `app/pages/reports/monthly.vue`. Collapsed rail uses menu `tooltip` when `collapsed || iconOnly`. No other surface links to `/reports`.

## Goals / Non-Goals

**Goals:**

- Nested Reports group in `navItems` (`type: 'trigger'`, no `to`) with a Monthly child to `/reports/monthly`.
- Children always visible on the labelled rail (controlled open; not a closed accordion).
- Delete the hub page so `/reports` is a Nuxt 404 (auth guard still applies first).
- Update shell/hub tests and i18n; leave monthly page and API unchanged.

**Non-Goals:**

- Product non-goals in proposal.md.
- Custom `#item` slots (REQ-071 still requires native `UNavigationMenu` links).
- Nested groups for other destinations.

## Decisions

### 1. Trigger parent + always-open children

| Option | Notes |
|--------|--------|
| **A. `type: 'trigger'`, no `to`, `open: true`** | Parent never navigates; children stay visible on the labelled rail | **chosen** |
| B. Parent `to: '/reports/monthly'` plus children | Same URL on parent and child; click target fights accordion |
| C. `defaultOpen` only | User can collapse the only report — contradicts “always expanded” |

If `UNavigationMenu`’s accordion `collapsible` would close other (future) groups, prefer per-item `open: true` on Reports so collapse is a no-op for that group.

Collapsed / icon-only rail cannot show indented labels. Enable the menu **popover** for that item so Monthly remains reachable; keep the Reports tooltip label. Do not navigate when activating the Reports icon.

### 2. Delete hub; no `/reports` route

| Option | Notes |
|--------|--------|
| **A. Delete `index.vue`; keep `monthly.vue`** | Canonical URL stays `/reports/monthly`; `/reports` 404s | **chosen** |
| B. Redirect `/reports` → `/reports/monthly` | Explicitly rejected |
| C. Move monthly to `/reports` | Breaks the live monthly URL and e2e for no gain |

Unauthenticated `/reports` still hits the private-by-default guard (login + `redirect`), same as any other non-public missing path. Authenticated `/reports` is a 404, not a hub.

### 3. Labels

Reuse `nav.reports` for the group and `reports.monthly.pageTitle` for the child. Delete hub-only keys (`reports.hubTitle`, `reports.monthly.cardTitle`, `reports.monthly.cardDescription`). Keep `en`/`pl` parity.

### 4. Tests

- Nuxt `AppSidebar`: items include Monthly `to: '/reports/monthly'`; no item `to: '/reports'`; stubs that only flatten `item.to` must walk `children`.
- Drop `test/nuxt/reports-hub.spec.ts`.
- E2E shell: `a[href="/reports/monthly"]` visible; `a[href="/reports"]` count 0; click Monthly → monthly page, not hub.
- Monthly e2e/API unchanged.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Accordion still lets the user collapse Reports | Controlled `open: true` (and collapsible false if it does not hide future groups) |
| Collapsed rail hides Monthly | Popover on the Reports item when `collapsed` |
| Auth then 404 for old `/reports` bookmarks | Accepted; no redirect |
| Native links + nested children vs REQ-071 “no custom slot” | Stay on `navItems` + default item rendering |

## Migration Plan

Deploy is a UI-only rollback: restore `index.vue` and flat nav if needed. No database or API migration. `/reports` bookmarks stop working on purpose.

## Open Questions

None.
