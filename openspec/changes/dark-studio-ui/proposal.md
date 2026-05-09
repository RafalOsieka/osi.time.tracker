## Why

The current UI is functional but visually generic — it lacks identity and fails to communicate the focused, professional nature of a developer time tracker. The timer, the app's core interaction, is rendered as a small inline element with no visual weight.

## What Changes

- **Theme**: Amber/orange accent color with full dark + light mode support (follows OS preference)
- **Timer**: Hero display — full-width card with giant centered number when running, pulse animation on card border
- **Sidebar**: Collapsible (icons + labels when expanded, icons only when collapsed), toggle button at the bottom
- **Entries**: Vertical timeline layout with left-side dots and connecting line, hover-reveal action buttons
- **Typography**: JetBrains Mono for all numeric/time values; system-ui for UI text
- **Mobile**: Hamburger drawer kept as-is — desktop-first redesign

## Capabilities

### New Capabilities
- `dark-studio-theme`: Amber/dark PrimeVue token preset, CSS custom properties, pulse animation, JetBrains Mono integration, OS-preference dark/light mode

### Modified Capabilities
- (none — no spec-level behavior changes, purely visual/layout)

## Impact

- `src/Web/index.html`: Add JetBrains Mono Google Fonts CDN link
- `src/Web/src/style.css`: CSS custom properties for dark/light palettes, `@keyframes pulse-glow` and `dot-pulse` animations
- `src/Web/src/main.ts`: PrimeVue theme token overrides (amber primary, dark surfaces)
- `src/Web/src/layouts/DefaultLayout.vue`: Background color wired to CSS custom properties
- `src/Web/src/components/AppSidebar.vue`: Collapsible sidebar with bottom toggle, dark-studio styling
- `src/Web/src/components/TimerBar.vue`: Hero timer card (full-width, giant centered number, pulse border) vs idle input row
- `src/Web/src/components/EntriesList.vue`: Timeline dots + connecting line, hover-reveal actions, monospace durations
- No backend changes. No new npm packages required.
