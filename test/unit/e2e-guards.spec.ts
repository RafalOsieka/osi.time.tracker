import { describe, expect, it } from 'vitest';
import { describeOrSkip } from '../e2e/harness/guards';

type DescribeFn = typeof describe;
type SkipFn = typeof describe.skip;

function fakeDescribe() {
  // SAFETY: Vitest SuiteAPI is not constructible in a unit fake.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- Vitest SuiteAPI is not constructible in a unit fake
  const skip = (() => undefined) as unknown as SkipFn;
  // SAFETY: Vitest SuiteAPI is not constructible in a unit fake.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- Vitest SuiteAPI is not constructible in a unit fake
  const fn = Object.assign(() => undefined, { skip }) as unknown as DescribeFn;
  return { fn, skip };
}

describe('e2e describeOrSkip', () => {
  it('returns describe when the prerequisite is available', () => {
    const { fn, skip } = fakeDescribe();
    const selected = describeOrSkip({
      available: true,
      missing: 'Docker',
      isCiEnv: true,
      describeFn: fn,
    });
    expect(selected).toBe(fn);
    expect(selected).not.toBe(skip);
  });

  it('returns describe.skip locally when the prerequisite is missing', () => {
    const { fn, skip } = fakeDescribe();
    const selected = describeOrSkip({
      available: false,
      missing: 'Docker',
      isCiEnv: false,
      describeFn: fn,
    });
    expect(selected).toBe(skip);
  });

  it('throws in CI when the prerequisite is missing', () => {
    const { fn } = fakeDescribe();
    expect(() =>
      describeOrSkip({
        available: false,
        missing: 'Chromium',
        isCiEnv: true,
        describeFn: fn,
      }),
    ).toThrow(/Chromium is required in CI/);
  });
});
