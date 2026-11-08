<script setup lang="ts">
import {
  REMOTE_ISSUE_SEARCH_MODE_ORDER,
  type RemoteIssueScope,
  type RemoteIssueSearchMode,
  type RemoteIssueSearchResult,
} from '@osi/time-tracker-remote-trackers/contracts';
import type { RemoteIssueRefDto } from '../../shared/types/remote-issue-ref';
import type { TrackerDto } from '../../shared/types/tracker';

defineOptions({ inheritAttrs: false });

const {
  config,
  currentRef = undefined,
  scope = null,
  linkTestid = undefined,
  cachedTestid = undefined,
  unlinkedTestid = undefined,
  linkLabel = undefined,
  contextLabel = undefined,
  dayLabel = undefined,
} = defineProps<{
  config: TrackerDto;
  currentRef?: RemoteIssueRefDto;
  /** The owning project's remote project scope (REQ-328), if any. */
  scope?: (RemoteIssueScope & { remoteProjectTitle: string }) | null;
  linkTestid?: string;
  cachedTestid?: string;
  unlinkedTestid?: string;
  /** Shows the unlinked trigger as a labelled button (Remote Sync) instead of an icon. */
  linkLabel?: string;
  /** What is being linked (the Task title), shown under the popover's heading. */
  contextLabel?: string;
  /**
   * The day whose entries a link moves (REQ-461), e.g. "7 listopada 2026", named with the
   * Tracker in the popover's context line.
   */
  dayLabel?: string;
}>();

const emit = defineEmits<{
  link: [
    {
      remoteIssueId: string;
      cachedTitle: string;
      cachedRemoteProjectTitle?: string;
    },
  ];
  unlink: [];
}>();

const { t } = useI18n();
const { search, results, outOfScopeId, loading, errorKey } = useRemoteIssueSearch(
  config,
  () => scope ?? undefined,
);

const headingId = useId();
const open = shallowRef(false);
const hasSearched = shallowRef(false);
// On by default whenever a scope exists (REQ-328); reset on every popover open.
const applyScope = shallowRef(true);
const rootEl = useTemplateRef<HTMLElement>('rootEl');
const queryInput = useTemplateRef('queryInput');
/** The last submitted title query, highlighted inside the result titles. */
const highlightQuery = shallowRef('');
/** The scoped project's title when the last search ran inside the scope, else empty. */
const searchedScopeTitle = shallowRef('');
const state = reactive<{ mode: RemoteIssueSearchMode; query: string }>({
  mode: REMOTE_ISSUE_SEARCH_MODE_ORDER[0],
  query: '',
});

const showEditMenu = computed(() => !!currentRef && !open.value);
const editMenuClass = computed(() => [
  'pointer-events-none absolute top-full right-0 z-20 pt-1 opacity-0',
  'group-hover/ri:pointer-events-auto group-hover/ri:opacity-100',
  'group-focus-within/ri:pointer-events-auto group-focus-within/ri:opacity-100',
]);

/**
 * The radio group drawn as a compact segmented control: joined cells, the checked one cyan. Each
 * radio is stretched, transparent, over its whole cell, so the cell is the radio itself.
 */
const MODE_UI = {
  fieldset: 'w-fit',
  item: [
    'relative flex h-8 cursor-pointer items-center border-accented px-3 py-0 text-muted',
    'first-of-type:rounded-s-md last-of-type:rounded-e-md',
    'has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary-100 has-data-[state=checked]:text-primary',
    'dark:has-data-[state=checked]:bg-primary/20',
  ].join(' '),
  base: 'not-sr-only absolute inset-0 z-[3] size-auto cursor-pointer rounded-none opacity-0 ring-0',
  label: 'text-xs font-medium text-current',
};

const searchModeLabelKeys = {
  title: 'remoteIssuePicker.modeTitle',
  id: 'remoteIssuePicker.modeId',
} as const satisfies Record<RemoteIssueSearchMode, string>;

