# Proposal: Icon Button Tooltips (Global Requirement)

## Summary

Every icon button in the Web frontend must have a tooltip describing its expected action. This is a global UX requirement. The audit below covers all Vue components in `src/Web/src`.

## Why

Icon-only buttons are not self-explanatory. Without tooltips, users must guess what each button does. PrimeVue's `v-tooltip` directive is already in use in `EntriesList.vue` and should be applied consistently across the entire app.

## What Changes

- Add `v-tooltip` directives to all icon-only buttons in `SettingsPanel.vue` (Projects and Items tables).
- Replace native `title` attributes in `AppSidebar.vue` with `v-tooltip` for consistency.
- No new imports or packages required — `v-tooltip` is already registered globally.

## Audit Results

```
Component              Button(s)                         Tooltip status
─────────────────────  ────────────────────────────────  ──────────────────────────────────
EntriesList.vue        Edit entry                        ✅ v-tooltip.top (conditional)
                       Split entry in half               ✅ v-tooltip.top
                       Delete entry                      ✅ v-tooltip.top

SettingsPanel.vue      Projects › Save (edit mode)       ❌ missing
                       Projects › Cancel (edit mode)     ❌ missing
                       Projects › Edit                   ❌ missing
                       Projects › Archive / Restore      ❌ missing
                       Projects › Delete                 ❌ missing
                       Items › Rename                    ⚠️  aria-label only (no tooltip)
                       Items › Match remote              ⚠️  aria-label only (no tooltip)
                       Items › Archive / Restore         ❌ missing
                       Items › Delete                    ❌ missing

AppSidebar.vue         Collapse / Expand sidebar         ⚠️  native `title` attr (inconsistent)
                       Mobile menu open                  ⚠️  native `title` attr (inconsistent)

TimerBar.vue           Stop                              ℹ️  has text label — low priority
                       Start                             ℹ️  has text label — low priority

PublishPanel.vue       Publish All                       ℹ️  has text label — low priority
                       Status icons (spinner/check/warn) ℹ️  decorative, not interactive

ReportsPanel.vue       Export CSV                        ℹ️  has text label — low priority

MatchItemDialog.vue    Fetch title                       ℹ️  has text label — low priority
                       Match                             ℹ️  has text label — low priority
                       Cancel                            ℹ️  has text label — low priority

TrackerView.vue        Tracker / Reports / Settings nav  ℹ️  have text labels — low priority
```

## Scope of Change

### Must fix (icon-only, no tooltip)

1. **`SettingsPanel.vue` — Projects table action buttons**
   - Save (edit mode): `v-tooltip.top="'Save changes'"`
   - Cancel (edit mode): `v-tooltip.top="'Cancel editing'"`
   - Edit: `v-tooltip.top="'Edit project'"`
   - Archive: `v-tooltip.top="'Archive project'"` / Restore: `v-tooltip.top="'Restore project'"`
   - Delete: `v-tooltip.top="'Delete project'"`

2. **`SettingsPanel.vue` — Items table action buttons**
   - Rename: `v-tooltip.top="'Rename item'"` (replace aria-label with tooltip)
   - Match remote: `v-tooltip.top="'Match with remote issue'"` (replace aria-label with tooltip)
   - Archive: `v-tooltip.top="'Archive item'"` / Restore: `v-tooltip.top="'Restore item'"`
   - Delete: `v-tooltip.top="'Delete item'"`

### Should fix (inconsistent — native `title` vs `v-tooltip`)

3. **`AppSidebar.vue` — Collapse toggle button**
   - Replace native `:title` with `v-tooltip.right` (dynamic: "Expand sidebar" / "Collapse sidebar")

4. **`AppSidebar.vue` — Mobile menu open button**
   - Replace native `title="Open menu"` with `v-tooltip.bottom="'Open menu'"`

### Out of scope (labeled buttons — self-explanatory)

Buttons that have both an icon **and** a visible text label do not require tooltips — the label already communicates the action.

- `TimerBar.vue` — Stop, Start
- `PublishPanel.vue` — Publish All
- `ReportsPanel.vue` — Export CSV
- `MatchItemDialog.vue` — Fetch title, Match, Cancel
- `TrackerView.vue` — Tracker, Reports, Settings nav buttons

## Implementation Notes

- PrimeVue's `v-tooltip` directive is already registered globally (confirmed by existing usage in `EntriesList.vue`). No new imports needed.
- Use `.top` placement for table row buttons (consistent with `EntriesList`).
- Use `.right` for the sidebar collapse toggle (sidebar is on the left edge).
- Use `.bottom` for the mobile menu button (top bar context).
- Dynamic archive/restore tooltip should mirror the dynamic icon: `:v-tooltip.top="data.isArchived ? 'Restore' : 'Archive'"`.
- `aria-label` attributes on Items buttons can be kept alongside `v-tooltip` for accessibility, or removed if redundant — keep them for screen reader support.
