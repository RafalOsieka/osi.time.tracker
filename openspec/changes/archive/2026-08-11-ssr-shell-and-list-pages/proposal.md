## Why

On hard reload (F5) or deep link, Trackers and Projects render empty until `onMounted` fetches, and AppTimer stays idle until the shell loads the running entry. Lists and the running timer are server-known data; users should see them on first paint. Project lists stay small, so page-level filtering adds complexity without MVP value (WBS 3.6 is V1.1).

## What Changes

- Authenticated shell resolves the running time entry during SSR and seeds shared timer state so AppTimer shows the correct title and start/stop mode on first paint of any authenticated page.
- Live elapsed time remains client-first: show zero until the client ticker starts after hydrate (no SSR wall-clock duration).
- Trackers page loads its list during SSR via cookie-forwarding fetch (`useRequestFetch` pattern already used on Remote Sync).
- Projects page loads the full project list during SSR; **remove** the on-page tracker filter UI (and filter-driven list query usage).
- Project create/edit dialog loads tracker options only when opened, with a loading indicator on the tracker select.
- `useUserSettings` makes effective display timezone hydration-safe: first paint uses saved timezone or `UTC`; after mount, if no saved timezone, upgrade to browser-detected TZ so formatted dates recompute without SSR/client mismatch.
- Timer view (`index.vue`) day list remains client-only (out of scope).

## Non-goals

- SSR for the timer-view day/group list or its window queries.
- Perfect SSR of the live elapsed clock.
- Removing or changing `GET /api/projects?trackerId=` server support (API may keep optional filter; UI stops using it).
- Auto-persisting browser-detected timezone.
- New caching layers, APIs, or schema changes.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `frontend-shell`: Shell seeds running-timer state during SSR for first-paint AppTimer correctness on every authenticated route.
- `time-tracking`: Persistent running indicator / widget loading semantics for SSR-seeded running entry and client-first elapsed display.
- `tracker-management`: Trackers management page list is available on initial SSR render.
- `project-management`: Projects page SSR full list; no tracker filter chrome; form tracker options lazy-loaded on dialog open.
- `user-settings`: Effective timezone resolution is SSR/hydration-safe with post-mount browser upgrade when unset.

## Impact

- Frontend: `app/layouts/default.vue`, `app/composables/useTimer.ts`, `app/components/AppTimer.vue`, `app/pages/trackers.vue`, `app/pages/projects.vue`, `app/composables/useUserSettings.ts`, i18n keys for removed filter strings, nuxt/e2e tests.
- Backend: no API contract required for the happy path; optional filter endpoint behavior unchanged.
- Follow existing SSR auth pattern from `sync/[date].vue` (`useRequestFetch`).