const queryPlaceholderKey = computed(() =>
  state.mode === 'id'
    ? 'remoteIssuePicker.queryPlaceholderId'
    : 'remoteIssuePicker.queryPlaceholderTitle',
);

const modeItems = computed(() =>
  REMOTE_ISSUE_SEARCH_MODE_ORDER.map((value) => ({
    label: t(searchModeLabelKeys[value]),
    value,
  })),
);

const statusMessage = computed(() => {
  if (loading.value) return t('remoteIssuePicker.loading');
  if (!hasSearched.value) return '';
  if (errorKey.value) return t(errorKey.value);
  if (results.value.length === 0) {
    return t('remoteIssuePicker.emptyResults');
  }
  const count = t(
    'remoteIssuePicker.resultCount',
    { count: results.value.length },
    results.value.length,
  );
  return outOfScopeId.value ? `${count} ${t('remoteIssuePicker.outOfScopeHint')}` : count;
});

const scopeToggleLabel = computed(() =>
  scope ? t('remoteIssuePicker.scopeToggleLabel', { title: scope.remoteProjectTitle }) : '',
);

function linkedTooltip(ref: RemoteIssueRefDto): string {
  const base = `${t('timerView.remoteIssue.linkedTooltipPrefix')} #${ref.remoteIssueId}: ${ref.cachedTitle}`;
  return ref.cachedRemoteProjectTitle ? `${base} · ${ref.cachedRemoteProjectTitle}` : base;
}

function resultAccessibleName(result: RemoteIssueSearchResult): string {
  const base = result.remoteProjectTitle
    ? `#${result.remoteIssueId} ${result.title} ${result.remoteProjectTitle}`
    : `#${result.remoteIssueId} ${result.title}`;
  return result.remoteIssueId === outOfScopeId.value
    ? `${base} ${t('remoteIssuePicker.outOfScopeHint')}`
    : base;
}

/** The Tracker the link goes to, after the day whose entries it moves when that is known. */
const destinationLabel = computed(() =>
  dayLabel
    ? t('remoteIssuePicker.dayContext', { day: dayLabel, tracker: config.name })
    : config.name,
);

/** A result title split around the searched text, so the match can be marked. */
function titleParts(title: string): { text: string; match: boolean }[] {
  const query = highlightQuery.value;
  const at = query ? title.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return [{ text: title, match: false }];
  return [
    { text: title.slice(0, at), match: false },
    { text: title.slice(at, at + query.length), match: true },
    { text: title.slice(at + query.length), match: false },
  ].filter((part) => part.text);
}

/**
 * A result's remote project, shown unless it is the scope the search ran in: there every row
 * would repeat it, so only subprojects are named. It stays in the accessible name either way.
 */
function visibleProjectTitle(result: RemoteIssueSearchResult): string | undefined {
  return result.remoteProjectTitle === searchedScopeTitle.value
    ? undefined
    : result.remoteProjectTitle;
}

/** The query keeps the initial focus (REQ-460), though the mode control comes first. */
function focusQueryInput(event?: Event) {
  event?.preventDefault();
  queryInput.value?.inputRef?.focus();
}

// Shared by every path that opens the popover (the unlinked icon, the Edit
// menu item, and the popover's own controlled reopen) so state — including
// the scope toggle (REQ-328) — resets the same way regardless of entry point.
async function resetForOpen() {
  state.mode = REMOTE_ISSUE_SEARCH_MODE_ORDER[0];
  applyScope.value = true;
  hasSearched.value = false;
  await nextTick();
  focusQueryInput();
}

async function onTriggerClick() {
  open.value = true;
  await resetForOpen();
}

async function onOpenChange(value: boolean) {
  open.value = value;
  if (!value) {
    hasSearched.value = false;
    return;
  }
  await resetForOpen();
}

function onClose() {
  open.value = false;
  hasSearched.value = false;
}

