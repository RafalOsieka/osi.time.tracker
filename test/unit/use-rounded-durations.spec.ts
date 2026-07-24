import { describe, expect, it } from 'vitest';
import { useRoundedDurations } from '../../app/composables/useRoundedDurations';

describe('useRoundedDurations', () => {
  it('applies rounding until an override is committed', () => {
    const { computedSeconds, commit, hasOverride, displayedInput } = useRoundedDurations();

    expect(computedSeconds('task-1', 60, 'up_15m')).toBe(900);
    expect(displayedInput('task-1', 60, 'up_15m')).toBe('00:15:00');

    commit('task-1', 60, 'up_15m');
    // commit without typed input keeps the currently displayed rounded value
    expect(hasOverride('task-1')).toBe(true);
    expect(computedSeconds('task-1', 60, 'up_15m')).toBe(900);
  });

  it('commits a typed duration and reverts invalid input without override', () => {
    const { setInput, commit, hasOverride, displayedInput, computedSeconds, reset } =
      useRoundedDurations();

    setInput('task-1', '1:30');
    commit('task-1', 60, 'none');
    expect(hasOverride('task-1')).toBe(true);
    expect(computedSeconds('task-1', 60, 'none')).toBe(5400);
    expect(displayedInput('task-1', 60, 'none')).toBe('01:30:00');

    setInput('task-1', 'not-a-duration');
    commit('task-1', 60, 'none');
    // invalid input reverts display to the last valid override and keeps it
    expect(hasOverride('task-1')).toBe(true);
    expect(displayedInput('task-1', 60, 'none')).toBe('01:30:00');

    reset('task-1');
    expect(hasOverride('task-1')).toBe(false);
    expect(computedSeconds('task-1', 120, 'none')).toBe(120);
  });

  it('reverts invalid input to the computed rounded value when no override exists', () => {
    const { setInput, commit, hasOverride, displayedInput } = useRoundedDurations();

    setInput('task-2', '???');
    commit('task-2', 60, 'up_15m');
    expect(hasOverride('task-2')).toBe(false);
    expect(displayedInput('task-2', 60, 'up_15m')).toBe('00:15:00');
  });
});
