import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import type { ProfileDto, UpdateProfileDto } from '../../shared/types/profile';
import ProfilePage from '../../app/pages/profile.vue';

const harness = vi.hoisted(() => ({
  saveMock: vi.fn<(update: UpdateProfileDto) => Promise<ProfileDto>>(),
  toastAdd: vi.fn(),
  profile: { value: { displayName: 'Jan', timezone: 'UTC' } },
}));

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt i18n is not injectable in this nuxt test
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  const { ref } = await import('vue');
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key, locale: ref('en'), setLocale: vi.fn() }),
  };
});

// oxlint-disable-next-line anti-slop/no-module-mocking -- the profile composable wraps the session and $csrfFetch
vi.mock('../../app/composables/use-profile', async () => {
  const { ref } = await import('vue');
  harness.profile = ref({ displayName: 'Jan', timezone: 'UTC' });
  return { useProfile: () => ({ profile: harness.profile, save: harness.saveMock }) };
});

mockNuxtImport('useUserSession', () => () => ({
  user: ref({ email: 'jan@example.com' }),
}));

mockNuxtImport('useToast', () => () => ({ add: harness.toastAdd }));

const FormFieldStub = {
  props: ['label', 'hint'],
  template: '<div><span>{{ label }}</span><slot /><span v-if="hint">{{ hint }}</span></div>',
};
const InputStub = {
  inheritAttrs: false,
  props: ['modelValue', 'readonly'],
  emits: ['update:modelValue', 'blur', 'keydown'],
  template: `<input :data-testid="$attrs['data-testid']" :value="modelValue" :readonly="readonly"
    @input="$emit('update:modelValue', $event.target.value)" @blur="$emit('blur', $event)"
    @keydown="$emit('keydown', $event)" />`,
};
const SelectStub = { props: ['modelValue', 'items'], template: '<div />' };
const SelectMenuStub = {
  inheritAttrs: false,
  props: ['modelValue', 'items'],
  emits: ['update:modelValue'],
  template: `<button type="button" data-testid="profile-timezone-trigger"
    @click="$emit('update:modelValue', 'Europe/Warsaw')">{{ modelValue }}|{{ items[0] }}</button>`,
};

async function mountProfile() {
  const wrapper = await mountSuspended(ProfilePage, {
    global: {
      stubs: {
        UFormField: FormFieldStub,
        UInput: InputStub,
        USelect: SelectStub,
        USelectMenu: SelectMenuStub,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

/** Resolves a save by applying it to the mocked session profile. */
function saveSucceeds() {
  harness.saveMock.mockImplementation(async (update) => {
    harness.profile.value = { ...harness.profile.value, ...update };
    return harness.profile.value;
  });
}

describe('profile page', () => {
  beforeEach(() => {
    harness.saveMock.mockReset();
    harness.toastAdd.mockReset();
    harness.profile.value = { displayName: 'Jan', timezone: 'UTC' };
  });

  it('shows the stored profile with a read-only email, UTC first, and no theme or Save control', async () => {
    const wrapper = await mountProfile();

    expect(
      wrapper.get<HTMLInputElement>('[data-testid="profile-display-name"]').element.value,
    ).toBe('Jan');
    const email = wrapper.get<HTMLInputElement>('[data-testid="profile-email"]');
    expect(email.element.value).toBe('jan@example.com');
    expect(email.element.readOnly).toBe(true);
    expect(wrapper.get('[data-testid="profile-timezone-trigger"]').text()).toBe('UTC|UTC');
    expect(wrapper.text()).toContain('profile.languageHint');
    expect(wrapper.text()).not.toMatch(/detected|theme|save/i);
  });

  it.each(['blur', 'keydown.enter'] as const)(
    'saves a trimmed display name on %s',
    async (event) => {
      saveSucceeds();
      const wrapper = await mountProfile();
      const input = wrapper.get<HTMLInputElement>('[data-testid="profile-display-name"]');

      await input.setValue('  Jan Kowalski  ');
      await input.trigger(event);
      await flushPromises();

      expect(harness.saveMock).toHaveBeenCalledExactlyOnceWith({ displayName: 'Jan Kowalski' });
      expect(input.element.value).toBe('Jan Kowalski');
      expect(harness.toastAdd).not.toHaveBeenCalled();
    },
  );

  it.each([
    { name: 'unchanged', value: ' Jan ', event: 'blur' },
    { name: 'blank', value: '   ', event: 'blur' },
    { name: 'escaped', value: 'Someone Else', event: 'keydown.esc' },
  ] as const)('sends nothing and restores the stored name when $name', async ({ value, event }) => {
    const wrapper = await mountProfile();
    const input = wrapper.get<HTMLInputElement>('[data-testid="profile-display-name"]');

    await input.setValue(value);
    await input.trigger(event);
    await flushPromises();

    expect(harness.saveMock).not.toHaveBeenCalled();
    expect(input.element.value).toBe('Jan');
  });

  it('toasts and reverts the display name when the save fails', async () => {
    harness.saveMock.mockRejectedValue(new Error('network'));
    const wrapper = await mountProfile();
    const input = wrapper.get<HTMLInputElement>('[data-testid="profile-display-name"]');

    await input.setValue('Jan Kowalski');
    await input.trigger('blur');
    await flushPromises();

    expect(harness.toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'profile.saveError', color: 'error' }),
    );
    expect(input.element.value).toBe('Jan');
  });

  it('persists a timezone change immediately', async () => {
    saveSucceeds();
    const wrapper = await mountProfile();

    await wrapper.get('[data-testid="profile-timezone-trigger"]').trigger('click');
    await flushPromises();

    expect(harness.saveMock).toHaveBeenCalledWith({ timezone: 'Europe/Warsaw' });
    expect(wrapper.get('[data-testid="profile-timezone-trigger"]').text()).toContain(
      'Europe/Warsaw',
    );
  });

  it('toasts and reverts the timezone when the save fails', async () => {
    harness.saveMock.mockRejectedValue(new Error('network'));
    const wrapper = await mountProfile();

    await wrapper.get('[data-testid="profile-timezone-trigger"]').trigger('click');
    await flushPromises();

    expect(harness.toastAdd).toHaveBeenCalledOnce();
    expect(wrapper.get('[data-testid="profile-timezone-trigger"]').text()).toBe('UTC|UTC');
  });

  it('keeps only the latest of two overlapping saves', async () => {
    let rejectFirst!: (reason: Error) => void;
    harness.saveMock
      .mockImplementationOnce(() => new Promise((_resolve, reject) => (rejectFirst = reject)))
      .mockImplementationOnce(async (update) => {
        harness.profile.value = { ...harness.profile.value, ...update };
        return harness.profile.value;
      });
    const wrapper = await mountProfile();
    const input = wrapper.get<HTMLInputElement>('[data-testid="profile-display-name"]');

    await input.setValue('First');
    await input.trigger('blur');
    await input.setValue('Second');
    await input.trigger('blur');
    rejectFirst(new Error('late failure'));
    await flushPromises();

    expect(harness.toastAdd).not.toHaveBeenCalled();
    expect(input.element.value).toBe('Second');
  });
});
