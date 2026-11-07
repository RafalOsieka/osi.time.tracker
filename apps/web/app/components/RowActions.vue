<script setup lang="ts">
defineProps<{
  editLabel: string;
  deleteLabel: string;
  editTestid: string;
  deleteTestid: string;
  /** Optional extra row action (e.g. import), rendered before edit. Omit the icon to skip it. */
  extraIcon?: string;
  extraLabel?: string;
  extraTestid?: string;
  extraDisabled?: boolean;
}>();

const emit = defineEmits<{ edit: []; delete: []; extra: [] }>();

/**
 * Cyan tiles sit on the cyan-100 wash in light mode (the selected navigation item's tint), so they
 * read as clearly cyan beside the soft red delete tile; dark mode keeps the soft primary tint.
 */
const CYAN_TILE =
  'size-8 justify-center bg-primary-100 hover:bg-primary-200/70 dark:bg-primary/10 dark:hover:bg-primary/15';
</script>

<template>
  <div class="flex shrink-0 justify-end gap-1.5">
    <UTooltip v-if="extraIcon" :text="extraLabel" :content="{ side: 'top' }">
      <UButton
        :icon="extraIcon"
        color="primary"
        variant="soft"
        size="md"
        square
        :class="CYAN_TILE"
        :ui="{ leadingIcon: 'size-4' }"
        :disabled="extraDisabled"
        :aria-label="extraLabel"
        :data-testid="extraTestid"
        @click="emit('extra')"
      />
    </UTooltip>
    <UTooltip :text="editLabel" :content="{ side: 'top' }">
      <UButton
        icon="i-lucide-pencil"
        color="primary"
        variant="soft"
        size="md"
        square
        :class="CYAN_TILE"
        :ui="{ leadingIcon: 'size-4' }"
        :aria-label="editLabel"
        :data-testid="editTestid"
        @click="emit('edit')"
      />
    </UTooltip>
    <UTooltip :text="deleteLabel" :content="{ side: 'top' }">
      <UButton
        icon="i-lucide-trash-2"
        color="error"
        variant="soft"
        size="md"
        square
        class="size-8 justify-center"
        :ui="{ leadingIcon: 'size-4' }"
        :aria-label="deleteLabel"
        :data-testid="deleteTestid"
        @click="emit('delete')"
      />
    </UTooltip>
  </div>
</template>
