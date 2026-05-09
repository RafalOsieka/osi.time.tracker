## Why

The current navigation is a local `ref` toggle inside `TrackerView.vue` with no Vue Router integration. This means no deep linking, no browser history, and no scalability as new pages are added. Moving to a proper router-based layout with a persistent sidebar gives the app a solid navigation foundation that scales naturally.

## What Changes

- Introduce a `DefaultLayout.vue` layout component containing a collapsible `AppSidebar` and a `<RouterView />` outlet.
- Create `AppSidebar.vue` with: app logo + name at top, nav links (Tracker, Reports, Publish, Settings), and a collapse toggle at the bottom.
- Sidebar behavior: expanded by default on desktop (icon + label), collapsible to icon-only mode; on mobile it is hidden by default and opens as an overlay (using PrimeVue `Drawer`).
- Restructure Vue Router: `DefaultLayout` as the parent route with child routes for `/tracker`, `/reports`, `/publish`, `/settings`; root `/` redirects to `/tracker`.
- Promote `ReportsPanel.vue` and `SettingsPanel.vue` to routed pages (`ReportsPage.vue`, `SettingsPage.vue`).
- Promote `PublishPanel.vue` to a dedicated routed page (`PublishPage.vue`) — removed from the TrackerPage grid.
- Simplify `TrackerView.vue`: remove nav buttons and the `activeView` ref; keep only `TimerBar` + `EntriesList` content.
- Simplify `App.vue` to a bare `<RouterView />`.

## Capabilities

### New Capabilities
- `app-navigation`: Persistent sidebar navigation with router-based pages, collapsible desktop mode, and mobile overlay.

### Modified Capabilities
- `ui-foundation`: Layout structure changes (App.vue, TrackerView.vue refactored).
- `frontend-state-management`: Stores remain unchanged; pages are now independently routed.

## Impact

- `src/Web/src/App.vue`: Simplified to `<RouterView />` only.
- `src/Web/src/layouts/DefaultLayout.vue`: New — sidebar shell + router outlet.
- `src/Web/src/components/AppSidebar.vue`: New — logo, nav links, collapse toggle, mobile drawer.
- `src/Web/src/router/index.ts`: Restructured with layout route and four child routes.
- `src/Web/src/views/TrackerView.vue`: Nav buttons and `activeView` ref removed.
- `src/Web/src/views/ReportsPage.vue`: Promoted from `ReportsPanel.vue` (or wraps it).
- `src/Web/src/views/PublishPage.vue`: Promoted from `PublishPanel.vue`.
- `src/Web/src/views/SettingsPage.vue`: Promoted from `SettingsPanel.vue`.
