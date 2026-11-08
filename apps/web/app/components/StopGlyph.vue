<script setup lang="ts">
/** `md` fills a 20px icon slot (default buttons), `sm` a 16px one (`xs` buttons). */
const { size = 'md' } = defineProps<{ size?: 'sm' | 'md' }>();
</script>

<!--
  The stop control's glyph: a filled, slightly rounded square (Lucide's square is an outline,
  which reads as an unchecked checkbox). It sits on a solid red stop control, so it pulses from
  white to a pale red tint (REQ-469: the icon's colour animates), unless motion is reduced.
-->
<template>
  <span
    class="flex shrink-0 items-center justify-center"
    :class="size === 'sm' ? 'size-4' : 'size-5'"
    aria-hidden="true"
  >
    <span
      data-testid="stop-glyph"
      class="timer-stop-icon block origin-center rounded-[3px] bg-current text-white motion-reduce:animate-none"
      :class="size === 'sm' ? 'size-2.5' : 'size-3'"
    />
  </span>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .timer-stop-icon {
    animation: stop-glyph-pulse 1.4s ease-in-out infinite;
  }
}

@keyframes stop-glyph-pulse {
  0%,
  100% {
    color: white;
    transform: scale(1);
  }
  40% {
    color: color-mix(in oklab, white 72%, var(--ui-color-error-300));
    transform: scale(1.18);
  }
  70% {
    transform: scale(0.94);
  }
}
</style>
