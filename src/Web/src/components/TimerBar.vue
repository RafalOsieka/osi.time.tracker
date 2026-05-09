<script lang="ts" setup>
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { computed, onMounted, onUnmounted, ref } from 'vue';

import { useEntriesStore } from '../stores/entries';
import { useItemsStore } from '../stores/items';
import { useProjectsStore } from '../stores/projects';
import { useTimerStore } from '../stores/timer';
import { formatDuration } from '../utils/time';

const timerStore = useTimerStore();
const itemsStore = useItemsStore();
const projectsStore = useProjectsStore();
const entriesStore = useEntriesStore();

const NEW_ITEM = '__new__';
const selectedItemId = ref<string>(NEW_ITEM);
const title = ref('');

const now = ref(Date.now());
let tickHandle: number | undefined;

const elapsed = computed(() => {
  if (!timerStore.active) return 0;
  const start = new Date(timerStore.active.startUtc).getTime();
  return Math.max(0, Math.floor((now.value - start) / 1000));
});

function projectLabel(projectId: string): string {
  return projectsStore.projects.find(p => p.id === projectId)?.name ?? '';
}

function itemLabel(i: { title: string; remoteId: string | null; projectId: string }): string {
  const proj = projectLabel(i.projectId);
  const remote = i.remoteId ? ` #${i.remoteId}` : '';
  return proj ? `${proj} • ${i.title}${remote}` : `${i.title}${remote}`;
}

const itemOptions = computed(() => {
  const opts: { label: string; value: string }[] = [{ label: '➕ New item (Default Project)', value: NEW_ITEM }];
  for (const i of itemsStore.items) {
    if (i.isArchived) continue;
    opts.push({ label: itemLabel(i), value: i.id });
  }
  return opts;
});

onMounted(async () => {
  await Promise.all([timerStore.refresh(), itemsStore.load(), projectsStore.load()]);
  tickHandle = window.setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (tickHandle) window.clearInterval(tickHandle);
});

async function onStart() {
  if (!title.value.trim()) return;
  const itemId = selectedItemId.value === NEW_ITEM || !selectedItemId.value ? null : selectedItemId.value;
  await timerStore.start({
    itemId,
    title: title.value.trim(),
  });
  title.value = '';
  // Refresh items list to surface any implicitly-created item.
  await itemsStore.load(true);
}

async function onStop() {
  const stopped = await timerStore.stop();
  if (stopped) entriesStore.upsert(stopped);
}
</script>

<template>
  <!-- Running: hero card -->
  <div
    v-if="timerStore.isRunning && timerStore.active"
    class="timer-card--running w-full rounded-xl border p-6"
    style="background-color: var(--ds-bg-surface); border-color: var(--ds-border)"
  >
    <span class="block text-xs font-semibold tracking-widest uppercase mb-4" style="color: var(--ds-text-lo)">Running</span>
    <div class="flex flex-col items-center text-center mb-6">
      <span class="font-mono text-7xl font-bold tabular-nums leading-none" style="color: var(--ds-accent)">
        {{ formatDuration(elapsed) }}
      </span>
    </div>
    <div class="flex items-end justify-between gap-4">
      <div class="flex flex-col min-w-0">
        <span class="text-lg font-semibold truncate" style="color: var(--ds-text-hi)">
          {{ timerStore.active.title }}
        </span>
        <span v-if="timerStore.active.item" class="text-sm" style="color: var(--ds-text-lo)">
          {{ itemLabel(timerStore.active.item) }}
        </span>
      </div>
      <Button :loading="timerStore.loading" icon="pi pi-stop" label="Stop" severity="danger" @click="onStop" />
    </div>
  </div>

  <!-- Idle: compact input row -->
  <div
    v-else
    class="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center"
    style="background-color: var(--ds-bg-surface); border-color: var(--ds-border)"
  >
    <Select
      v-model="selectedItemId"
      :options="itemOptions"
      class="md:w-72"
      filter
      option-label="label"
      option-value="value"
      placeholder="Item / new"
    />
    <InputText v-model="title" class="flex-1" placeholder="What are you working on?" @keyup.enter="onStart" />
    <Button
      :disabled="!title.trim()"
      :loading="timerStore.loading"
      icon="pi pi-play"
      label="Start"
      @click="onStart"
    />
  </div>

  <div
    v-if="timerStore.error"
    class="mt-2 flex items-start gap-2 rounded-md border p-2 text-sm"
    style="border-color: var(--ds-danger); background-color: color-mix(in srgb, var(--ds-danger) 10%, transparent); color: var(--ds-danger)"
  >
    <i class="pi pi-exclamation-circle mt-0.5"></i>
    <span>{{ timerStore.error }}</span>
  </div>
</template>
