<script setup lang="ts">
const { collapsed = false } = defineProps<{ collapsed?: boolean }>();

const { t } = useI18n();
</script>

<template>
  <!--
    Geometry matches app/assets/icons/app-mark.svg (source: openspec/changes/replace-brand-mark
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
    <g fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
      <path d="M16.89 3.86A9.5 9.5 0 0 0 7.11 3.86" />
      <path d="M16.89 3.86A9.5 9.5 0 0 0 7.11 3.86" transform="rotate(90 12 12)" />
      <path d="M16.89 3.86A9.5 9.5 0 0 0 7.11 3.86" transform="rotate(180 12 12)" />
      <path d="M16.89 3.86A9.5 9.5 0 0 0 7.11 3.86" transform="rotate(270 12 12)" />
    </g>
    <rect x="7.1" y="7.1" width="2.5" height="2.5" rx="0.8" />
    <rect x="10.75" y="7.1" width="2.5" height="2.5" rx="0.8" />
    <rect x="14.4" y="7.1" width="2.5" height="2.5" rx="0.8" />
    <rect x="10.75" y="10.75" width="2.5" height="2.5" rx="0.8" />
    <rect x="10.75" y="14.4" width="2.5" height="2.5" rx="0.8" />
    <circle cx="8.35" cy="12" r="0.2" />
    <circle cx="15.65" cy="12" r="0.2" />
    <circle cx="8.35" cy="15.65" r="0.2" />
    <circle cx="15.65" cy="15.65" r="0.2" />
    <circle cx="12" cy="4.7" r="0.2" />
    <circle cx="12" cy="19.3" r="0.2" />
    <circle cx="4.7" cy="12" r="0.2" />
    <circle cx="19.3" cy="12" r="0.2" />
  </svg>
</template>
