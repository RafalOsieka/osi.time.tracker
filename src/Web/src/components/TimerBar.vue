<script setup lang="ts">
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
  return projectsStore.projects.find((p) => p.id === projectId)?.name ?? '';
}

function itemLabel(i: { title: string; remoteId: string | null; projectId: string }): string {
  const proj = projectLabel(i.projectId);
  const remote = i.remoteId ? ` #${i.remoteId}` : '';
  return proj ? `${proj} • ${i.title}${remote}` : `${i.title}${remote}`;
}

const itemOptions = computed(() => {
  const opts: { label: string; value: string }[] = [
    { label: '➕ New item (Default Project)', value: NEW_ITEM },
  ];
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
  const itemId =
    selectedItemId.value === NEW_ITEM || !selectedItemId.value ? null : selectedItemId.value;
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
  <div
    class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center dark:border-slate-800 dark:bg-slate-900"
  >
    <template v-if="timerStore.isRunning && timerStore.active">
      <div class="flex flex-1 flex-col">
        <span class="text-xs font-semibold tracking-wider text-slate-400 uppercase">Running</span>
        <span class="truncate text-lg font-semibold text-slate-900 dark:text-white">
          {{ timerStore.active.title }}
        </span>
        <span v-if="timerStore.active.item" class="text-sm text-slate-500">
          {{ itemLabel(timerStore.active.item) }}
        </span>
      </div>
      <div class="font-mono text-2xl font-bold text-primary tabular-nums">
        {{ formatDuration(elapsed) }}
      </div>
      <Button label="Stop" icon="pi pi-stop" severity="danger" :loading="timerStore.loading" @click="onStop" />
    </template>

    <template v-else>
      <Select
        v-model="selectedItemId"
        :options="itemOptions"
        option-label="label"
        option-value="value"
        placeholder="Item / new"
        filter
        class="md:w-72"
      />
      <InputText
        v-model="title"
        placeholder="What are you working on?"
        class="flex-1"
        @keyup.enter="onStart"
      />
      <Button
        label="Start"
        icon="pi pi-play"
        :disabled="!title.trim()"
        :loading="timerStore.loading"
        @click="onStart"
      />
    </template>
  </div>
  <div
    v-if="timerStore.error"
    class="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-300"
  >
    <i class="pi pi-exclamation-circle mt-0.5"></i>
    <span>{{ timerStore.error }}</span>
  </div>
</template>
