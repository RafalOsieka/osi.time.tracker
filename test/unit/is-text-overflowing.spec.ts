import { describe, expect, it } from 'vitest';
import { isTextOverflowing, type OverflowHost } from '../../app/utils/is-text-overflowing';

function fakeBox(
  tagName: string,
  scrollWidth: number,
  clientWidth: number,
  nested: OverflowHost | null = null,
): OverflowHost {
  return {
    tagName,
    scrollWidth,
    clientWidth,
    querySelector: () => nested,
  };
}

describe('isTextOverflowing', () => {
  it('is true when content is wider than the box', () => {
    expect(isTextOverflowing(fakeBox('DIV', 240, 80))).toBe(true);
  });

  it('is false when content fits', () => {
    expect(isTextOverflowing(fakeBox('DIV', 40, 80))).toBe(false);
  });

  it('measures a nested input when the host is a wrapper', () => {
    const input = fakeBox('INPUT', 200, 50);
    const host = fakeBox('DIV', 50, 50, input);
    expect(isTextOverflowing(host)).toBe(true);
  });
});
