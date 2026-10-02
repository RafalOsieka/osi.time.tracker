<script setup lang="ts">
import {
  DISPLAY_NAME_MAX_LENGTH,
  TIME_ZONES,
  type UpdateProfileDto,
} from '~~/shared/types/profile';

type AppLocale = 'en' | 'pl';

const { t, locale, setLocale } = useI18n();
usePageTitle(() => t('profile.title'));
const toast = useAppToast();
const { user } = useUserSession();
const { profile, save } = useProfile();

const storedDisplayName = computed(() => profile.value?.displayName ?? '');
const storedTimezone = computed(() => profile.value?.timezone ?? 'UTC');

const displayNameDraft = ref(storedDisplayName.value);
const timezone = ref(storedTimezone.value);
const timezones = [...TIME_ZONES];

const localeItems = computed(
  () =>
    [
      { label: t('locale.en'), value: 'en' },
      { label: t('locale.pl'), value: 'pl' },
    ] satisfies Array<{ label: string; value: AppLocale }>,
);

const selectedLocale = computed({
  get: (): AppLocale => (locale.value === 'pl' ? 'pl' : 'en'),
  set: (value: AppLocale) => {
    void setLocale(value);
  },
});

/** Latest-write-wins: only the most recent PATCH may revert its control or toast. */
let patchGeneration = 0;

/** Saves silently; on failure the newest request toasts and runs `revert`. */
async function persist(update: UpdateProfileDto, revert: () => void) {
  const generation = ++patchGeneration;
  try {
    await save(update);
  } catch (err) {
    if (generation !== patchGeneration) return;
    revert();
    toast.error(t(extractCaughtMessageKey(err, 'profile.saveError')));
  }
}

/** Blur/Enter commit (REQ-400): blank or unchanged values revert without a request. */
function commitDisplayName() {
  const next = displayNameDraft.value.trim();
  if (!next || next === storedDisplayName.value) {
    displayNameDraft.value = storedDisplayName.value;
    return;
  }
  displayNameDraft.value = next;
  void persist({ displayName: next }, () => {
    displayNameDraft.value = storedDisplayName.value;
  });
}

function cancelDisplayName() {
  displayNameDraft.value = storedDisplayName.value;
}

function onTimezoneChange(value: string | undefined) {
  if (!value || value === storedTimezone.value) return;
  timezone.value = value;
  void persist({ timezone: value }, () => {
    timezone.value = storedTimezone.value;
  });
}
</script>

<template>
  <div data-testid="page-profile" class="mx-auto max-w-xl space-y-6">
    <h1 class="text-2xl font-semibold">{{ t('profile.title') }}</h1>

    <section class="grid gap-4" aria-labelledby="profile-account-heading">
      <h2 id="profile-account-heading" class="text-lg font-medium">
        {{ t('profile.account') }}
      </h2>

      <UFormField
        :label="t('profile.displayName')"
        name="displayName"
        data-testid="profile-display-name-field"
      >
        <UInput
          id="profile-display-name"
          v-model="displayNameDraft"
          :maxlength="DISPLAY_NAME_MAX_LENGTH"
          autocomplete="name"
          class="w-full"
          data-testid="profile-display-name"
          @blur="commitDisplayName"
          @keydown.enter="commitDisplayName"
          @keydown.esc.prevent="cancelDisplayName"
        />
      </UFormField>

      <UFormField :label="t('profile.email')" name="email" data-testid="profile-email-field">
        <UInput
          id="profile-email"
          :model-value="user?.email ?? ''"
          readonly
          class="w-full"
          data-testid="profile-email"
        />
      </UFormField>

      <UFormField
        :label="t('profile.timezone')"
        name="timezone"
        data-testid="profile-timezone-field"
      >
        <USelectMenu
          id="profile-timezone"
          :model-value="timezone"
          :items="timezones"
          searchable
          class="w-full"
          data-testid="profile-timezone"
          @update:model-value="onTimezoneChange"
        />
      </UFormField>
    </section>

    <section class="grid gap-4" aria-labelledby="profile-preferences-heading">
      <h2 id="profile-preferences-heading" class="text-lg font-medium">
        {{ t('profile.preferences') }}
      </h2>

      <UFormField
        :label="t('profile.language')"
        :hint="t('profile.languageHint')"
        name="language"
        data-testid="profile-language-field"
      >
        <USelect
          id="profile-language"
          v-model="selectedLocale"
          :items="localeItems"
          value-key="value"
          label-key="label"
          class="w-full"
          data-testid="profile-language"
        />
      </UFormField>
    </section>
  </div>
</template>
