## Context

`applyRoundingRule(totalSeconds, rule)` in `shared/utils/rounding.ts` is the single place where a Client's rounding rule is applied. It is pure, used by the Remote Sync page to pre-fill the editable export duration, and covered by unit tests. Today:

```ts
const ROUNDING_INCREMENT_SECONDS = { up_15m: 900, up_30m: 1800, up_1h: 3600 };
if (rule === 'none' || totalSeconds === 0) return totalSeconds;
return Math.ceil(totalSeconds / increment) * increment;
```

`remoteRoundingRuleSchema` (`shared/types/remote-system-config.ts`) is the zod enum validating the stored value; the column is text, so widening the enum needs no migration. The rule value is also shipped to the browser inside `RemoteSyncConfigSurfaceDto`.

## Goals / Non-Goals

**Goals:**

- One rounding rule that yields `1:03 → 1:00` and `1:11 → 1:15`.
- Existing configurations keep behaving byte-for-byte identically.
- The automatic pick is always overridable in one tap, not just by typing.
- Rule semantics stay pure, shared, and unit-testable.

**Non-Goals:**

- Tolerance knobs, custom increments, per-day overrides.
- Rounding at persistence time or in reports.

## Decisions

**1. Add a `nearest_*` family instead of parameterising `up_*`.**
The alternative considered was `up_15m` plus a `roundingToleranceSeconds` field ("round up unless the overshoot is ≤ tolerance"). Same result for the two examples, but it introduces a second configuration field, a second validation surface, and a rule that cannot be explained in one sentence. A named enum value keeps the contract flat, keeps the UI a single select, and needs no schema addition beyond the enum. Trade-off: three more enum members instead of one knob.

**2. Half-up at the midpoint.**
`Math.round(total / increment) * increment`. For a 15-minute increment, `7:30` of overshoot rounds up. Rationale: banker's rounding is surprising to humans reading a timesheet, and half-up matches the "when in doubt, bill it" instinct. Deterministic and trivially testable.

**3. Never round a non-zero total to zero.**
`nearest_15m` on a 4-minute total would otherwise produce `0`, and REQ-113 excludes a zero-duration task from export — i.e. rounding would silently drop tracked work. Guard: `if (rounded === 0 && totalSeconds > 0) return increment`. Applied to every increment-based rule (harmless for `up_*`, where it can never trigger). `totalSeconds === 0` still returns `0`, so a genuinely empty selection stays excluded.

```
increment = 15m
  0:00 ──▶ 0:00      (empty stays empty)
  0:04 ──▶ 0:15      (zero guard)
  1:03 ──▶ 1:00
  1:07:30 ──▶ 1:15   (half-up)
  1:11 ──▶ 1:15
```

**4. Suggestions are derived, not stored.**
The expanded row offers three one-tap values — `exact` (selected total), `floor` (previous increment), `ceil` (next increment) — computed from the selected total and the configuration's increment. Choosing one sets the same per-task override `useRoundedDurations` already manages, so reset behaviour, REQ-113 override retention, and the exported value all stay on one code path. For `none` there is no increment, so only `exact` is offered. Duplicate suggestions (e.g. an exact multiple) are de-duplicated.

**5. Labels are i18n keys keyed by rule id.**
`remoteSystemConfig.roundingRule.<id>` for both the config select and any row hint, so `en`/`pl` parity is enforced by the existing i18n lint rule.

## Risks / Trade-offs

- **Users on `up_*` expect the new behaviour without changing their config** → the config form lists the `nearest_*` options with labels that state the behaviour ("Nearest 15 min"); no silent remapping of stored values, because silently changing what a saved configuration does to billed durations is worse than one manual edit.
- **Under-reporting becomes possible for the first time** (a rule can now reduce the pushed duration) → the row shows tracked → to-send with the delta (delivered by `remote-sync-page-redesign`), so the reduction is visible before export.
- **Enum widening breaks nothing server-side, but an older client could receive an unknown rule** → SSR ships the app and the enum together; unknown values are impossible in practice, and `applyRoundingRule` falls back to the passthrough branch rather than throwing.
- **Zero guard rounds up against the rule's own direction** → intentional and documented in the function's doc comment; the alternative (excluding the task) loses tracked time.
