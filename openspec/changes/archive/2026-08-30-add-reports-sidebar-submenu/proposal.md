## Why

The monthly timesheet is the only report, but reaching it takes a hop through a one-card hub at `/reports`. Consultants want Monthly as a sidebar destination. Reporting is in-scope (story 8 / WBS 4); this slice is navigation only — no new report type.

## What Changes

- Nested **Reports** group in the authenticated sidebar: the parent is not a link (expand/collapse affordance only) and stays **always expanded**.
- Child **Monthly timesheet** navigates to `/reports/monthly`. That is the only reports nav destination in this slice.
- **BREAKING:** Delete the `/reports` hub page. No redirect. Visiting `/reports` is a 404.
- Keep the five skeleton destinations (Timer, Trackers, Projects, Reports, Settings). Reports becomes a group, not a single hub link.
- i18n `en`/`pl` for the child label; drop hub-only copy.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `frontend-shell`: Reports is an always-expanded nested group; Monthly is a child link to `/reports/monthly`; no `a[href="/reports"]`.
- `reports`: Remove the reports hub (REQ-288). Monthly remains the first report and is reached from the sidebar child.

## Impact

- **UI:** `app/components/AppSidebar.vue`, delete `app/pages/reports/index.vue`, i18n catalogs.
- **Tests:** nuxt shell + reports-hub, e2e shell (hub click / `a[href="/reports"]`).
- **Specs:** `frontend-shell` REQ-065; `reports` REQ-288.
- **Not affected:** `/reports/monthly` page, `GET /api/reports/monthly`, adapters, database.

## Non-goals

- Other reports (weekly, project summary, CSV/PDF)
- Redirect from `/reports` to monthly
- Parent Reports as a navigable link
- Changing monthly table, month query, or aggregation API
- Allowing the Reports accordion to start or stay collapsed on the expanded rail
- Nested nav for any other skeleton destination
