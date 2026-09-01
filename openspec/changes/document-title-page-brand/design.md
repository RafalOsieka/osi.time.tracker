## Context

`app.vue` already calls `useHead` for `html[lang]`, dir, and favicons. It does not set `title`. Unhead then uses the request hostname (`localhost` in dev). Sidebar and auth chrome already show `layout.title`. Routes have i18n page labels (`timerView.pageTitle`, `nav.settings`, `remoteSync.pageTitle`, etc.). Login has no dedicated page-title key.

## Goals / Non-Goals

**Goals:**

- Tab title `{page} | {layout.title}` on SSR and SPA navigations.
- i18n for both segments; reuse existing keys.
- Keep favicon running-state swap independent of the title.

**Non-Goals:**

- Elapsed time or running task in the tab.
- Open Graph / Twitter meta.
- Static `nuxt.config` `app.head.title`.

## Decisions

### D1 — `titleTemplate` in `app.vue`, page title from each page

Set Unhead `titleTemplate` to `%s | ${t('layout.title')}` (or equivalent) in `app.vue`. Each page sets `title` via `useHead` / `useSeoMeta` to its existing heading key. **Rationale:** one brand suffix, pages already know their labels. *Alternative considered:* only a global brand title — cheaper, but the chosen product shape is `[page] | brand`. *Alternative:* `nuxt.config` static title — skips i18n.

### D2 — Login and 404

Login adds a small catalog key (or reuses a login label) so `/login` is not just the brand. Not-found uses brand only (`titleTemplate` with empty/default page) so the host never leaks.

### D3 — Sync day

Reuse `remoteSync.pageTitle` (`Remote Sync – {date}`) as `%s`. Result: `Remote Sync – 2026-09-01 | OSI Time Tracker`.

## Risks / Trade-offs

- [Pages forget to set title] → default template still shows brand, never hostname.
- [Title template vs i18n separator] → keep `|` as a fixed ASCII separator (same in `en`/`pl`); only words are translated.

## Open Questions

- None; login key vs `auth.loginButton` can be chosen at implement time.
