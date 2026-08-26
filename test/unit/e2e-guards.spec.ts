import { describe, expect, it } from 'vitest';
import { describeOrSkip, type DescribeSelection } from '../e2e/harness/guards';

function fakeDescribe() {
  const skip = () => undefined;
  const fn: DescribeSelection = Object.assign(() => undefined, { skip });
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
