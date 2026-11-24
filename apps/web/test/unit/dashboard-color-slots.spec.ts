import { describe, expect, it } from 'vitest';
import { assignColorSlots } from '../../server/utils/dashboard-groups';

describe('palette slots of the colored groups', () => {
  it('gives each group the slot of its place in creation order', () => {
    expect(assignColorSlots([2, 0, 5, 3])).toEqual([2, 0, 5, 3]);
  });

  it('wraps a place past the last slot', () => {
    expect(assignColorSlots([7, 12])).toEqual([1, 0]);
  });

  it('moves the later of two groups on one slot to the next free one', () => {
    expect(assignColorSlots([8, 2])).toEqual([3, 2]);
  });

  it('leaves the slot a group wants to it even when an earlier one was moved there', () => {
    // 0 and 6 meet on slot 0; 1 keeps slot 1, so 6 moves on to slot 2.
    expect(assignColorSlots([6, 1, 0])).toEqual([2, 1, 0]);
  });

  it('moves past the last slot to the first', () => {
    expect(assignColorSlots([11, 5])).toEqual([0, 5]);
  });

  it('fills every slot when six groups want the same one', () => {
    expect(assignColorSlots([30, 24, 18, 12, 6, 0])).toEqual([5, 4, 3, 2, 1, 0]);
  });

  it('ignores the ranking the groups come in', () => {
    expect(assignColorSlots([3, 9])).toEqual([3, 4]);
    expect(assignColorSlots([9, 3])).toEqual([4, 3]);
  });
});
