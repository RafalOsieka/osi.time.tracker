<script setup lang="ts">
import * as locales from '@nuxt/ui/locale';
import { useI18n } from 'vue-i18n';
import { faviconHeadLinks } from '~/utils/favicon';

const { locale } = useI18n();
const { running } = useTimer();

const uiLocale = computed(() => {
  const code = locale.value as keyof typeof locales;
  return locales[code] ?? locales.en;
});

// Computed so Unhead serializes after default.vue seeds running on SSR.
const faviconLinks = computed(() => faviconHeadLinks(running.value != null));

useHead({
  htmlAttrs: {
    lang: locale,
    dir: computed(() => uiLocale.value.dir),
  },
  link: faviconLinks,
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
