<script setup lang="ts">
import { computed } from 'vue';
import UIcon from '@nuxt/ui/components/Icon.vue';
import { useExtensionI18n } from '../composables/use-extension-i18n.js';

/**
 * Onboarding steps shown by the popup and the setup page until a website and a tracker are
 * approved. The OSI-side step is informational: the extension cannot observe that setting.
 */
const { websiteDone, trackerDone } = defineProps<{
  websiteDone: boolean;
  trackerDone: boolean;
}>();

type StepState = 'done' | 'current' | 'todo' | 'info';

const { t } = useExtensionI18n();

const steps = computed(() => {
  const trackerState: StepState = trackerDone ? 'done' : websiteDone ? 'current' : 'todo';
  return [
    { id: 'website', labelKey: 'app.checklistWebsite', state: websiteDone ? 'done' : 'current' },
    { id: 'tracker', labelKey: 'app.checklistTracker', state: trackerState },
    { id: 'direct', labelKey: 'app.checklistDirect', state: 'info' },
  ] as const satisfies readonly { id: string; labelKey: string; state: StepState }[];
});

const icons = {
  done: 'i-lucide-circle-check',
  current: 'i-lucide-circle-dot',
  todo: 'i-lucide-circle',
  info: 'i-lucide-info',
} as const satisfies Record<StepState, string>;

const iconClasses = {
  done: 'text-success',
  current: 'text-primary',
  todo: 'text-dimmed',
  info: 'text-muted',
} as const satisfies Record<StepState, string>;

const stateKeys = {
  done: 'app.checklistDone',
  current: 'app.checklistCurrent',
  todo: 'app.checklistTodo',
  info: 'app.checklistInfo',
} as const satisfies Record<StepState, string>;
</script>

<template>
  <section
    class="flex flex-col gap-2 rounded-md p-3 ring ring-default ring-inset"
    aria-labelledby="setup-checklist-title"
    data-testid="setup-checklist"
  >
    <h2 id="setup-checklist-title" class="text-sm font-semibold text-highlighted">
      {{ t('app.checklistTitle') }}
    </h2>
    <ol class="flex flex-col gap-1.5">
      <li
        v-for="(step, index) in steps"
        :key="step.id"
        class="flex items-start gap-2"
        :data-testid="`checklist-${step.id}`"
        :data-state="step.state"
        :aria-current="step.state === 'current' ? 'step' : undefined"
      >
        <UIcon
          :name="icons[step.state]"
          class="mt-0.5 size-4 shrink-0"
          :class="iconClasses[step.state]"
          aria-hidden="true"
        />
        <span :class="step.state === 'current' ? 'text-highlighted' : 'text-muted'">
          <span class="sr-only">{{ t(stateKeys[step.state]) }}:</span>
          {{ index + 1 }}. {{ t(step.labelKey) }}
        </span>
      </li>
    </ol>
  </section>
</template>
