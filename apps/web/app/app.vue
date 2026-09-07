<script setup lang="ts">
import * as locales from '@nuxt/ui/locale';

const { t, locale } = useI18n();
const { running } = useTimer();

const uiLocale = computed(() => locales[locale.value] ?? locales.en);

// Computed so Unhead serializes after default.vue seeds running on SSR.
const faviconLinks = computed(() => faviconHeadLinks(running.value != null));

function documentTitle(pageTitle?: string) {
  const brand = t('layout.title');
  const page = pageTitle?.trim();
  return page ? `${page} | ${brand}` : brand;
}

useHead({
  htmlAttrs: {
    lang: locale,
    dir: computed(() => uiLocale.value.dir),
  },
  link: faviconLinks,
  titleTemplate: documentTitle,
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