/** What the shown results answer, so Enter on an unchanged query picks instead of re-searching. */
const searchedKey = shallowRef('');
const currentKey = computed(() => `${state.mode}\n${applyScope.value}\n${state.query}`);
/** The result Enter picks: the first after every search, moved by the arrow keys. */
const activeIndex = shallowRef(0);
const resultsList = useTemplateRef<HTMLElement>('resultsList');

async function submit() {
  const active = results.value[activeIndex.value];
  if (hasSearched.value && !loading.value && active && searchedKey.value === currentKey.value) {
    selectResult(active);
    return;
  }
  hasSearched.value = true;
  activeIndex.value = 0;
  searchedKey.value = currentKey.value;
  highlightQuery.value = state.mode === 'title' ? state.query.trim() : '';
  searchedScopeTitle.value = scope && applyScope.value ? scope.remoteProjectTitle : '';
  await search({ mode: state.mode, query: state.query }, applyScope.value);
}

/** Arrow keys move between the query and the results; the focused result becomes the active one. */
function moveActive(step: 1 | -1) {
  const buttons = resultsList.value?.querySelectorAll('button') ?? [];
  const focusedIndex = Array.from(buttons).findIndex((button) => button === document.activeElement);
  const next = focusedIndex < 0 ? (step === 1 ? activeIndex.value : -1) : focusedIndex + step;
  if (next < 0) {
    focusQueryInput();
    return;
  }
  const target = buttons[Math.min(next, buttons.length - 1)];
  target?.focus();
}

function selectResult(result: RemoteIssueSearchResult) {
  emit('link', {
    remoteIssueId: result.remoteIssueId,
    cachedTitle: result.title,
    cachedRemoteProjectTitle: result.remoteProjectTitle,
  });
  onClose();
}

function unlink() {
  emit('unlink');
  onClose();
}

onBeforeUnmount(() => {
  open.value = false;
});
</script>

