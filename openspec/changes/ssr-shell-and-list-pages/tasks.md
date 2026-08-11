## 1. Frontend — hydration-safe timezone

- [ ] 1.1 Update `useUserSettings` so effective `timeZone` is saved timezone when set; otherwise `UTC` on SSR and first client paint, then browser-detected after mount (reactive upgrade; never auto-persist)
- [ ] 1.2 Add unit tests for effective timezone resolution (saved wins; unsaved SSR/fallback vs post-mount browser; weekStart unchanged)

## 2. Frontend — shell running entry SSR

- [ ] 2.1 Seed shared running-timer state during authenticated layout SSR via `useRequestFetch` + `useAsyncData` writing `useState('timer-running-entry')`; remove sole reliance on layout `onMounted` → `fetchRunning()` for first paint
- [ ] 2.2 Keep live elapsed client-first: leave elapsed at zero until client ticker starts after hydrate; start/stop ticker only on client; do not force loading-disabled gate when SSR already resolved running state
- [ ] 2.3 Adjust `useTimer` / AppTimer so `fetchRunning` remains for mutation-driven refresh; avoid blanking SSR-seeded state during optional client revalidation

## 3. Frontend — Trackers page SSR list

- [ ] 3.1 Change `/trackers` list load to SSR `useAsyncData` with `useRequestFetch`; remove `server: false`, `immediate: false`, and `onMounted` list bootstrap; keep mutation `$csrfFetch` + `refresh()`

## 4. Frontend — Projects page simplify + SSR list

- [ ] 4.1 Remove projects page tracker filter UI, filter state, filter-driven query/watch, and unused filter i18n keys (`en`/`pl` parity)
- [ ] 4.2 SSR-load full projects list with `useRequestFetch` + `useAsyncData`; remove `onMounted` list bootstrap
- [ ] 4.3 Load tracker options only when create/edit dialog opens (`server: false`, `immediate: false`); show loading on Tracker select; preserve soft-deleted tracker seed on edit; create defaults to local (no tracker)

## 5. Frontend tests

- [ ] 5.1 Unit tests for `useUserSettings` timezone upgrade behavior (task 1.2 covers; complete any remaining edge cases)
- [ ] 5.2 Update/add nuxt tests for trackers and projects pages: SSR/async-data list path; projects has no filter control; dialog open triggers trackers fetch with loading
- [ ] 5.3 Update/add nuxt or unit coverage for timer shell seed: running title available without client-only mount fetch; elapsed starts at zero until ticker
- [ ] 5.4 E2E: hard navigation to `/trackers` and `/projects` shows list or empty state; projects has no tracker filter; open project dialog loads tracker select; hard navigation with running entry shows running title in AppTimer (elapsed may start at zero then tick)

## 6. Backend

- [ ] 6.1 No backend API or schema changes required for this change (confirm `GET /api/projects` optional `trackerId` and `GET /api/time-entries/running` remain as-is; no new endpoints)
