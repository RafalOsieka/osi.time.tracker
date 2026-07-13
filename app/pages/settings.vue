<script setup lang="ts">
import { Form } from '@primevue/forms';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const { settings, detectedTimeZone, save } = useUserSettings();
const timezone = ref(settings.value.timezone ?? detectedTimeZone);
const weekStart = ref(settings.value.weekStart);
const saving = ref(false);
const saved = ref(false);
const error = ref('');
const timezones = Intl.supportedValuesOf('timeZone').map((value) => ({ label: value, value }));

watch(settings, (value) => {
  timezone.value = value.timezone ?? detectedTimeZone;
  weekStart.value = value.weekStart;
});

async function submit() {
  saving.value = true;
  saved.value = false;
  error.value = '';
  try {
    await save({ timezone: timezone.value, weekStart: weekStart.value });
    saved.value = true;
  } catch {
    error.value = t('settings.saveError');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div data-testid="page-settings">
    <h1>{{ t('nav.settings') }}</h1>
    <Form class="settings-form" @submit="submit">
      <FormFieldWrap
        v-slot="{ field }"
        :label="t('settings.timezone')"
        name="timezone"
        input-id="settings-timezone"
        error-testid="settings-timezone-error"
      >
        <Select
          id="settings-timezone"
          v-model="timezone"
          :options="timezones"
          option-label="label"
          option-value="value"
          filter
          class="w-full"
          :aria-invalid="field?.invalid"
          :aria-describedby="field?.invalid ? 'settings-timezone-error' : undefined"
        />
        <small v-if="!settings.timezone">
          {{ t('settings.detectedTimezone', { timezone: detectedTimeZone }) }}
        </small>
      </FormFieldWrap>
      <FormFieldWrap
        v-slot="{ field }"
        :label="t('settings.weekStart')"
        name="weekStart"
        input-id="settings-week-start"
        error-testid="settings-week-start-error"
      >
        <SelectButton
          id="settings-week-start"
          v-model="weekStart"
          :options="['monday', 'sunday']"
          :allow-empty="false"
          :option-label="(value: string) => t(`settings.${value}`)"
          :aria-invalid="field?.invalid"
          :aria-describedby="field?.invalid ? 'settings-week-start-error' : undefined"
        />
      </FormFieldWrap>
      <Button type="submit" :label="t('settings.save')" :loading="saving" />
      <Message v-if="saved" severity="success">{{ t('settings.saved') }}</Message>
      <Message v-if="error" severity="error">{{ error }}</Message>
    </Form>
  </div>
</template>

<style scoped>
.settings-form {
  display: grid;
  gap: 1rem;
}
</style>
