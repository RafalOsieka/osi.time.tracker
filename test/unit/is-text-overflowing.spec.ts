import { describe, expect, it } from 'vitest';
import { isTextOverflowing, type OverflowBox } from '../../app/utils/isTextOverflowing';

function fakeBox(scrollWidth: number, clientWidth: number): OverflowBox {
  return {
    tagName: 'DIV',
    scrollWidth,
    clientWidth,
    querySelector: () => null,
  };
}

describe('isTextOverflowing', () => {
  it('is true when content is wider than the box', () => {
    expect(isTextOverflowing(fakeBox(240, 80))).toBe(true);
  });

  it('is false when content fits', () => {
    expect(isTextOverflowing(fakeBox(40, 80))).toBe(false);
  });

  it('measures a nested input when the host is a wrapper', () => {
    const input: OverflowBox = {
      tagName: 'INPUT',
      scrollWidth: 200,
      clientWidth: 50,
      querySelector: () => null,
    };
    const host: OverflowBox = {
      tagName: 'DIV',
      scrollWidth: 50,
      clientWidth: 50,
      querySelector: (selector: string) => (selector.includes('input') ? input : null),
    };
    expect(isTextOverflowing(host)).toBe(true);
  });
});
