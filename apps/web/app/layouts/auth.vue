<script setup lang="ts">
const { t } = useI18n();
</script>

<template>
  <div class="grid min-h-dvh place-items-center bg-(--app-surface-sidebar) p-6 dark:bg-default">
    <section class="grid w-full max-w-sm gap-8">
      <div class="grid justify-items-center gap-1.5 text-center">
        <h1
          class="m-0 grid justify-items-center gap-3 text-xl font-semibold tracking-tight text-highlighted"
        >
          <AppBrandMark size="size-10" />
          <span>{{ t('layout.title') }}</span>
        </h1>
        <p class="m-0 text-sm text-muted">{{ t('auth.subtitle') }}</p>
      </div>
      <slot />
    </section>
  </div>
</template>
