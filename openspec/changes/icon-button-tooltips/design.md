# Design: Icon Button Tooltips

## Directive

Use PrimeVue's `v-tooltip` directive exclusively. It is already globally registered via `main.ts` — no additional imports or plugin registration needed in individual components.

## Placement Rules

| Context | Placement modifier | Rationale |
|---|---|---|
| Table row action buttons | `v-tooltip.top` | Rows are compact; top avoids overlap with adjacent rows |
| Sidebar collapse toggle | `v-tooltip.right` | Sidebar sits on the left edge; right placement keeps tooltip visible |
| Mobile top-bar buttons | `v-tooltip.bottom` | Top bar is at the top of the viewport; bottom avoids clipping |

## Tooltip Text Style

- Sentence case: `"Edit project"` not `"edit project"` or `"Edit Project"`
- Action-oriented verb phrase: `"Delete item"`, `"Archive project"`, `"Match with remote issue"`
- Concise: 2–4 words preferred; no punctuation at end
- Dynamic state buttons must reflect current state, not the result:
  - ✅ `"Archive project"` (what clicking will do)
  - ❌ `"Project is active"` (describes state, not action)

## Dynamic Tooltips

Archive/Restore toggle buttons use a ternary bound to `data.isArchived`:

```vue
:v-tooltip.top="data.isArchived ? 'Restore project' : 'Archive project'"
```

Sidebar collapse toggle uses `layout.sidebarCollapsed`:

```vue
v-tooltip.right="layout.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
```

## Consistency with Existing Tooltips

`EntriesList.vue` already uses `v-tooltip.top` and serves as the reference implementation:

```vue
v-tooltip.top="isActive(entry) ? 'Edit title & item' : 'Edit entry'"
v-tooltip.top="'Split entry in half'"
v-tooltip.top="'Delete entry'"
```

New tooltips must follow the same pattern — static strings use single quotes inside double quotes; dynamic values use a ternary expression.

## Accessibility

- `v-tooltip` is a visual affordance for sighted/pointer users.
- `aria-label` serves screen readers and must be present on all icon-only buttons.
- Where `aria-label` already exists (Items: Rename, Match remote), keep it.
- Where it is missing, add it with the same text as the tooltip.
- Both attributes can coexist without conflict.

## What Is Not Changed

- Tooltip show/hide delay: use PrimeVue defaults (no custom delay configuration).
- Tooltip styling: use the app's existing PrimeVue theme — no custom CSS overrides.
- Labeled buttons (those with visible text labels) remain unchanged — no tooltips added.
