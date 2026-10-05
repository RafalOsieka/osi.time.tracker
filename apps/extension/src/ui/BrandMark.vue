<script setup lang="ts">
const { size = 28 } = defineProps<{ size?: number }>();
</script>

<template>
  <!--
    Copy of apps/web/app/assets/icons/app-mark.svg (the canonical glyph), drawn in currentColor so
    it follows the theme's primary shade. Listed there as a derived asset: update it when the
    glyph changes.
  -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    class="shrink-0 text-primary"
    :width="size"
    :height="size"
    role="img"
    aria-label="OSI Time Tracker"
    data-testid="brand-mark"
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
