## Context

The frontend is currently a single `TrackerView.vue` that uses a local `ref` (`activeView`) to toggle between three panels (Tracker, Reports, Settings). Vue Router exists but only has one route (`/`). There is no deep linking, no browser history support, and adding new pages requires modifying `TrackerView.vue` directly.

`PublishPanel.vue` is embedded in the tracker grid (1/3 width column). `ReportsPanel.vue` and `SettingsPanel.vue` are conditionally rendered inside `TrackerView.vue`.

## Goals / Non-Goals

**Goals:**
- Replace the `ref`-toggle navigation with proper Vue Router-based routing
- Introduce a persistent, collapsible sidebar as the primary navigation chrome
- Promote panels to independently routed pages (`/tracker`, `/reports`, `/publish`, `/settings`)
- Support mobile via an overlay drawer (PrimeVue `Drawer`)
- Make adding future pages a matter of adding a route + a nav entry — no changes to existing pages

**Non-Goals:**
- Changing any Pinia store logic or API calls
- Redesigning the content of any existing panel
- Adding authentication or per-page access control
- Implementing dark mode toggle (separate concern)

## Decisions

### Decision: Layout component (Option B) over nested shell route or flat App.vue

A `DefaultLayout.vue` wraps all current pages and contains the sidebar + `<RouterView />`. `App.vue` becomes a bare `<RouterView />`. Top-level routes that don't need the sidebar (e.g. a future fullscreen timer) can be added without touching `DefaultLayout`.

**Alternative considered — Option C (nested shell route):** Equally clean, but makes sidebar-less pages harder to add without restructuring the router.

**Alternative considered — Option A (sidebar in App.vue):** Simplest, but sidebar becomes unconditional for all routes forever.

### Decision: Custom collapsible sidebar over PrimeVue Drawer for desktop

The desktop sidebar uses CSS width transition (`w-56` expanded ↔ `w-14` collapsed) with a toggle button at the bottom. Labels are hidden in collapsed mode via `v-show` or conditional classes. This avoids the overlay behavior of `Drawer` on desktop.

PrimeVue `Drawer` is used **only for mobile** — it slides in as an overlay when the hamburger button is tapped, and closes on backdrop click or nav link click.

**Alternative considered — PrimeVue Drawer for both:** Drawer is overlay-only; it cannot serve as a persistent sidebar, so it cannot replace the desktop sidebar.

### Decision: `/` redirects to `/tracker`; four child routes under `DefaultLayout`

```
{ path: '/', component: DefaultLayout, children: [
    { path: '',          redirect: '/tracker' },
    { path: 'tracker',   component: TrackerPage },
    { path: 'reports',   component: ReportsPage },
    { path: 'publish',   component: PublishPage },
    { path: 'settings',  component: SettingsPage },
]}
```

`TrackerView.vue` is renamed to `TrackerPage.vue` for consistency. `ReportsPanel`, `PublishPanel`, and `SettingsPanel` are wrapped by new thin page components (`ReportsPage.vue`, `PublishPage.vue`, `SettingsPage.vue`) rather than deleted, preserving their internal logic.

### Decision: Sidebar state (collapsed/expanded) stored in a Pinia store

A lightweight `useLayoutStore` holds `sidebarCollapsed: boolean`. This allows any component to react to sidebar state (e.g. adjusting content padding) without prop drilling, and persists the preference within the session.

## Risks / Trade-offs

- **CSS transition flicker on first load** → Mitigation: initialize `sidebarCollapsed` from `localStorage` so the sidebar renders in the correct state immediately.
- **Mobile breakpoint detection** → Mitigation: use Tailwind's `lg:` prefix for layout shifts; the mobile hamburger button is only visible below `lg`. No JS resize listeners needed.
- **RouterLink active state styling** → Mitigation: use Vue Router's `RouterLink` with `activeClass` / `exactActiveClass` props to highlight the current nav item; no manual active tracking needed.
- **PublishPanel removal from TrackerPage grid** → The tracker grid becomes a simple two-column layout (`TimerBar` + `EntriesList`). Users who relied on seeing publish status while tracking will need to navigate to `/publish`. This is an intentional UX trade-off for layout scalability.

## Migration Plan

1. Add `useLayoutStore` to Pinia.
2. Create `src/layouts/DefaultLayout.vue` and `src/components/AppSidebar.vue`.
3. Create thin page wrappers: `ReportsPage.vue`, `PublishPage.vue`, `SettingsPage.vue`.
4. Refactor `TrackerView.vue` → `TrackerPage.vue`: remove nav buttons, `activeView` ref, and `PublishPanel` import.
5. Update `src/router/index.ts` with the new route structure.
6. Simplify `App.vue` to `<RouterView />`.
7. Remove orphaned imports from `TrackerView.vue`.

No backend changes. No migration rollback needed — this is a pure frontend refactor.

## Open Questions

None — all key decisions made during the exploration phase.
