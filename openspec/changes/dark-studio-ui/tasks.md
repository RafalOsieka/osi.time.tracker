## 1. Theme Foundation

- [x] 1.1 Add JetBrains Mono Google Fonts CDN `<link>` tags to `src/Web/index.html`
- [x] 1.2 Add `--ds-*` CSS custom properties for light mode (`:root`) and dark mode (`.dark`) palettes to `src/Web/src/style.css`
- [x] 1.3 Add `@keyframes pulse-glow` and `@keyframes dot-pulse` animations to `src/Web/src/style.css`
- [x] 1.4 Override PrimeVue Aura preset tokens (amber primary, dark/light surface palette) in `src/Web/src/main.ts` via `extend`

## 2. Layout Shell

- [x] 2.1 Update `src/Web/src/layouts/DefaultLayout.vue` to use `--ds-bg-base` background (replaces `bg-slate-50 dark:bg-slate-950`)

## 3. Sidebar

- [x] 3.1 Restyle `AppSidebar.vue` desktop sidebar: use `--ds-bg-surface` background, `--ds-border` right border
- [x] 3.2 Restyle nav items: inactive uses `--ds-text-lo`, hover uses `--ds-text-hi` + `--ds-bg-raised`
- [x] 3.3 Restyle active nav item: amber left border (3px) + `--ds-accent` icon color + subtle `--ds-accent/5` background
- [x] 3.4 Restyle collapse toggle button at bottom to match dark-studio style
- [x] 3.5 Restyle mobile drawer header and nav items to match dark-studio palette

## 4. Timer Bar

- [x] 4.1 Restyle idle state card in `TimerBar.vue`: `--ds-bg-surface` background, `--ds-border` border
- [x] 4.2 Implement hero running state: full-width card, `RUNNING` label (`text-xs tracking-widest uppercase --ds-text-lo`), giant centered elapsed time (`text-7xl font-mono font-bold tabular-nums --ds-accent`)
- [x] 4.3 Apply `pulse-glow` animation and `border-l-[3px]` amber border to the running card
- [x] 4.4 Add `will-change: box-shadow` to the running card for paint performance
- [x] 4.5 Restyle task title (`text-lg font-semibold --ds-text-hi`) and item label (`text-sm --ds-text-lo`) in running state
- [x] 4.6 Restyle Stop button (danger severity) and align it to the right of the running card

## 5. Entries Timeline

- [x] 5.1 Restructure each entry row in `EntriesList.vue` to include a left timeline column (`w-6`) with vertical connecting line
- [x] 5.2 Add static dot (`w-3 h-3 rounded-full`) for completed entries using `--ds-border-hi` color
- [x] 5.3 Add pulsing dot for active (running) entry using `--ds-success` color + `dot-pulse` animation
- [x] 5.4 Restyle time range to `text-xs font-mono --ds-text-lo`, title to `font-medium --ds-text-hi`, item label to `text-xs --ds-text-lo`
- [x] 5.5 Restyle duration to `font-mono font-semibold --ds-text-hi` right-aligned
- [x] 5.6 Make action buttons (edit, split, delete) hidden by default (`opacity-0`) and visible on row hover (`group-hover:opacity-100 transition-opacity`); add `group` class to the row
- [x] 5.7 Restyle Today/Week toggle: pill style, amber active state using `--ds-accent`
- [x] 5.8 Restyle total duration label to use `font-mono font-semibold --ds-accent`

## 6. Verification

- [x] 6.1 Run `pnpm test` from `src/Web` and confirm all tests pass (no test files exist — pure UI change)
- [x] 6.2 Visually verify dark mode: timer hero, sidebar collapse, timeline dots, amber accents (manual)
- [x] 6.3 Visually verify light mode: same components, correct light palette, readable contrast (manual)
- [x] 6.4 Verify PrimeVue components (Select, Button, Drawer) render correctly in both modes (manual)
