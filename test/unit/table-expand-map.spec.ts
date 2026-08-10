import { describe, expect, it } from 'vitest';
import { asExpandMap, isExpandedInMap, toggleExpandMap } from '../../app/utils/tableExpandMap';

describe('tableExpandMap', () => {
  it('asExpandMap normalizes expand-all to an empty map copy', () => {
    expect(asExpandMap(true)).toEqual({});
    expect(asExpandMap({ a: true })).toEqual({ a: true });
  });

  it('isExpandedInMap treats true as expand-all', () => {
    expect(isExpandedInMap(true, 'task-1')).toBe(true);
    expect(isExpandedInMap({ 'task-1': true }, 'task-1')).toBe(true);
    expect(isExpandedInMap({ 'task-1': false }, 'task-1')).toBe(false);
    expect(isExpandedInMap({}, 'task-1')).toBe(false);
  });

  it('toggleExpandMap collapses a row from expand-all', () => {
    expect(toggleExpandMap(true, 'task-1')).toEqual({ 'task-1': false });
  });

  it('toggleExpandMap flips a key on a plain map', () => {
    expect(toggleExpandMap({ 'task-1': true }, 'task-1')).toEqual({ 'task-1': false });
    expect(toggleExpandMap({}, 'task-2')).toEqual({ 'task-2': true });
  });
});
