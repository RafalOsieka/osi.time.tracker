<script setup lang="ts">
/**
 * The one empty-state pattern: a card with a cyan icon chip, a title, one line of help and a
 * single primary action. Used when a page has nothing to list yet (never-tracked Timer view,
 * no Projects, no Trackers), in place of an empty table.
 */
const {
  icon,
  title,
  message,
  ctaLabel,
  ctaIcon = 'i-lucide-plus',
  testid,
} = defineProps<{
  icon: string;
  title: string;
  message: string;
  ctaLabel: string;
  ctaIcon?: string;
  testid: string;
}>();

const emit = defineEmits<{ create: [] }>();
</script>

<template>
  <UCard :data-testid="testid" :ui="{ body: 'sm:p-12 p-8' }">
    <div class="mx-auto flex max-w-sm flex-col items-center text-center">
      <span
        class="mb-4 flex size-12 items-center justify-center rounded-lg bg-primary-100/80 text-primary dark:bg-primary/12"
        aria-hidden="true"
      >
        <UIcon :name="icon" class="size-6" />
      </span>
      <h2 class="m-0 text-base font-semibold text-highlighted">{{ title }}</h2>
      <!-- A line break in the message keeps each sentence on its own line. -->
      <p class="mt-1.5 mb-5 text-sm text-balance whitespace-pre-line text-muted">{{ message }}</p>
      <UButton
        :label="ctaLabel"
        :icon="ctaIcon"
        data-testid="empty-state-cta"
        @click="emit('create')"
      />
    </div>
  </UCard>
</template>
