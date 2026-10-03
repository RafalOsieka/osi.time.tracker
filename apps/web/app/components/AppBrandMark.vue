<script setup lang="ts">
const { collapsed = false } = defineProps<{ collapsed?: boolean }>();

const { t } = useI18n();
</script>

<template>
  <!--
    Geometry matches app/assets/icons/app-mark.svg (source: openspec/changes/open-dial-brand-mark
    design.md D1). The mark is stateless by contract: it never signals a running timer.
  -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    class="size-6 shrink-0 text-primary"
    data-testid="app-brand-mark"
    :aria-hidden="collapsed ? undefined : true"
    :aria-label="collapsed ? t('layout.title') : undefined"
    :role="collapsed ? 'img' : undefined"
  >
    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15.6 21.5H12A9.5 9.5 0 1 1 21.5 12" stroke-width="2" />
      <path d="M8.5 9.3H15.5" stroke-width="2.6" />
    </g>
    <path
      d="M10.7 9.3H13.3L12.4 16.9H11.6Z"
      stroke="currentColor"
      stroke-width="0.4"
      stroke-linejoin="round"
    />
  </svg>
</template>
