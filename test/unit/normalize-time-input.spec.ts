import { describe, expect, it } from 'vitest';
import { normalizeTimeInput } from '../../app/utils/normalizeTimeInput';

describe('normalizeTimeInput', () => {
  it.each([
    ['9', '09:00'],
    ['23', '23:00'],
    ['93', '09:30'],
    ['59', null],
    ['900', '09:00'],
    ['1234', '12:34'],
    ['123:', '01:23'],
    ['9:5', '09:05'],
    [' 9:5 ', '09:05'],
    ['25:00', null],
    ['12:66', null],
    ['', null],
    ['24:00', null],
    ['0', '00:00'],
    ['0000', '00:00'],
    [':30', '00:30'],
    ['abc', null],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeTimeInput(input)).toBe(expected);
  });
});
