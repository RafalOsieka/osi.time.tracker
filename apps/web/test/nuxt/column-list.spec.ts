import { h } from 'vue';
import { describe, expect, it } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import ColumnList from '../../app/components/ColumnList.vue';
import ColumnRow from '../../app/components/ColumnRow.vue';
import ColumnCell from '../../app/components/ColumnCell.vue';

const columns = [
  { key: 'state', track: '1.5rem', header: 'State', headerSrOnly: true },
  { key: 'title', track: { fr: 3, min: '8rem' }, header: 'Task' },
  { key: 'actions', track: '1.5rem', header: 'Actions' },
] as const;

describe('ColumnList', () => {
  it('shares tracks across header and cells with accessible roles', async () => {
    const wrapper = await mountSuspended(ColumnList, {
      props: { columns, narrow: '1.5rem minmax(0,1fr) 1.5rem' },
      slots: {
        default: () =>
          h(ColumnRow, null, () => [
            h(
              ColumnCell,
              { columns, col: 'state', narrow: { col: [1, 2], row: 1 } },
              () => 'Ready',
            ),
            h(
              ColumnCell,
              { columns, col: 'title', to: 'actions', narrow: { col: [2, 4], row: 2 } },
              () => 'Task',
            ),
            h(ColumnCell, {
              columns,
              col: 'actions',
              narrow: { col: [3, 4], row: 1 },
              'data-testid': 'empty-action',
            }),
          ]),
      },
    });

    const table = wrapper.find('[role="table"]');
    expect(table.attributes('style')).toContain('1.5rem minmax(8rem,3fr) 1.5rem');
    expect(wrapper.classes()).toContain('@container/list');
    const headers = wrapper.findAll('[role="columnheader"]');
    expect(headers).toHaveLength(3);
    expect(headers.map((header) => header.attributes('style'))).toEqual([
      'grid-column: 1;',
      'grid-column: 2;',
      'grid-column: 3;',
    ]);
    expect(headers[0]?.classes()).not.toContain('sr-only');
    expect(headers[0]?.find('span').classes()).toContain('sr-only');
    expect(wrapper.findAll('[role="row"]')).toHaveLength(2);
    expect(wrapper.findAll('[role="cell"]')).toHaveLength(3);
    expect(wrapper.find('[role="cell"]').element.parentElement?.className).toContain(
      'grid-cols-subgrid',
    );
    expect(wrapper.find('[data-testid="empty-action"]').exists()).toBe(true);
    const titleCell = wrapper.findAll('[role="cell"]')[1];
    expect(titleCell?.attributes('style')).toContain('--col: 2 / 4');
    expect(titleCell?.attributes('style')).toContain('--narrow-col: 2 / 4');
    expect(titleCell?.attributes('style')).toContain('--narrow-row: 2');
    expect(table.attributes('style')).toContain('--narrow-cols: 1.5rem minmax(0,1fr) 1.5rem');
    expect(table.classes()).toContain('@max-[40rem]/list:block');
    expect(wrapper.find('[role="row"]').classes()).toContain('sticky');
    expect(wrapper.find('[role="row"]').classes()).toContain('bg-default');
  });

  it('can disable the sticky header', async () => {
    const wrapper = await mountSuspended(ColumnList, {
      props: { columns, narrow: '1fr', stickyHeader: false },
    });
    expect(wrapper.find('[role="row"]').classes()).not.toContain('sticky');
  });

  it('exposes an expandable row relationship', async () => {
    const wrapper = await mountSuspended(ColumnRow, {
      props: { expanded: true, detailsId: 'details' },
    });
    expect(wrapper.attributes('aria-expanded')).toBe('true');
    expect(wrapper.attributes('aria-controls')).toBe('details');
  });
});
