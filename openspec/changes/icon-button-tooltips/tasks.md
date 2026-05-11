# Tasks: Icon Button Tooltips

## Task List

- [x] **T1** — Add `v-tooltip` to all icon-only buttons in `SettingsPanel.vue` (Projects table)
  - Save (edit mode): `v-tooltip.top="'Save changes'"`
  - Cancel (edit mode): `v-tooltip.top="'Cancel editing'"`
  - Edit: `v-tooltip.top="'Edit project'"`
  - Archive/Restore: `v-tooltip.top="data.isArchived ? 'Restore project' : 'Archive project'"`
  - Delete: `v-tooltip.top="'Delete project'"`

- [x] **T2** — Add `v-tooltip` to all icon-only buttons in `SettingsPanel.vue` (Items table)
  - Rename: `v-tooltip.top="'Rename item'"` (keep existing `aria-label`)
  - Match remote: `v-tooltip.top="'Match with remote issue'"` (keep existing `aria-label`)
  - Archive/Restore: `v-tooltip.top="data.isArchived ? 'Restore item' : 'Archive item'"`
  - Delete: `v-tooltip.top="'Delete item'"` + add `aria-label="Delete item"`

- [x] **T3** — Migrate `AppSidebar.vue` collapse toggle from native `:title` to `v-tooltip.right`
  - Dynamic: `v-tooltip.right="layout.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"`
  - Remove the native `:title` attribute

- [x] **T4** — Migrate `AppSidebar.vue` mobile menu button from native `title` to `v-tooltip.bottom`
  - `v-tooltip.bottom="'Open menu'"`
  - Remove the native `title` attribute

- [x] **T5** — Run frontend build (`pnpm build`) — passes cleanly (vue-tsc + vite, 0 errors). No test files exist in the frontend (pre-existing condition).
