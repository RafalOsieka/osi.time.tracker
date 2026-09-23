import { describe, expect, it } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import { CalendarDateTime, parseZonedDateTime, Time } from '@internationalized/date';
import TableHeader from '../../app/components/TableHeader.vue';
import EmptyState from '../../app/components/EmptyState.vue';
import RowActions from '../../app/components/RowActions.vue';
import DurationInput from '../../app/components/DurationInput.vue';
import TimeField from '../../app/components/TimeField.vue';

const ButtonStub = {
  props: ['label', 'icon', 'ariaLabel'],
  emits: ['click'],
  template:
    '<button v-bind="$attrs" :aria-label="ariaLabel || $attrs[\'aria-label\']" @click="$emit(\'click\')">{{ label }}</button>',
};
const TooltipStub = {
  props: ['text', 'content'],
  template: '<span v-bind="$attrs" :data-tooltip-text="text"><slot /></span>',
};
const InputStub = {
  template:
    '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  props: ['modelValue', 'inputmode'],
  emits: ['update:modelValue'],
};
// Stands in for Nuxt UI's segmented `UInputTime`: the real component's model
// is an `@internationalized/date` `Time`/`ZonedDateTime` (single) or
// `{ start, end }` (range), but tests drive it directly via
// `vm.$emit('update:modelValue', ...)` rather than simulating segment
// keystrokes (jsdom/happy-dom cannot run reka's segment key handling).
// `blur`/`keydown` are deliberately NOT declared as emits here so they fall
// through `$attrs` onto the rendered `<div>` as plain native listeners,
// matching how the real `UInputTime` forwards them onto its own DOM root.
const InputTimeStub = {
  inheritAttrs: false,
  template: '<div v-bind="$attrs" class="input-time-stub"><slot name="separator" /></div>',
  props: [
    'modelValue',
    'range',
    'hourCycle',
    'granularity',
    'size',
    'variant',
    'ui',
    'disabled',
    'hideTimeZone',
  ],
  emits: ['update:modelValue'],
};

describe('TableHeader', () => {
  it('renders the title and New button, and emits create on click', async () => {
    const wrapper = await mountSuspended(TableHeader, {
      props: { title: 'trackers', newLabel: 'New client', newTestid: 'new-client-button' },
      global: { stubs: { UButton: ButtonStub } },
    });

    expect(wrapper.text()).toContain('trackers');
    const button = wrapper.find('[data-testid="new-client-button"]');
    expect(button.exists()).toBe(true);

    await button.trigger('click');
    expect(wrapper.emitted('create')).toHaveLength(1);
  });
});

