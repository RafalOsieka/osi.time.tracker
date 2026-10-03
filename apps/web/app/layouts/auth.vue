<script setup lang="ts">
const { t } = useI18n();
</script>

<template>
  <div class="grid min-h-dvh place-items-center bg-default p-6">
    <section class="grid w-full max-w-md gap-4">
      <h1 class="m-0 flex items-center gap-2 text-highlighted text-2xl font-semibold">
        <AppBrandMark />
        <!-- Trim the line box to the cap height so the mark centres on the letters, not the leading. -->
        <span class="[text-box:trim-both_cap_alphabetic]">{{ t('layout.title') }}</span>
      </h1>
      <slot />
    </section>
  </div>
</template>
