<script setup lang="ts">
/**
 * Two-tier compact row used by timer group headers and Remote Sync day rows.
 * Call sites own labels, test ids, and domain content via slots.
 */
const {
  expanded = false,
  expandLabel,
  collapseLabel,
  expandTestid,
  detailsId,
  headerTestid = undefined,
} = defineProps<{
  expanded?: boolean;
  expandLabel: string;
  collapseLabel: string;
  expandTestid: string;
  detailsId: string;
  headerTestid?: string;
}>();

const emit = defineEmits<{ toggle: [] }>();

const expandText = computed(() => (expanded ? collapseLabel : expandLabel));
</script>

<template>
  <div class="border-b border-default py-1">
    <div
      class="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1 [grid-template-areas:'toggle_title_duration_action'_'._secondary_meta_meta'] lg:flex lg:flex-nowrap lg:gap-3"
      :data-testid="headerTestid"
      data-compact-row="true"
    >
      <div class="[grid-area:toggle] shrink-0">
        <UTooltip :text="expandText" :content="{ side: 'top' }">
          <UButton
            :icon="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
            variant="ghost"
            square
            size="xs"
            :aria-expanded="expanded"
            :aria-controls="detailsId"
            :aria-label="expandText"
            :data-testid="expandTestid"
            @click="emit('toggle')"
          />
        </UTooltip>
      </div>

      <div class="flex min-w-0 items-center gap-2 [grid-area:title] lg:min-w-0 lg:flex-1">
        <slot name="title" />
      </div>

      <div class="min-w-0 max-w-full shrink-0 justify-self-start [grid-area:secondary]">
        <slot name="secondary" />
      </div>

      <div class="flex min-w-0 items-center gap-2 [grid-area:meta] lg:contents">
        <slot name="meta" />
      </div>

      <div class="min-w-[4.5rem] shrink-0 whitespace-nowrap [grid-area:duration]">
        <slot name="duration" />
      </div>

      <div
        class="flex h-6 w-6 shrink-0 items-center justify-end [grid-area:action]"
        data-testid="compact-row-action"
      >
        <slot name="action" />
      </div>
    </div>

    <div
      v-if="expanded"
      :id="detailsId"
      class="grid gap-0.5 py-1 pr-0 pl-7"
      data-testid="compact-row-detail"
    >
      <slot name="detail" />
    </div>
  </div>
</template>
