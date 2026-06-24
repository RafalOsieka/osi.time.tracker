<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const { preference, setPreference } = useColorMode();

const options = [
  { value: 'light', label: t('theme.light') },
  { value: 'dark', label: t('theme.dark') },
  { value: 'system', label: t('theme.system') },
];

const selectedMode = computed({
  get: () => preference.value,
  set: (value) => {
    setPreference(value);
  },
});
</script>

<template>
  <SelectButton
    id="theme-toggle"
    v-model="selectedMode"
    data-testid="theme-toggle-group"
    :options="options"
    option-label="label"
    option-value="value"
    :allow-empty="false"
    :aria-label="t('theme.toggleLabel')"
  />
</template>
