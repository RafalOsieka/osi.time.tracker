<script setup lang="ts">
import * as locales from '@nuxt/ui/locale';
import { useI18n } from 'vue-i18n';

const { locale } = useI18n();

const uiLocale = computed(() => {
  const code = locale.value as keyof typeof locales;
  return locales[code] ?? locales.en;
});

useHead({
  htmlAttrs: {
    lang: locale,
    dir: computed(() => uiLocale.value.dir),
  },
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
  ],
});
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