describe('EmptyState', () => {
  it('renders the message and CTA, and emits create on click', async () => {
    const wrapper = await mountSuspended(EmptyState, {
      props: { message: 'No trackers yet', ctaLabel: 'Add one', testid: 'trackers-empty-state' },
      global: { stubs: { UButton: ButtonStub } },
    });

    expect(wrapper.find('[data-testid="trackers-empty-state"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('No trackers yet');

    const cta = wrapper.find('[data-testid="empty-state-cta"]');
    expect(cta.exists()).toBe(true);
    await cta.trigger('click');
    expect(wrapper.emitted('create')).toHaveLength(1);
  });
});

describe('RowActions', () => {
  it('exposes accessible names and testids, and emits edit/delete', async () => {
    const wrapper = await mountSuspended(RowActions, {
      props: {
        editLabel: 'Edit',
        deleteLabel: 'Delete',
        editTestid: 'edit-client-1',
        deleteTestid: 'delete-client-1',
      },
      global: { stubs: { UButton: ButtonStub, UTooltip: TooltipStub } },
    });

    const editButton = wrapper.find('[data-testid="edit-client-1"]');
    const deleteButton = wrapper.find('[data-testid="delete-client-1"]');
    expect(editButton.attributes('aria-label')).toBe('Edit');
    expect(deleteButton.attributes('aria-label')).toBe('Delete');
    expect(
      editButton.element.closest('[data-tooltip-text]')?.getAttribute('data-tooltip-text'),
    ).toBe('Edit');
    expect(
      deleteButton.element.closest('[data-tooltip-text]')?.getAttribute('data-tooltip-text'),
    ).toBe('Delete');

    await editButton.trigger('click');
    expect(wrapper.emitted('edit')).toHaveLength(1);

    await deleteButton.trigger('click');
    expect(wrapper.emitted('delete')).toHaveLength(1);
  });
});

describe('DurationInput', () => {
  function mount(modelValue = '00:50:00') {
    return mountSuspended(DurationInput, {
      props: { modelValue, label: 'Export duration', testid: 'duration-input' },
      global: { stubs: { UInput: InputStub } },
    });
  }

  it('has an accessible label and normalizes bare minutes on blur', async () => {
    const wrapper = await mount();
    const input = wrapper.find<HTMLInputElement>('[data-testid="duration-input"]');

    expect(input.attributes('aria-label')).toBe('Export duration');
    await input.setValue('45');
    await input.trigger('blur');

    expect(wrapper.emitted('update:modelValue')).toEqual([['00:45:00']]);
    expect(input.element.value).toBe('00:45:00');
  });

  it('commits a normalized H:MM value on Enter', async () => {
    const wrapper = await mount();
    const input = wrapper.find('[data-testid="duration-input"]');

    await input.setValue('1:5');
    await input.trigger('keydown.enter');

    expect(wrapper.emitted('update:modelValue')).toEqual([['01:05:00']]);
  });

  it('does not bound hours, so a duration may exceed 24 hours', async () => {
    const wrapper = await mount();
    const input = wrapper.find('[data-testid="duration-input"]');

    await input.setValue('26:15');
    await input.trigger('keydown.enter');

    expect(wrapper.emitted('update:modelValue')).toEqual([['26:15:00']]);
  });

  it('silently reverts invalid input without updating the model', async () => {
    const wrapper = await mount();
    const input = wrapper.find<HTMLInputElement>('[data-testid="duration-input"]');

    await input.setValue('1:75');
    await input.trigger('blur');

    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    expect(input.element.value).toBe('00:50:00');
  });

  it('reverts on Escape without updating the model', async () => {
    const wrapper = await mount();
    const input = wrapper.find<HTMLInputElement>('[data-testid="duration-input"]');

    await input.setValue('12:30:00');
    await input.trigger('keydown.esc');

    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    expect(input.element.value).toBe('00:50:00');
  });

  it('reserves compact width for a full HH:MM:SS plus input chrome', async () => {
    const wrapper = await mount('01:30:00');
    const root = wrapper.find('.time-input--compact');
    expect(root.exists()).toBe(true);
    // `ui` is a plain object prop, not a DOM attribute Vue merges into HTML,
    // so its value is read off the stub instance rather than the markup.
    // SAFETY: `DurationInput` always passes a `{ root, base }` shape.
    const ui = wrapper.findComponent(InputStub).vm.$attrs.ui as { root?: string };
    expect(ui.root).toContain('8ch');
    expect(wrapper.find<HTMLInputElement>('[data-testid="duration-input"]').element.value).toBe(
      '01:30:00',
    );
  });
});

type TimeFieldStubValue = Time | { start: Time | undefined; end: Time | undefined };

describe('TimeField', () => {
  it('hides the zone on ordinary dates but shows it on either transition date of a range', async () => {
    const winter = parseZonedDateTime('2026-01-12T10:42+01:00[Europe/Warsaw]');
    const spring = parseZonedDateTime('2026-03-29T10:42+02:00[Europe/Warsaw]');
    const repeated = parseZonedDateTime('2026-10-25T02:42+01:00[Europe/Warsaw]');
    const wrapper = await mountSuspended(TimeField, {
      props: { modelValue: winter, testid: 'time-field' },
      global: { stubs: { UInputTime: InputTimeStub } },
    });
    const field = wrapper.findComponent(InputTimeStub);
    expect(field.props('hideTimeZone')).toBe(true);
    await wrapper.setProps({ modelValue: spring });
    expect(field.props('hideTimeZone')).toBe(false);
    await wrapper.setProps({ modelValue: repeated });
    expect(field.props('hideTimeZone')).toBe(false);
    await wrapper.setProps({ modelValue: { start: winter, end: spring }, range: true });
    expect(field.props('hideTimeZone')).toBe(false);
    await wrapper.setProps({ modelValue: { start: winter, end: undefined } });
    expect(field.props('hideTimeZone')).toBe(true);
    await wrapper.setProps({ modelValue: new CalendarDateTime(2026, 3, 29, 10, 42), range: false });
    expect(field.props('hideTimeZone')).toBe(true);
    await wrapper.setProps({ modelValue: new Time(10, 42) });
    expect(field.props('hideTimeZone')).toBe(true);
  });
  function emitModelValue(
    wrapper: Awaited<ReturnType<typeof mountSuspended>>,
    value: TimeFieldStubValue,
  ) {
    wrapper.findComponent(InputTimeStub).vm.$emit('update:modelValue', value);
  }

  /** Dispatches a real `focusout` so `relatedTarget` (unlike `.trigger()`) is honored. */
  function dispatchFocusOut(
    wrapper: Awaited<ReturnType<typeof mountSuspended>>,
    relatedTarget: EventTarget | null,
  ) {
    wrapper
      .find('[data-testid="time-field"]')
      .element.dispatchEvent(new FocusEvent('focusout', { relatedTarget, bubbles: true }));
  }

  it('commits a changed value on Enter', async () => {
    const wrapper = await mountSuspended(TimeField, {
      props: { modelValue: new Time(9, 0), label: 'Start time', testid: 'time-field' },
      global: { stubs: { UInputTime: InputTimeStub } },
    });

    emitModelValue(wrapper, new Time(9, 30));
    await wrapper.find('[data-testid="time-field"]').trigger('keydown', { key: 'Enter' });

    expect(wrapper.emitted('commit')).toHaveLength(1);
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([new Time(9, 30)]);
  });

  it('commits on focus leaving the field', async () => {
    const wrapper = await mountSuspended(TimeField, {
      props: { modelValue: new Time(9, 0), label: 'Start time', testid: 'time-field' },
      global: { stubs: { UInputTime: InputTimeStub } },
    });

    emitModelValue(wrapper, new Time(9, 30));
    dispatchFocusOut(wrapper, null);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(wrapper.emitted('commit')).toHaveLength(1);
  });

  it('does not commit when focus moves within the field', async () => {
    const wrapper = await mountSuspended(TimeField, {
      props: { modelValue: new Time(9, 0), label: 'Start time', testid: 'time-field' },
      global: { stubs: { UInputTime: InputTimeStub } },
    });

    emitModelValue(wrapper, new Time(9, 30));
    // `Node.contains()` treats a node as containing itself, so a `relatedTarget`
    // of the field's own root stands in for focus staying within the field
    // (segment-to-segment movement is exercised for real in the Playwright layer).
    const inside = document.createElement('button');
    wrapper.find('.input-time-stub').element.append(inside);
    document.body.append(wrapper.element);
    inside.focus();
    dispatchFocusOut(wrapper, null);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(wrapper.emitted('commit')).toBeUndefined();
    wrapper.unmount();
  });

  it('does not commit an incomplete range on an internal move, then commits once outside', async () => {
    const wrapper = await mountSuspended(TimeField, {
      props: {
        modelValue: { start: new Time(9, 0), end: new Time(10, 0) },
        range: true,
        testid: 'time-field',
      },
      global: { stubs: { UInputTime: InputTimeStub } },
    });
    const inside = document.createElement('button');
    const outside = document.createElement('button');
    wrapper.find('.input-time-stub').element.append(inside);
    document.body.append(wrapper.element);
    document.body.append(outside);
    emitModelValue(wrapper, { start: undefined, end: new Time(10, 0) });
    inside.focus();
    dispatchFocusOut(wrapper, outside);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(wrapper.emitted('commit')).toBeUndefined();
    emitModelValue(wrapper, { start: new Time(9, 30), end: new Time(10, 0) });
    outside.focus();
    dispatchFocusOut(wrapper, null);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(wrapper.emitted('commit')).toHaveLength(1);
    outside.remove();
    wrapper.unmount();
  });

  it('does not commit a pending blur after Escape', async () => {
    const wrapper = await mountSuspended(TimeField, {
      props: { modelValue: new Time(9, 0), testid: 'time-field' },
      global: { stubs: { UInputTime: InputTimeStub } },
    });
    emitModelValue(wrapper, new Time(9, 30));
    dispatchFocusOut(wrapper, null);
    await wrapper.find('[data-testid="time-field"]').trigger('keydown', { key: 'Escape' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(wrapper.emitted('commit')).toBeUndefined();
  });

  it('reports an unchanged commit by not emitting commit', async () => {
    const wrapper = await mountSuspended(TimeField, {
      props: { modelValue: new Time(9, 0), label: 'Start time', testid: 'time-field' },
      global: { stubs: { UInputTime: InputTimeStub } },
    });

    emitModelValue(wrapper, new Time(9, 0));
    await wrapper.find('[data-testid="time-field"]').trigger('keydown', { key: 'Enter' });

    expect(wrapper.emitted('commit')).toBeUndefined();
  });

  it('cancels on Escape, reverting to the last committed value', async () => {
    const wrapper = await mountSuspended(TimeField, {
      props: { modelValue: new Time(9, 0), label: 'Start time', testid: 'time-field' },
      global: { stubs: { UInputTime: InputTimeStub } },
    });

    emitModelValue(wrapper, new Time(9, 30));
    await wrapper.find('[data-testid="time-field"]').trigger('keydown', { key: 'Escape' });

    expect(wrapper.emitted('cancel')).toHaveLength(1);
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([new Time(9, 0)]);
  });

  it('clamps the edited start when it inverts within the same minute', async () => {
    const wrapper = await mountSuspended(TimeField, {
      props: {
        modelValue: { start: new Time(10, 42, 50), end: new Time(10, 43, 10) },
        range: true,
        clampSeconds: true,
        label: 'Start and stop time',
        testid: 'time-field',
      },
      global: { stubs: { UInputTime: InputTimeStub } },
    });

    // User retypes the start minute to 43; reka preserves the untouched seconds.
    emitModelValue(wrapper, { start: new Time(10, 43, 50), end: new Time(10, 43, 10) });
    await wrapper.find('[data-testid="time-field"]').trigger('keydown', { key: 'Enter' });

    expect(wrapper.emitted('commit')).toHaveLength(1);
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
      { start: new Time(10, 43, 10), end: new Time(10, 43, 10) },
    ]);
  });

  it('clamps the edited end when it inverts within the same minute', async () => {
    const wrapper = await mountSuspended(TimeField, {
      props: {
        modelValue: { start: new Time(10, 42, 50), end: new Time(10, 43, 10) },
        range: true,
        clampSeconds: true,
        label: 'Start and stop time',
        testid: 'time-field',
      },
      global: { stubs: { UInputTime: InputTimeStub } },
    });

    // User retypes the end minute back to 42; end's seconds (10) are untouched.
    emitModelValue(wrapper, { start: new Time(10, 42, 50), end: new Time(10, 42, 10) });
    await wrapper.find('[data-testid="time-field"]').trigger('keydown', { key: 'Enter' });

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
      { start: new Time(10, 42, 50), end: new Time(10, 42, 50) },
    ]);
  });

  it('leaves a non-inverted same-minute pair untouched', async () => {
    const wrapper = await mountSuspended(TimeField, {
      props: {
        modelValue: { start: new Time(10, 43, 5), end: new Time(10, 43, 5) },
        range: true,
        clampSeconds: true,
        label: 'Start and stop time',
        testid: 'time-field',
      },
      global: { stubs: { UInputTime: InputTimeStub } },
    });

    emitModelValue(wrapper, { start: new Time(10, 43, 5), end: new Time(10, 43, 20) });
    await wrapper.find('[data-testid="time-field"]').trigger('keydown', { key: 'Enter' });

    expect(wrapper.emitted('commit')).toHaveLength(1);
    // No clamp fired: only the live update from the segment edit itself.
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1);
  });

  it('leaves an inverted pair unclamped when clampSeconds is off', async () => {
    const wrapper = await mountSuspended(TimeField, {
      props: {
        modelValue: { start: new Time(10, 42, 50), end: new Time(10, 43, 10) },
        range: true,
        label: 'Start and stop time',
        testid: 'time-field',
      },
      global: { stubs: { UInputTime: InputTimeStub } },
    });

    emitModelValue(wrapper, { start: new Time(10, 43, 50), end: new Time(10, 43, 10) });
    await wrapper.find('[data-testid="time-field"]').trigger('keydown', { key: 'Enter' });

    expect(wrapper.emitted('commit')).toHaveLength(1);
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1);
  });

  it('accepts a range with no end', async () => {
    const wrapper = await mountSuspended(TimeField, {
      props: {
        modelValue: { start: new Time(9, 0), end: undefined },
        range: true,
        label: 'Start and stop time',
        testid: 'time-field',
      },
      global: { stubs: { UInputTime: InputTimeStub } },
    });

    expect(wrapper.findComponent(InputTimeStub).props('modelValue')).toEqual({
      start: new Time(9, 0),
      end: undefined,
    });
  });
});
