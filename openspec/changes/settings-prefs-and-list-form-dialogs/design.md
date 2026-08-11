## Context

See `proposal.md` for motivation. Today:

- `projects.vue` / `trackers.vue` own list + modal form + CRUD in one SFC (~285–366 lines). Shared helpers already exist (`TableHeader`, `EmptyState`, `RowActions`, `FormDialogFooter`); timer feature uses smart dialogs (`TimerAddEntryDialog`) as the extraction pattern.
- Form width is inconsistent: selects often have `w-full`, many `UInput`s do not; trackers modal sets `sm:max-w-lg`, projects uses `min-w-80` only.
- `AppUtilityMenu` hosts locale, theme, and logout. `/settings` hosts timezone + week-start with an explicit Save and success banner, calling partial-capable `PATCH /api/user/settings` (schema already optional per field; no API shape change required).

## Goals / Non-Goals

**Goals:**

- Thin list pages to orchestration (fetch, columns, delete, open dialog).
- Smart dialogs own form state, validation, save, and domain confirms (e.g. project tracker detach).
- Uniform full-width controls in list dialogs and settings.
- Settings as the preference hub with immediate apply; utility menu = logout only.
- Preserve existing `data-testid`s and list/dialog business rules.

**Non-Goals:**

- Table-wrapper components or changing REQ-127 ownership of `UTable`.
- Index/sync page decomposition.
- Auth-layout theme/locale UI; server-persisted locale/theme; new settings routes.

## Decisions

### 1. Smart dialogs (not dumb presentational forms)

**Choice:** `ProjectFormDialog` and `TrackerFormDialog` own open state binding, form model, zod/`UForm` validation, server-error field mapping, CSRF save, success toasts, and project detach confirm. Pages pass create/edit identity (null vs entity) and listen for `saved` / close to refresh lists.

**Alternative:** Dumb dialogs emit `submit(payload)` and pages keep API logic — thinner dialogs but pages stay fat; diverges from timer dialogs.

### 2. Dialog-first only

**Choice:** Keep `UTable` + columns on the page; extract only dialogs.

**Alternative:** `ProjectsTable` wrapper — extra props/events API and conflicts with REQ-127 “pages own UTable.” Deferred.

### 3. Immediate apply settings; no Save button

**Choice:** On control change:

| Control | Persist | API |
|--------|---------|-----|
| Language | i18n cookie via `setLocale` | none |
| Theme | color-mode cookie | none |
| Timezone | partial PATCH `{ timezone }` | existing |
| Week start | partial PATCH `{ weekStart }` | existing |

- **Errors:** toast only (`useAppToast` / existing error helpers).
- **Success:** silent (no banner/toast).
- **Races:** latest-write-wins (ignore stale responses or always apply last requested body).
- **i18n:** repurpose `settings.save` / `settings.saved` (and related) into error/saving copy as needed; drop unused Save CTA strings or retarget them.

**Alternative:** Keep Save for account fields only — mixed UX vs language/theme. Rejected for consistency.

**Alternative:** New per-field endpoints — unnecessary; PATCH is already partial.

### 4. Settings page stays monolithic

**Choice:** Single `settings.vue` (or light local sections in the same file). No forced extraction.

**Alternative:** `SettingsAppearanceSection` components — optional later if the page grows.

### 5. Full-width convention without a new wrapper component

**Choice:** Apply `class="w-full"` (or Nuxt UI `block` where appropriate) on dialog/settings field controls; align project modal content to `sm:max-w-lg` like trackers. Document via REQ-263 rather than inventing `FormFieldStack` unless duplication hurts.

**Alternative:** Shared form shell component — YAGNI for this change.

### 6. Utility menu slim-down

**Choice:** `AppUtilityMenu` items = logout only (avatar trigger retained). Locale/theme blocks removed.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Auto-save fires on every timezone pick while browsing options | Persist only on committed selection (select model change), not filter keystrokes |
| Stale PATCH overwrites a newer value | Track request generation or always PATCH latest intended value; apply response only if still current |
| Users miss “did it save?” feedback | Silent success is intentional; failures toast; E2E asserts persistence across reload |
| Dialog extraction breaks mount tests | Keep stable `data-testid`s; update nuxt tests to resolve child components |
| REQ-163 previously said auth layout | Spec delta moves control to Settings; auth stays theme-cookie-only (no new auth UI) |

## Migration Plan

1. Land dialog extractions with behavior parity (tests green).
2. Apply full-width + modal width polish in the same PR.
3. Move locale/theme to settings + auto-apply account fields; slim utility menu.
4. Update i18n keys, shell/settings e2e and nuxt specs.
5. No DB migration; no API versioning; rollback = revert frontend PR.

## Open Questions

None that block implementation. Optional later: brief non-blocking “Saving…” affordance if network latency feels dead; not required by specs.
