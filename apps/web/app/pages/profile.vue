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

/**
 * Each option is its IANA id with today's UTC offset, e.g. "Europe/Warsaw (UTC+01:00)", so the
 * list says what a zone means without a lookup; filtering still matches the id (REQ-494).
 */
const now = new Date().toISOString();
const timezones = TIME_ZONES.map((zone) => ({ value: zone, label: timeZoneLabel(zone, now) }));

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

/** Blur/Enter commit (REQ-445): blank or unchanged values revert without a request. */
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
  <!-- The shared header (a bare title) and the same 24px gap to the content as every page. Each
       section is a row across the content width: its title and a one-line description on the
       left, its fields in a card on the right (stacked on narrow screens). The one autosave note
       is the display name's help, the only field that saves on leave. -->
  <div data-testid="page-profile" class="grid gap-6">
    <PageHeader :title="t('profile.title')" />

    <div class="grid gap-8">
      <section
        class="grid gap-x-10 gap-y-4 lg:grid-cols-[16rem_minmax(0,1fr)]"
        aria-labelledby="profile-account-heading"
      >
        <div class="grid content-start gap-1">
          <h2 id="profile-account-heading" class="m-0 text-base font-semibold text-highlighted">
            {{ t('profile.account') }}
          </h2>
          <p class="m-0 text-sm text-muted">{{ t('profile.accountDescription') }}</p>
        </div>
        <UCard :ui="{ body: 'grid gap-5 p-6 sm:p-6' }">
          <UFormField
            :label="t('profile.displayName')"
            :help="t('profile.displayNameHelp')"
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
              variant="soft"
              trailing-icon="i-lucide-lock"
              class="w-full"
              :ui="{ base: 'text-muted cursor-default', trailingIcon: 'size-4 text-dimmed' }"
              data-testid="profile-email"
            />
          </UFormField>
        </UCard>
      </section>

      <USeparator />

      <section
        class="grid gap-x-10 gap-y-4 lg:grid-cols-[16rem_minmax(0,1fr)]"
        aria-labelledby="profile-preferences-heading"
      >
        <div class="grid content-start gap-1">
          <h2 id="profile-preferences-heading" class="m-0 text-base font-semibold text-highlighted">
            {{ t('profile.preferences') }}
          </h2>
          <p class="m-0 text-sm text-muted">{{ t('profile.preferencesDescription') }}</p>
        </div>
        <UCard :ui="{ body: 'grid gap-5 p-6 sm:p-6' }">
          <UFormField
            :label="t('profile.timezone')"
            :help="t('profile.timezoneHelp')"
            name="timezone"
            data-testid="profile-timezone-field"
          >
            <USelectMenu
              id="profile-timezone"
              :model-value="timezone"
              :items="timezones"
              value-key="value"
              label-key="label"
              searchable
              class="w-full"
              data-testid="profile-timezone"
              @update:model-value="onTimezoneChange"
            />
          </UFormField>

          <UFormField
            :label="t('profile.language')"
            :help="t('profile.languageHint')"
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
        </UCard>
      </section>
    </div>
  </div>
</template>
