import { h } from 'vue';
import { describe, expect, it } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import CompactExpandableRow from '../../app/components/CompactExpandableRow.vue';

const ButtonStub = {
  props: ['ariaLabel', 'icon'],
  emits: ['click'],
  template:
    '<button v-bind="$attrs" :aria-label="ariaLabel || $attrs[\'aria-label\']" @click="$emit(\'click\')"></button>',
};
const TooltipStub = {
  props: ['text', 'content'],
  template: '<span v-bind="$attrs" :data-tooltip-text="text"><slot /></span>',
};

const stubs = { UButton: ButtonStub, UTooltip: TooltipStub };

describe('CompactExpandableRow', () => {
  it('uses the two-line named grid that becomes a single flex row at lg', async () => {
    const wrapper = await mountSuspended(CompactExpandableRow, {
      props: {
        expanded: false,
        expandLabel: 'Expand',
        collapseLabel: 'Collapse',
        expandTestid: 'row-expand',
        detailsId: 'row-detail',
        headerTestid: 'row-header',
      },
      slots: {
        title: () => 'Title',
        secondary: () => 'Secondary',
        meta: () => 'Meta',
        duration: () => '1:00',
      },
      global: { stubs },
    });

    const header = wrapper.find('[data-testid="row-header"]');
    expect(header.classes()).toContain('grid');
    expect(header.classes().some((cls) => cls.includes('grid-template-areas'))).toBe(true);
    expect(header.classes()).toContain('lg:flex');
  });

  it('exposes expansion state and toggles', async () => {
    const wrapper = await mountSuspended(CompactExpandableRow, {
      props: {
        expanded: false,
        expandLabel: 'Expand',
        collapseLabel: 'Collapse',
        expandTestid: 'row-expand',
        detailsId: 'row-detail',
      },
      global: { stubs },
    });

    const toggle = wrapper.find('[data-testid="row-expand"]');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    expect(toggle.attributes('aria-controls')).toBe('row-detail');
    expect(toggle.attributes('aria-label')).toBe('Expand');
    expect(wrapper.find('[data-testid="compact-row-detail"]').exists()).toBe(false);

    await toggle.trigger('click');
    expect(wrapper.emitted('toggle')).toHaveLength(1);
  });

  it('shows the detail region when expanded', async () => {
    const wrapper = await mountSuspended(CompactExpandableRow, {
      props: {
        expanded: true,
        expandLabel: 'Expand',
        collapseLabel: 'Collapse',
        expandTestid: 'row-expand',
        detailsId: 'row-detail',
      },
      slots: { detail: () => 'Detail body' },
      global: { stubs },
    });

    const toggle = wrapper.find('[data-testid="row-expand"]');
    expect(toggle.attributes('aria-expanded')).toBe('true');
    expect(toggle.attributes('aria-label')).toBe('Collapse');
    const detail = wrapper.find('[data-testid="compact-row-detail"]');
    expect(detail.exists()).toBe(true);
    expect(detail.attributes('id')).toBe('row-detail');
    expect(detail.text()).toBe('Detail body');
  });

  it('keeps a reserved actions width when empty and when filled', async () => {
    const empty = await mountSuspended(CompactExpandableRow, {
      props: {
        expanded: false,
        expandLabel: 'Expand',
        collapseLabel: 'Collapse',
        expandTestid: 'row-expand-empty',
        detailsId: 'row-detail-empty',
      },
      global: { stubs },
    });
    const filled = await mountSuspended(CompactExpandableRow, {
      props: {
        expanded: false,
        expandLabel: 'Expand',
        collapseLabel: 'Collapse',
        expandTestid: 'row-expand-filled',
        detailsId: 'row-detail-filled',
      },
      slots: {
        action: () => h('button', { class: 'h-6 w-6', type: 'button', 'aria-label': 'Go' }, 'x'),
      },
      global: { stubs },
    });

    const emptySlot = empty.find('[data-testid="compact-row-action"]');
    const filledSlot = filled.find('[data-testid="compact-row-action"]');
    expect(emptySlot.classes()).toEqual(expect.arrayContaining(['h-6', 'w-6', 'shrink-0']));
    expect(filledSlot.classes()).toEqual(expect.arrayContaining(['h-6', 'w-6', 'shrink-0']));
    expect(filledSlot.find('button').exists()).toBe(true);
  });
});
