# Spec: Icon Button Tooltip Requirement

## Requirement

Every icon-only button in the Web frontend MUST display a tooltip on hover that describes the expected action.

**Icon-only button** — a button that has an icon but no visible text label rendered alongside it.

**Excluded** — buttons that have both an icon and a visible text label are self-explanatory and do not require a tooltip.

## Tooltip Implementation Standard

- Use PrimeVue's `v-tooltip` directive (already globally registered).
- Preferred placement per context:
  - Table row action buttons → `.top`
  - Sidebar collapse toggle → `.right`
  - Mobile top-bar buttons → `.bottom`
- Tooltip text must be concise, action-oriented, and sentence-case (e.g. "Edit project", not "EDIT PROJECT" or "Edits the project").
- Dynamic buttons (e.g. archive/restore toggle) must use a dynamic tooltip that matches the current state.

## Affected Components & Required Tooltips

### `SettingsPanel.vue` — Projects table

| Button | State | Tooltip text |
|--------|-------|--------------|
| `pi pi-check` | edit mode | `Save changes` |
| `pi pi-times` | edit mode | `Cancel editing` |
| `pi pi-pencil` | view mode | `Edit project` |
| `pi pi-archive` / `pi pi-refresh` | view mode | `Archive project` / `Restore project` |
| `pi pi-trash` | view mode | `Delete project` |

### `SettingsPanel.vue` — Items table

| Button | State | Tooltip text |
|--------|-------|--------------|
| `pi pi-pencil` | — | `Rename item` |
| `pi pi-link` | — | `Match with remote issue` |
| `pi pi-archive` / `pi pi-refresh` | — | `Archive item` / `Restore item` |
| `pi pi-trash` | — | `Delete item` |

### `AppSidebar.vue`

| Button | Tooltip text | Placement |
|--------|--------------|-----------|
| Collapse/Expand toggle (`pi pi-angle-left` / `pi pi-angle-right`) | `Collapse sidebar` / `Expand sidebar` | `.right` |
| Mobile menu open (`pi pi-bars`) | `Open menu` | `.bottom` |

## Accessibility

- Existing `aria-label` attributes on Items buttons (`Rename`, `Match remote`) must be retained alongside `v-tooltip` — they serve screen readers while `v-tooltip` serves sighted users.
- New buttons without `aria-label` should have one added where the tooltip text is sufficient to describe the action.
