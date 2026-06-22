<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { locale } = useI18n();
useHead({ htmlAttrs: { lang: locale } });
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
