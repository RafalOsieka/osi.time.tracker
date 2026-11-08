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

/** 32px square tiles with a 16px glyph; the soft tint itself comes from the app config. */
const TILE_UI = { base: 'size-8 justify-center', leadingIcon: 'size-4' };
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
        :ui="TILE_UI"
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
        :ui="TILE_UI"
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
        :ui="TILE_UI"
        :aria-label="deleteLabel"
        :data-testid="deleteTestid"
        @click="emit('delete')"
      />
    </UTooltip>
  </div>
</template>
