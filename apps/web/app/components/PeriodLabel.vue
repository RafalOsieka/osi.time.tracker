<!--
  The current period between a PeriodStepper's arrows, when it is plain text. It matches the day
  stepper's calendar button on Remote sync (same width, icon and type), so every stepper's middle
  segment reads alike.
-->
<template>
  <span
    class="inline-flex h-8 min-w-44 items-center justify-center gap-1.5 px-2.5 text-sm font-medium text-highlighted tabular-nums ring ring-inset ring-accented"
  >
    <UIcon name="i-lucide-calendar" class="size-5 shrink-0 text-default" aria-hidden="true" />
    <slot />
  </span>
</template>
