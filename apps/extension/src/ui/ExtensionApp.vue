<script setup lang="ts">
import { computed } from 'vue';
import UApp from '@nuxt/ui/components/App.vue';
import { en, pl } from '@nuxt/ui/locale';
import { useExtensionI18n } from '../composables/use-extension-i18n.js';
import { useExtensionTheme } from '../composables/use-extension-theme.js';

// Root of every extension page: Nuxt UI's app shell in the extension's language and theme.
const { locale } = useExtensionI18n();
useExtensionTheme();
const uiLocale = computed(() => (locale.value === 'pl' ? pl : en));
</script>

<template>
  <UApp :locale="uiLocale">
    <slot />
  </UApp>
</template>
