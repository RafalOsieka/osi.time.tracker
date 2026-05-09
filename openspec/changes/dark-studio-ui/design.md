## Context

The frontend uses PrimeVue 4 with the Aura preset, Tailwind CSS 4, and a standard slate-based color palette. The existing sidebar has collapse logic via `useLayoutStore`. The timer is a small inline row. No custom theme tokens or animations exist today.

## Goals / Non-Goals

**Goals:**
- Amber/orange accent with OS-preference dark/light mode (both fully styled)
- Hero timer: full-width card, giant centered monospace number, pulse-glow border animation when running
- Collapsible sidebar: icons + labels expanded, icons only collapsed, toggle button at bottom
- Timeline entries: vertical dot + line layout, hover-reveal action buttons, monospace durations
- JetBrains Mono for all numeric/time values via Google Fonts CDN

**Non-Goals:**
- Backend changes of any kind
- New npm packages
- Redesigning Reports, Publish, or Settings page layouts (they inherit the theme passively)
- Mobile nav redesign (hamburger drawer stays as-is)

## Decisions

**D1 — CSS custom properties for palette, not Tailwind config**
Define `--ds-*` tokens in `style.css` under `:root` (light) and `.dark` (dark). Tailwind utility classes reference these via `var()`. Rationale: avoids touching `tailwind.config.js`, keeps all color decisions in one place, easy to swap later.

**D2 — PrimeVue token overrides in `main.ts` via `extend`**
Override Aura preset tokens (primary color, surface palette) using PrimeVue's `extend` option at app bootstrap. Rationale: no need for a full custom preset file; amber primary and dark surfaces slot cleanly into Aura's token structure.

**D3 — OS preference via Tailwind `darkMode: 'media'`**
Use `@media (prefers-color-scheme: dark)` to activate `.dark` class (Tailwind's `media` strategy). No manual toggle needed. Rationale: matches user requirement of "follow system preference" with zero runtime JS.

**D4 — Hero timer via conditional CSS class, not a separate component**
`TimerBar.vue` already has `v-if timerStore.isRunning` branches. Apply `.timer-card--running` class to the card root in the running branch to trigger `pulse-glow` animation and hero layout. Rationale: minimal structural change, no new component needed.

**D5 — Sidebar collapse state stays in `useLayoutStore`**
Keep existing `layout.sidebarCollapsed` / `layout.toggleSidebar()` — just restyle the toggle button and nav items. Rationale: the store already works correctly; only the visual treatment changes.

**D6 — Timeline layout via CSS, not a new component**
`EntriesList.vue` list items get a left pseudo-column (`w-6`) with a vertical border and dot. Implemented with Tailwind utility classes and a `relative`/`absolute` pattern. Rationale: no new component, no structural refactor of the entries store.

## Risks / Trade-offs

- [Google Fonts CDN dependency] → Fonts fall back to `ui-monospace, monospace` if CDN is unavailable; no layout breakage
- [PrimeVue token override scope] → Overriding surface tokens affects all PrimeVue components globally; test dropdowns, dialogs, and selects in both light and dark modes after implementation
- [Pulse animation performance] → CSS `box-shadow` animation can cause repaints; mitigated by `will-change: box-shadow` on the timer card

## Color Palette Reference

### Light mode (`:root`)
| Token | Value | Usage |
|---|---|---|
| `--ds-bg-base` | `#f8f8fa` | Page background |
| `--ds-bg-surface` | `#ffffff` | Cards, panels, sidebar |
| `--ds-bg-raised` | `#f1f1f5` | Inputs, hover states |
| `--ds-accent` | `#d97706` | Primary accent (amber-600 for contrast on light) |
| `--ds-accent-glow` | `rgba(217,119,6,0.12)` | Timer card glow |
| `--ds-text-hi` | `#111118` | Primary text |
| `--ds-text-lo` | `#6b6b7a` | Secondary/muted text |
| `--ds-border` | `#e2e2ea` | Default border |
| `--ds-success` | `#16a34a` | Running indicator dot |

### Dark mode (`.dark`)
| Token | Value | Usage |
|---|---|---|
| `--ds-bg-base` | `#0d0d10` | Page background |
| `--ds-bg-surface` | `#16161c` | Cards, panels, sidebar |
| `--ds-bg-raised` | `#1e1e26` | Inputs, hover states |
| `--ds-accent` | `#f59e0b` | Primary accent (amber-400) |
| `--ds-accent-glow` | `rgba(245,158,11,0.15)` | Timer card glow |
| `--ds-text-hi` | `#f1f1f3` | Primary text |
| `--ds-text-lo` | `#6b6b7a` | Secondary/muted text |
| `--ds-border` | `#2a2a35` | Default border |
| `--ds-success` | `#22c55e` | Running indicator dot |

## Animations

```css
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 var(--ds-accent-glow), inset 3px 0 0 var(--ds-accent); }
  50%       { box-shadow: 0 0 24px 4px var(--ds-accent-glow), inset 3px 0 0 var(--ds-accent); }
}

@keyframes dot-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
```

## Component Layout Sketches

### TimerBar — Running (hero)
```
┌──────────────────────────────────────────────────────────┐
│  RUNNING                                                 │
│                                                          │
│              01:23:47                                    │
│         (text-7xl, monospace, accent)                    │
│                                                          │
│  My Task Title                            [■ Stop]       │
│  Project Alpha · #123                                    │
└──────────────────────────────────────────────────────────┘
  ↑ left border 3px accent + pulse-glow animation
```

### AppSidebar — Expanded / Collapsed
```
Expanded (w-56)          Collapsed (w-14)
┌──────────────────┐     ┌──────┐
│ ⏱  Osi Tracker  │     │  ⏱  │
│                  │     │      │
│ ⏱  Tracker      │     │  ⏱  │  ← active: amber left border
│ 📊  Reports      │     │  📊  │
│ 📤  Publish      │     │  📤  │
│ ⚙   Settings     │     │  ⚙   │
│                  │     │      │
│ [◀ Collapse]     │     │ [▶]  │  ← toggle at bottom
└──────────────────┘     └──────┘
```

### EntriesList — Timeline
```
  TODAY                                     3h 00m
  ────────────────────────────────────────────────

  │
  ●  09:00 → 11:15   Task A              2h 15m
  │           Project Alpha · #123   [✎][⎘][✕] ← hover
  │
  ●  11:15 → 12:00   Task B              0h 45m
  │
  ◉  12:00 → …       Current Task        0h 47m  ← pulsing dot
```

## Open Questions

(none — all decisions confirmed with user)
