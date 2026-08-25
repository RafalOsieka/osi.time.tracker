<script setup lang="ts">
import * as locales from '@nuxt/ui/locale';

const { locale } = useI18n();
const { running } = useTimer();

const uiLocale = computed(() => locales[locale.value] ?? locales.en);

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
