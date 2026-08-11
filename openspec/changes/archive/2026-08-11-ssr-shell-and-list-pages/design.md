## Context

See proposal.md for motivation. Today:

- `app/pages/trackers.vue` and `app/pages/projects.vue` use `useAsyncData(..., { server: false, immediate: false })` plus `onMounted` refresh, so F5 paints empty tables first.
- `app/layouts/default.vue` calls `fetchRunning()` only in `onMounted`, so AppTimer is idle until the client round-trip.
- `app/pages/sync/[date].vue` already SSRs authenticated data with `useRequestFetch()` (cookie forwarding).
- `useUserSettings` sets `detected = import.meta.client ? browserTZ : 'UTC'`, so any SSR-formatted date using `effective.timeZone` can hydrate-mismatch when timezone is unset.
- Projects page also mounts a tracker filter that is not needed for small personal lists (WBS filter is V1.1).

## Goals / Non-Goals

**Goals:**

- One shared pattern for authenticated SSR GETs: `useRequestFetch` + default `useAsyncData` (server on, immediate on).
- Shell-level SSR seed of running entry into `useState` timer store; client-only elapsed ticker from zero.
- Simplify Projects UI (no filter; lazy tracker options for the form only).
- Hydration-safe effective timezone with post-mount browser upgrade when unset.

**Non-Goals:**

- Timer-view (`index.vue`) day-list SSR.
- Removing API `trackerId` query support on `GET /api/projects`.
- SSR of live elapsed seconds.

## Decisions

### D1 — Shell owns running-entry SSR seed

Seed in `default.vue` (or a thin layout bootstrap used only there) via `useAsyncData('timer-running', () => requestFetch('/api/time-entries/running'))`, writing into existing `useState('timer-running-entry')` in `useTimer`. Keep mutations (`start`/`stop`/`update*`) and `fetchRunning` for post-mutation refresh on the client.

*Alternative:* page-level fetch of running entry — rejected; AppTimer is global shell chrome.  
*Alternative:* plugin always fetching — heavier; layout is enough for authenticated routes using `default`.

### D2 — Client-first elapsed (zero until ticker)

Do not compute elapsed during SSR. Keep `elapsedSeconds` at `0` until `import.meta.client` starts the interval from `startedAt`. Avoids server/client `Date.now()` hydration drift on the mono clock label.

*Alternative:* SSR elapsed and suppress hydration on that node — more complexity for little gain.

### D3 — List pages drop `server: false` / `onMounted` bootstrap

Trackers: one `useAsyncData('trackers', () => requestFetch(...))`.  
Projects: one SSR `useAsyncData('projects', () => requestFetch('/api/projects'))` with no query.  
Mutations still `$csrfFetch` + `refresh()`.

*Alternative:* `callOnce` / custom middleware loaders — unnecessary; Nuxt async data already serializes payload.

### D4 — Projects: remove filter; lazy trackers for form only

Remove filter UI, `trackerFilter` ref, and filter-driven query/watch.  
Keep `useAsyncData('trackers-for-projects', …, { server: false, immediate: false })` and call `refresh`/`execute` when create/edit dialog opens; bind select `:loading` to pending. Cache by key for reopen in-session. Preserve `extraTrackerOptions` for soft-deleted tracker on edit.

*Alternative:* SSR trackers with projects — rejected per product choice (form-only load).

### D5 — Timezone upgrade lives in `useUserSettings`

Effective `timeZone`:

1. If `settings.timezone` set → always that value.
2. Else on SSR and until client mount → `'UTC'`.
3. Else after mount → browser-detected zone (reactive upgrade).

All consumers of `effective.timeZone` (tables, AppTimer editor, index later) inherit safety without per-page hacks.

*Alternative:* format dates only inside `ClientOnly` — worse empty flash; scoped page hacks drift.

### D6 — Loading gate for timer when already SSR-resolved

If SSR payload already has running entry (or explicit null), do not force `loading=true` on mount for a second fetch. Optional background revalidate is allowed but must not blank the widget. Primary path: trust SSR seed; `fetchRunning` remains for mutations and explicit refresh.

## Risks / Trade-offs

- **[SSR 401 if plain `$fetch` used]** → Always use `useRequestFetch` for SSR-authenticated GETs (proven on sync day page).
- **[UTC → local date flash for unsaved timezone]** → Accept one post-mount reformat; saved-timezone users see no flash.
- **[Zero elapsed briefly after reload while running]** → Accept; title/mode correctness is the primary UX win.
- **[Dialog open waits for trackers]** → Show select loading; lists stay small.
- **[Duplicate fetch on client nav to trackers/projects]** → Nuxt payload cache by key; acceptable.

## Migration Plan

Pure frontend behavior change; deploy with app release. No DB migration. Rollback: revert frontend commits. Tests: update nuxt/e2e expectations for absent projects filter; add coverage for SSR-seeded list/timer where practical (nuxt tests + e2e hard navigation).
