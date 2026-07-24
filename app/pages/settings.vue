<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const { settings, detectedTimeZone, save } = useUserSettings();

const state = reactive({
  timezone: settings.value.timezone ?? detectedTimeZone,
  weekStart: settings.value.weekStart as 'monday' | 'sunday',
});
const saving = ref(false);
const saved = ref(false);
const error = ref('');

const timezones = Intl.supportedValuesOf('timeZone');
const weekStartItems = computed(() => [
  { label: t('settings.monday'), value: 'monday' as const },
  { label: t('settings.sunday'), value: 'sunday' as const },
]);

watch(settings, (value) => {
  state.timezone = value.timezone ?? detectedTimeZone;
  state.weekStart = value.weekStart;
});

async function submit() {
  saving.value = true;
  saved.value = false;
  error.value = '';
  try {
    await save({ timezone: state.timezone, weekStart: state.weekStart });
    saved.value = true;
  } catch {
    error.value = t('settings.saveError');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div data-testid="page-settings" class="mx-auto max-w-xl space-y-4">
    <h1 class="text-2xl font-semibold">{{ t('nav.settings') }}</h1>
    <UForm :state="state" class="grid gap-4" @submit="submit">
      <UFormField
        :label="t('settings.timezone')"
        name="timezone"
        data-testid="settings-timezone-field"
      >
        <USelectMenu
          id="settings-timezone"
          v-model="state.timezone"
          :items="timezones"
          searchable
          class="w-full"
          data-testid="settings-timezone"
        />
        <template v-if="!settings.timezone" #hint>
          {{ t('settings.detectedTimezone', { timezone: detectedTimeZone }) }}
        </template>
      </UFormField>

      <UFormField
        :label="t('settings.weekStart')"
        name="weekStart"
        data-testid="settings-week-start-field"
      >
        <URadioGroup
          id="settings-week-start"
          v-model="state.weekStart"
          :items="weekStartItems"
          orientation="horizontal"
          data-testid="settings-week-start"
          value-key="value"
          label-key="label"
        />
      </UFormField>

      <div class="flex items-center gap-3">
        <UButton type="submit" :label="t('settings.save')" :loading="saving" />
        <UAlert
          v-if="saved"
          color="success"
          variant="subtle"
          :title="t('settings.saved')"
          data-testid="settings-saved-message"
        />
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :title="error"
          data-testid="settings-error-message"
        />
      </div>
    </UForm>
  </div>
</template>
