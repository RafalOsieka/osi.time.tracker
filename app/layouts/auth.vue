<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <div style="max-width: 24rem; margin: 4rem auto; display: grid; gap: 1rem">
    <h1>{{ t('layout.title') }}</h1>
    <slot />
  </div>
</template>
