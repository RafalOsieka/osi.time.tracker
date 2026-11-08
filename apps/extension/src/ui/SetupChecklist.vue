<script setup lang="ts">
import { computed } from 'vue';
import UButton from '@nuxt/ui/components/Button.vue';
import UCard from '@nuxt/ui/components/Card.vue';
import UIcon from '@nuxt/ui/components/Icon.vue';
import ULink from '@nuxt/ui/components/Link.vue';
import { displayUrl } from '../approvals/display.js';
import { useExtensionI18n } from '../composables/use-extension-i18n.js';
import { openWebsite } from './open-website.js';
import type { SetupStep } from './open-setup.js';

/**
 * Onboarding steps shown by the popup and the setup page until a website and a tracker are
 * approved (REQ-411). The current step carries its own action: in the popup it opens the setup
 * page on that step (or, on an unapproved OSI tab, approves that tab's website); on the setup page
 * the step itself moves focus to its form. A done website step names the approved website. The
 * OSI-side setting is an instruction set apart below the steps: the extension cannot observe it.
 */
const {
  websiteDone,
  trackerDone,
  mode,
  website = null,
  offer = null,
} = defineProps<{
  websiteDone: boolean;
  trackerDone: boolean;
  mode: 'popup' | 'setup';
  /** The first approved website, named in the done website step. */
  website?: string | null;
  /** The popup's unapproved OSI tab, offered as the website step's action (REQ-415). */
  offer?: string | null;
}>();

const emit = defineEmits<{ act: [step: SetupStep] }>();

type StepState = 'done' | 'current' | 'todo';

const { t } = useExtensionI18n();

const steps = computed(() => {
  const websiteState: StepState = websiteDone ? 'done' : 'current';
  const tracker: StepState = trackerDone ? 'done' : websiteDone ? 'current' : 'todo';
  return [
    {
      id: 'website',
      labelKey: websiteDone ? 'app.checklistWebsiteDone' : 'app.checklistWebsite',
      actionKey: 'app.checklistWebsiteAction',
      state: websiteState,
    },
    {
      id: 'tracker',
      labelKey: 'app.checklistTracker',
      actionKey: 'app.checklistTrackerAction',
      state: tracker,
    },
  ] as const satisfies readonly {
    id: SetupStep;
    labelKey: string;
    actionKey: string;
    state: StepState;
  }[];
});

const markers = {
  done: 'bg-success/12 text-success dark:bg-success/16',
  current: 'bg-primary text-inverted',
  todo: 'text-muted ring-1 ring-accented ring-inset',
} as const satisfies Record<StepState, string>;

/** The dot before the approved website when it shares the done step's line (setup page). */
const SEPARATOR = "before:me-1 before:content-['·']";

const labelClasses = {
  done: 'text-toned',
  current: 'font-medium text-highlighted',
  todo: 'text-muted',
} as const satisfies Record<StepState, string>;

const stateKeys = {
  done: 'app.checklistDone',
  current: 'app.checklistCurrent',
  todo: 'app.checklistTodo',
} as const satisfies Record<StepState, string>;
</script>

<template>
  <UCard
    as="section"
    aria-labelledby="setup-checklist-title"
    data-testid="setup-checklist"
    :ui="
      mode === 'popup'
        ? { body: 'flex flex-col gap-4' }
        : { header: 'px-4 py-3.5 sm:px-6', body: 'flex flex-col gap-3 sm:py-4' }
    "
  >
    <template v-if="mode === 'setup'" #header>
      <h2 id="setup-checklist-title" class="text-base font-semibold text-highlighted">
        {{ t('app.checklistSetupTitle') }}
      </h2>
    </template>
    <div v-if="mode === 'popup'" class="flex flex-col gap-1">
      <h2 id="setup-checklist-title" class="text-sm font-semibold text-highlighted">
        {{ t('app.checklistTitle') }}
      </h2>
      <p class="text-[13px] text-balance text-muted">{{ t('app.purpose') }}</p>
    </div>

    <ol class="flex flex-col" :class="mode === 'popup' ? 'gap-3' : 'gap-2.5'">
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
          <span class="sr-only">{{ t(stateKeys[step.state]) }}:</span>
          <!-- On the setup page the current step is a link to its form. -->
          <UButton
            v-if="mode === 'setup' && step.state === 'current'"
            variant="link"
            color="primary"
            class="-my-0.5 p-0 text-sm font-medium"
            trailing-icon="i-lucide-arrow-down"
            :label="t(step.labelKey)"
            :data-testid="`checklist-action-${step.id}`"
            @click="emit('act', step.id)"
          />
          <span v-else :class="labelClasses[step.state]">
            {{ t(step.labelKey) }}
            <span
              v-if="step.id === 'website' && step.state === 'done' && website"
              :class="mode === 'popup' ? 'block' : SEPARATOR"
            >
              <ULink
                :to="website"
                class="group inline-flex items-center gap-1 font-medium text-highlighted hover:text-primary"
                data-testid="checklist-website-link"
                @click.prevent="openWebsite(website)"
              >
                <span class="group-hover:underline">{{ displayUrl(website) }}</span>
                <UIcon
                  name="i-lucide-arrow-up-right"
                  class="size-3.5 shrink-0 text-dimmed group-hover:text-primary"
                  aria-hidden="true"
                />
              </ULink>
            </span>
          </span>

          <!-- The popup's step action hands over to the setup page, and says so. -->
          <template v-if="mode === 'popup' && step.state === 'current'">
            <p class="text-[13px] text-muted">
              {{ t(step.id === 'website' ? 'app.checklistOfferHelp' : 'app.checklistActionHelp') }}
            </p>
            <UButton
              v-if="step.id === 'website' && offer"
              size="sm"
              trailing-icon="i-lucide-arrow-up-right"
              data-testid="current-website-offer"
              :label="t('app.checklistOfferAction', { website: displayUrl(offer) })"
              @click="emit('act', 'website')"
            />
            <UButton
              v-else
              size="sm"
              trailing-icon="i-lucide-arrow-up-right"
              :label="t(step.actionKey)"
              :data-testid="`checklist-action-${step.id}`"
              @click="emit('act', step.id)"
            />
          </template>
        </div>
      </li>
    </ol>

    <div
      class="flex items-start gap-3"
      :class="mode === 'popup' ? 'border-t border-default pt-4' : ''"
      data-testid="checklist-direct"
      data-state="info"
    >
      <span
        class="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary-100/80 text-primary dark:bg-primary/16"
        aria-hidden="true"
      >
        <UIcon name="i-lucide-settings-2" class="size-3.5" />
      </span>
      <p class="pt-0.5 text-muted" :class="mode === 'popup' ? 'text-[13px]' : 'text-sm'">
        <span class="font-medium text-toned">{{ t('app.checklistDirectLabel') }}</span>
        {{ t('app.checklistDirect') }}
      </p>
    </div>
  </UCard>
</template>
