<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { resolveEffectiveMode, type ColorModePreference } from '~/utils/color-mode';

const COOKIE_KEY = 'color_mode';

const colorMode = useCookie<ColorModePreference>(COOKIE_KEY, {
  default: () => 'system',
});

const systemPrefersDark = useRequestHeader('sec-ch-prefers-color-scheme') === 'dark';
const initialEffectiveMode = resolveEffectiveMode(colorMode.value ?? 'system', systemPrefersDark);

const { locale } = useI18n();
useHead({
  htmlAttrs: {
    lang: locale,
    class: initialEffectiveMode === 'dark' ? 'dark' : undefined,
  },
  link: [{ rel: 'stylesheet', href: 'https://rsms.me/inter/inter.css' }],
});
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
