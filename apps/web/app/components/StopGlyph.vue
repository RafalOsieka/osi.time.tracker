<script setup lang="ts">
/** `md` fills a 20px icon slot (default buttons), `sm` a 16px one (`xs` buttons). */
const { size = 'md' } = defineProps<{ size?: 'sm' | 'md' }>();
</script>

<!--
  The stop control's glyph: a filled, slightly rounded square (Lucide's square is an outline,
  which reads as an unchecked checkbox). Pulses like the running icons, unless motion is reduced.
-->
<template>
  <span
    class="flex shrink-0 items-center justify-center"
    :class="size === 'sm' ? 'size-4' : 'size-5'"
    aria-hidden="true"
  >
    <span
      data-testid="stop-glyph"
      class="block origin-center rounded-[3px] bg-current motion-safe:animate-timer-stop-icon motion-reduce:animate-none"
      :class="size === 'sm' ? 'size-2.5' : 'size-3'"
    />
  </span>
</template>
