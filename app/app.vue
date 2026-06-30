<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { resolveEffectiveMode } from '~/utils/color-mode';

const { preference } = useColorMode();
const systemPrefersDark = useRequestHeader('sec-ch-prefers-color-scheme') === 'dark';
const initialEffectiveMode = resolveEffectiveMode(preference.value ?? 'system', systemPrefersDark);

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
