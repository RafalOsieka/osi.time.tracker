## ADDED Requirements

### Requirement: REQ-175 Inline-edit affordance uses a Nuxt UI input
Click-to-edit text fields (e.g. a time entry's title and its project selector on the timer surface) SHALL express their editable affordance with a Nuxt UI `UInput` — a seamless display state (`variant="none"`, styled like plain text) that becomes an editable state (`variant="ghost"`) on focus/activation — rather than a native `<button>` or a `UButton` styled with custom CSS to look like editable text. The affordance SHALL commit the normalized value on blur or Enter and revert on Escape or invalid input (no model update, no request), preserving the existing behavior. It SHALL retain its accessible label and `data-testid`, and MAY keep dynamic `ch`-based sizing via an inline `:style` (a legitimate dynamic style, not residual scoped CSS). No `<style scoped>` block SHALL be added to reset button chrome for this pattern.

#### Scenario: Text field reads as plain text until edited
- **WHEN** an inline-editable title or project field is displayed without focus
- **THEN** it SHALL render as seamless plain text (`UInput variant="none"`) with no border, ring, or button chrome

#### Scenario: Field becomes editable on activation and commits
- **WHEN** the user focuses the field, edits the value, and blurs or presses Enter
- **THEN** the field SHALL present an editable `UInput` and SHALL commit the normalized value

#### Scenario: Invalid input or Escape reverts without side effects
- **WHEN** the user presses Escape or enters a value that cannot be normalized
- **THEN** the field SHALL revert to the previous value, SHALL NOT emit a model update, and SHALL NOT send a request

#### Scenario: No button-as-text CSS overrides remain
- **WHEN** the inline-edit affordance is implemented
- **THEN** it SHALL NOT rely on a `UButton`/`<button>` reset via `<style scoped>` (background/padding/font resets) to imitate editable text
