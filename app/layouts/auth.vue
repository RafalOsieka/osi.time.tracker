<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <div class="grid min-h-dvh place-items-center bg-default p-6">
    <section class="grid w-full max-w-md gap-4">
      <h1 class="m-0 flex items-center gap-2 text-highlighted text-2xl font-semibold">
        <AppBrandMark />
        {{ t('layout.title') }}
      </h1>
      <slot />
    </section>
  </div>
</template>
