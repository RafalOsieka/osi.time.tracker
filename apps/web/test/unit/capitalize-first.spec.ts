import { describe, expect, it } from 'vitest';
import { capitalizeFirst } from '../../app/utils/capitalize-first';

describe('capitalizeFirst', () => {
  it('capitalises a Polish period label and leaves the rest alone', () => {
    expect(capitalizeFirst('listopad 2026', 'pl')).toBe('Listopad 2026');
    expect(capitalizeFirst('pt., 6 lis 2026', 'pl')).toBe('Pt., 6 lis 2026');
  });

  it('keeps an empty label empty', () => {
    expect(capitalizeFirst('', 'en')).toBe('');
  });
});
