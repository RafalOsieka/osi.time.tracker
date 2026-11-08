<script setup lang="ts">
import { computed } from 'vue';
import UButton from '@nuxt/ui/components/Button.vue';
import UCard from '@nuxt/ui/components/Card.vue';
import UIcon from '@nuxt/ui/components/Icon.vue';
import { useExtensionI18n } from '../composables/use-extension-i18n.js';
import type { SetupStep } from './open-setup.js';

/**
 * Onboarding steps shown by the popup and the setup page until a website and a tracker are
 * approved (REQ-411). The current step carries its own action: the popup opens the setup page on
 * that step's form, the setup page moves focus to it. The OSI-side step is an instruction, set
 * apart below the steps: the extension cannot observe that setting.
 */
const {
  websiteDone,
  trackerDone,
  mode,
  websiteActionHidden = false,
} = defineProps<{
  websiteDone: boolean;
  trackerDone: boolean;
  mode: 'popup' | 'setup';
  /** The popup's website offer already is the website step's action. */
  websiteActionHidden?: boolean;
}>();

const emit = defineEmits<{ act: [step: SetupStep] }>();

type StepState = 'done' | 'current' | 'todo';

const { t } = useExtensionI18n();

const steps = computed(() => {
  const website: StepState = websiteDone ? 'done' : 'current';
  const tracker: StepState = trackerDone ? 'done' : websiteDone ? 'current' : 'todo';
  return [
    { id: 'website', labelKey: 'app.checklistWebsite', state: website },
    { id: 'tracker', labelKey: 'app.checklistTracker', state: tracker },
  ] as const satisfies readonly { id: SetupStep; labelKey: string; state: StepState }[];
});

const markers = {
  done: 'bg-success/12 text-success dark:bg-success/16',
  current: 'bg-primary text-inverted',
  todo: 'text-muted ring-1 ring-accented ring-inset',
} as const satisfies Record<StepState, string>;

const stateKeys = {
  done: 'app.checklistDone',
  current: 'app.checklistCurrent',
  todo: 'app.checklistTodo',
} as const satisfies Record<StepState, string>;

const actions = {
  popup: {
    website: 'app.checklistWebsiteAction',
    tracker: 'app.checklistTrackerAction',
    icon: 'i-lucide-arrow-up-right',
  },
  setup: {
    website: 'app.checklistWebsiteField',
    tracker: 'app.checklistTrackerField',
    icon: 'i-lucide-arrow-down',
  },
} as const;

function showsAction(id: SetupStep, state: StepState): boolean {
  return state === 'current' && !(id === 'website' && websiteActionHidden);
}
</script>

<template>
  <UCard
    as="section"
    aria-labelledby="setup-checklist-title"
    data-testid="setup-checklist"
    :ui="{ body: 'flex flex-col gap-4' }"
  >
    <div class="flex flex-col gap-1">
      <h2
        id="setup-checklist-title"
        class="font-semibold text-highlighted"
        :class="mode === 'popup' ? 'text-sm' : 'text-base'"
      >
        {{ t(mode === 'popup' ? 'app.checklistTitle' : 'app.checklistSetupTitle') }}
      </h2>
      <p v-if="mode === 'popup'" class="text-[13px] text-muted">{{ t('app.purpose') }}</p>
    </div>

    <ol class="flex flex-col gap-3">
      <li
        v-for="(step, index) in steps"
        :key="step.id"
        class="flex items-start gap-3"
        :data-testid="`checklist-${step.id}`"
        :data-state="step.state"
        :aria-current="step.state === 'current' ? 'step' : undefined"
      >
        <span
          class="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums"
          :class="markers[step.state]"
          aria-hidden="true"
        >
          <UIcon v-if="step.state === 'done'" name="i-lucide-check" class="size-3.5" />
          <template v-else>{{ index + 1 }}</template>
        </span>
        <div class="flex min-w-0 flex-col items-start gap-2 pt-0.5">
          <span
            :class="step.state === 'current' ? 'font-medium text-highlighted' : 'text-muted'"
            data-testid="checklist-step-label"
          >
            <span class="sr-only">{{ t(stateKeys[step.state]) }}:</span>
            {{ t(step.labelKey) }}
          </span>
          <UButton
            v-if="showsAction(step.id, step.state)"
            size="sm"
            :color="mode === 'popup' ? 'primary' : 'neutral'"
            :variant="mode === 'popup' ? 'solid' : 'outline'"
            :trailing-icon="actions[mode].icon"
            :label="t(actions[mode][step.id])"
            :data-testid="`checklist-action-${step.id}`"
            @click="emit('act', step.id)"
          />
        </div>
      </li>
    </ol>

    <div
      class="flex items-start gap-3 border-t border-default pt-4"
      data-testid="checklist-direct"
      data-state="info"
    >
      <span
        class="flex size-6 shrink-0 items-center justify-center rounded-md bg-elevated text-muted"
        aria-hidden="true"
      >
        <UIcon name="i-lucide-settings-2" class="size-3.5" />
      </span>
      <p class="pt-0.5 text-[13px] text-muted">
        <span class="font-medium text-toned">{{ t('app.checklistDirectLabel') }}</span>
        {{ t('app.checklistDirect') }}
      </p>
    </div>
  </UCard>
</template>
