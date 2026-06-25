<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>

<template>
  <div data-testid="placeholder-page-tasks">
    <h1>{{ t('nav.tasks') }}</h1>
    <p>{{ t('page.comingSoon') }}</p>
  </div>
</template>
