# dark-studio-theme Specification

## Purpose
TBD - created by archiving change dark-studio-ui. Update Purpose after archive.
## Requirements
### Requirement: OS-preference dark/light mode
The app SHALL follow the OS color scheme preference (dark or light) automatically with no manual toggle required. Both modes SHALL be fully styled with the Dark Studio palette.

#### Scenario: Dark mode on dark OS
- **WHEN** the user's OS is set to dark mode
- **THEN** the app renders with dark surfaces (`#0d0d10` base, `#16161c` panels) and amber accent (`#f59e0b`)

#### Scenario: Light mode on light OS
- **WHEN** the user's OS is set to light mode
- **THEN** the app renders with light surfaces (`#f8f8fa` base, `#ffffff` panels) and amber accent (`#d97706`)

---

### Requirement: Amber accent color system
The app SHALL use an amber/orange primary accent color applied consistently to active states, the running timer, active nav items, and primary action buttons.

#### Scenario: Active sidebar item
- **WHEN** the user is on a page
- **THEN** the corresponding sidebar nav item shows an amber left border and amber icon color

#### Scenario: Primary button color
- **WHEN** a primary action button (e.g., Start) is rendered
- **THEN** it uses the amber accent as its background color

---

### Requirement: JetBrains Mono for numeric values
All time durations, timestamps, and the running timer display SHALL use JetBrains Mono (monospace) font. UI labels and text SHALL use system-ui.

#### Scenario: Timer display font
- **WHEN** the timer is running
- **THEN** the elapsed time number renders in JetBrains Mono, bold, tabular-nums

#### Scenario: Entry duration font
- **WHEN** entries are listed
- **THEN** duration values render in JetBrains Mono

---

### Requirement: Hero timer display
When the timer is running, the timer card SHALL occupy the full width of the content area with the elapsed time displayed as a giant centered number (minimum `4rem` / `text-7xl`). The card SHALL show a pulse-glow animation on its left border using the amber accent color.

#### Scenario: Running timer hero layout
- **WHEN** the timer is running
- **THEN** the timer card is full-width, the elapsed time is centered and at least `4rem` tall, and the left border pulses with amber glow

#### Scenario: Idle timer layout
- **WHEN** no timer is running
- **THEN** the timer card shows a compact input row (item selector, title input, start button) with no hero layout

---

### Requirement: Collapsible sidebar with bottom toggle
The sidebar SHALL support two states: expanded (icons + labels, `w-56`) and collapsed (icons only, `w-14`). The toggle button SHALL be located at the bottom of the sidebar. The collapse state SHALL be persisted in the layout store.

#### Scenario: Sidebar expands
- **WHEN** the user clicks the toggle button while sidebar is collapsed
- **THEN** the sidebar expands to show icons and labels

#### Scenario: Sidebar collapses
- **WHEN** the user clicks the toggle button while sidebar is expanded
- **THEN** the sidebar collapses to show icons only

---

### Requirement: Timeline entries layout
The entries list SHALL render as a vertical timeline with a left-side connecting line and dot per entry. Completed entries SHALL show a static dot; the active (running) entry SHALL show a pulsing colored dot. Action buttons (edit, split, delete) SHALL be hidden by default and revealed on row hover.

#### Scenario: Completed entry dot
- **WHEN** an entry has an end time
- **THEN** it shows a static dot on the timeline line

#### Scenario: Active entry dot
- **WHEN** an entry has no end time (currently running)
- **THEN** it shows a pulsing dot in the success color

#### Scenario: Hover-reveal actions
- **WHEN** the user hovers over an entry row
- **THEN** the edit, split, and delete buttons become visible

