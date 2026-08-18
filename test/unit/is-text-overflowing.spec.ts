import { describe, expect, it } from 'vitest';
import { isTextOverflowing } from '../../app/utils/isTextOverflowing';

function fakeBox(scrollWidth: number, clientWidth: number): HTMLElement {
  return {
    scrollWidth,
    clientWidth,
    querySelector: () => null,
  } as unknown as HTMLElement;
}

describe('isTextOverflowing', () => {
  it('is true when content is wider than the box', () => {
    expect(isTextOverflowing(fakeBox(240, 80))).toBe(true);
  });

  it('is false when content fits', () => {
    expect(isTextOverflowing(fakeBox(40, 80))).toBe(false);
  });

  it('measures a nested input when the host is a wrapper', () => {
    const input = fakeBox(200, 50);
    const host = {
      scrollWidth: 50,
      clientWidth: 50,
      querySelector: (selector: string) => (selector.includes('input') ? input : null),
    } as unknown as HTMLElement;
    expect(isTextOverflowing(host)).toBe(true);
  });
});