<template>
  <span
    ref="rootEl"
    v-bind="$attrs"
    class="group/ri relative inline-flex h-7 min-w-7 items-center justify-start"
  >
    <UTooltip
      v-if="currentRef && currentRef.url"
      :text="linkedTooltip(currentRef)"
      :content="{ side: 'top' }"
    >
      <UButton
        :to="currentRef.url"
        target="_blank"
        external
        variant="link"
        color="neutral"
        size="xs"
        class="h-6 min-h-6 min-w-6 justify-start px-0 font-mono text-[0.8125rem] leading-none tabular-nums text-default hover:text-primary hover:underline focus-visible:text-primary"
        :label="`#${currentRef.remoteIssueId}`"
        :aria-label="linkedTooltip(currentRef)"
        :data-testid="linkTestid"
      />
    </UTooltip>
    <UTooltip v-else-if="currentRef" :text="linkedTooltip(currentRef)" :content="{ side: 'top' }">
      <span
        tabindex="0"
        class="inline-flex h-6 min-h-6 min-w-6 items-center justify-start font-mono text-[0.8125rem] leading-none tabular-nums text-default"
        :data-testid="cachedTestid"
      >
        #{{ currentRef.remoteIssueId }}
      </span>
    </UTooltip>

    <div v-if="showEditMenu" :class="editMenuClass" data-testid="remote-issue-picker-edit-menu">
      <div class="grid gap-0.5 rounded-md bg-default p-1 shadow-lg ring ring-default">
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          class="w-full justify-start"
          :label="t('timerView.editLabel')"
          :aria-label="t('timerView.remoteIssue.editLabel')"
          data-testid="remote-issue-picker-trigger"
          @click.stop="onTriggerClick"
        />
        <UButton
          icon="i-lucide-unlink"
          color="error"
          variant="ghost"
          class="w-full justify-start"
          :label="t('remoteIssuePicker.unlinkButton')"
          :aria-label="t('remoteIssuePicker.unlinkButton')"
          data-testid="remote-issue-picker-unlink"
          @click.stop="unlink"
        />
      </div>
    </div>
    <UButton
      v-else-if="!currentRef && linkLabel"
      icon="i-lucide-link"
      color="primary"
      variant="soft"
      size="xs"
      :active="open"
      active-variant="subtle"
      class="text-sm font-normal"
      :label="linkLabel"
      :data-testid="unlinkedTestid ?? 'remote-issue-picker-trigger'"
      @click.stop="onTriggerClick"
    />
    <UTooltip
      v-else-if="!currentRef"
      :text="t('timerView.remoteIssue.unlinked')"
      :content="{ side: 'top' }"
    >
      <!-- A 28px cyan tile like the row actions, pressed (ringed) while its picker is open. -->
      <UButton
        icon="i-lucide-link"
        color="primary"
        variant="soft"
        :active="open"
        active-variant="subtle"
        square
        size="sm"
        class="size-7 shrink-0 justify-center"
        :ui="{ leadingIcon: 'size-4' }"
        :aria-label="t('timerView.remoteIssue.unlinked')"
        :aria-expanded="open"
        :data-testid="unlinkedTestid ?? 'remote-issue-picker-trigger'"
        @click.stop="onTriggerClick"
      />
    </UTooltip>

    <UPopover
      :open="open"
      :modal="false"
      :reference="rootEl ?? undefined"
      :content="{
        side: 'bottom',
        align: 'end',
        sideOffset: 4,
        onOpenAutoFocus: focusQueryInput,
      }"
      @update:open="onOpenChange"
    >
      <template #content>
        <!--
          320px wide and right-aligned with the trigger: over the Timer list it covers the Project
          and Issue columns whole and ends clear of the day headings' Remote sync links.
        -->
        <div
          role="group"
          :aria-labelledby="headingId"
          class="grid w-80 max-w-[calc(100vw-2rem)] gap-3 p-3"
        >
          <!--
            Two lines: a heading naming what gets linked (with the Task title, when the caller
            knows it), then where it goes: the day whose entries move and the Tracker.
          -->
          <div class="grid min-w-0 gap-0.5">
            <h3 :id="headingId" class="m-0 truncate text-sm font-semibold text-highlighted">
              <i18n-t v-if="contextLabel" keypath="remoteIssuePicker.headingFor" scope="global">
                <template #task>
                  <span class="font-medium text-default" data-testid="remote-issue-picker-context">
                    {{ contextLabel }}
                  </span>
                </template>
              </i18n-t>
              <template v-else>{{ t('remoteIssuePicker.heading') }}</template>
            </h3>
            <p
              class="m-0 truncate text-xs text-muted"
              data-testid="remote-issue-picker-destination"
            >
              {{ destinationLabel }}
            </p>
          </div>

          <UForm
            :schema="remoteIssuePickerFormSchema"
            :state="state"
            class="grid gap-2"
            @submit="submit"
          >
            <!--
              The search mode first, as a compact segmented control (still a radio group), since
              it decides what the query means; the search status sits beside it. The query still
              takes the popover's initial focus (REQ-460).
            -->
            <div class="flex min-w-0 items-center gap-3">
              <URadioGroup
                id="remote-issue-mode"
                v-model="state.mode"
                :items="modeItems"
                :aria-label="t('remoteIssuePicker.modeLabel')"
                orientation="horizontal"
                variant="table"
                indicator="hidden"
                size="xs"
                value-key="value"
                label-key="label"
                :ui="MODE_UI"
                class="shrink-0"
                data-testid="remote-issue-picker-mode"
              />
              <p
                class="m-0 ms-auto min-w-0 text-end text-xs text-muted"
                role="status"
                aria-live="polite"
              >
                {{ statusMessage }}
              </p>
            </div>
            <!--
              The search submit is the input's own quiet trailing icon. Enter searches, and on an
              unchanged query picks the active result; the down arrow moves into the results.
            -->
            <UInput
              id="remote-issue-query"
              ref="queryInput"
              v-model="state.query"
              class="w-full"
              :ui="{ trailing: 'pe-1' }"
              :aria-label="t('remoteIssuePicker.queryLabel')"
              :placeholder="t(queryPlaceholderKey)"
              data-testid="remote-issue-picker-query"
              @keydown.down.prevent="moveActive(1)"
            >
              <template #trailing>
                <UTooltip :text="t('remoteIssuePicker.submitButton')" :content="{ side: 'top' }">
                  <UButton
                    type="submit"
                    icon="i-lucide-search"
                    color="neutral"
                    variant="link"
                    size="xs"
                    square
                    class="text-dimmed hover:text-default"
                    :loading="loading"
                    :aria-label="t('remoteIssuePicker.submitButton')"
                    data-testid="remote-issue-picker-submit"
                  />
                </UTooltip>
              </template>
            </UInput>
          </UForm>

          <UCheckbox
            v-if="scope"
            id="remote-issue-picker-scope-toggle"
            v-model="applyScope"
            size="sm"
            :label="scopeToggleLabel"
            data-testid="remote-issue-picker-scope-toggle"
          />

          <!--
            Full-width option rows, aligned with the input: its edges and its text inset. The
            active row (the first after a search) is highlighted: Enter in the query picks it.
          -->
          <ul
            v-if="hasSearched && results.length > 0"
            ref="resultsList"
            class="m-0 -mt-1 grid max-h-60 list-none gap-0.5 overflow-auto p-0"
            :aria-label="t('remoteIssuePicker.resultsLabel')"
            data-testid="remote-issue-picker-results"
          >
            <li v-for="(result, index) in results" :key="result.remoteIssueId">
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                block
                class="h-auto justify-start rounded-md px-2.5 py-1.5 text-left hover:bg-elevated focus-visible:bg-elevated dark:hover:bg-accented/60 dark:focus-visible:bg-accented/60"
                :class="index === activeIndex && 'bg-elevated dark:bg-accented/60'"
                :data-active="index === activeIndex || undefined"
                :aria-label="resultAccessibleName(result)"
                :data-testid="`remote-issue-picker-result-${result.remoteIssueId}`"
                @click="selectResult(result)"
                @focus="activeIndex = index"
                @keydown.down.prevent="moveActive(1)"
                @keydown.up.prevent="moveActive(-1)"
              >
                <span class="flex min-w-0 flex-col items-start gap-0.5">
                  <span class="w-full truncate text-sm font-medium text-default">
                    <template
                      v-for="(part, partIndex) in titleParts(result.title)"
                      :key="partIndex"
                    >
                      <mark
                        v-if="part.match"
                        class="rounded-[3px] bg-primary-100 text-highlighted dark:bg-primary/20"
                      >
                        {{ part.text }}
                      </mark>
                      <template v-else>{{ part.text }}</template>
                    </template>
                  </span>
                  <!-- The id in the table's mono face; one separator glyph (·) across the app. -->
                  <span class="flex w-full min-w-0 items-baseline gap-1.5 text-xs text-muted">
                    <span class="shrink-0 font-mono tabular-nums">#{{ result.remoteIssueId }}</span>
                    <span
                      v-if="visibleProjectTitle(result)"
                      class="truncate before:me-1.5 before:content-['·']"
                    >
                      {{ visibleProjectTitle(result) }}
                    </span>
                  </span>
                  <span
                    v-if="result.remoteIssueId === outOfScopeId"
                    class="truncate text-xs text-warning"
                    data-testid="remote-issue-picker-out-of-scope-hint"
                  >
                    {{ t('remoteIssuePicker.outOfScopeHint') }}
                  </span>
                </span>
              </UButton>
            </li>
          </ul>
        </div>
      </template>
    </UPopover>
  </span>
</template>
