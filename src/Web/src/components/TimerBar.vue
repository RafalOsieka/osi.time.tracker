<script setup lang="ts">
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';
import { computed, onMounted, onUnmounted, ref } from 'vue';

import { useEntriesStore } from '../stores/entries';
import { useItemsStore } from '../stores/items';
import { useTimerStore } from '../stores/timer';
import { formatDuration } from '../utils/time';

const timerStore = useTimerStore();
const itemsStore = useItemsStore();
const entriesStore = useEntriesStore();

const selectedItemId = ref<string | null>(null);
const title = ref('');
const note = ref('');

const now = ref(Date.now());
let tickHandle: number | undefined;

const elapsed = computed(() => {
  if (!timerStore.active) return 0;
  const start = new Date(timerStore.active.startUtc).getTime();
  return Math.max(0, Math.floor((now.value - start) / 1000));
});

const itemOptions = computed(() =>
  itemsStore.items
    .filter((i) => !i.isArchived)
    .map((i) => ({
      label: `${i.name} (#${i.remoteId})`,
      value: i.id,
    })),
);

onMounted(async () => {
  await Promise.all([timerStore.refresh(), itemsStore.load()]);
  tickHandle = window.setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (tickHandle) window.clearInterval(tickHandle);
});

async function onStart() {
  if (!selectedItemId.value || !title.value.trim()) return;
  await timerStore.start({
    itemId: selectedItemId.value,
    title: title.value.trim(),
    note: note.value.trim() || null,
  });
  // reset inputs
  title.value = '';
  note.value = '';
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
          {{ timerStore.active.item.name }} (#{{ timerStore.active.item.remoteId }})
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
        placeholder="Select item"
        filter
        class="md:w-64"
      />
      <InputText v-model="title" placeholder="What are you working on?" class="flex-1" />
      <Textarea v-model="note" placeholder="Note (optional)" rows="1" auto-resize class="flex-1" />
      <Button
        label="Start"
        icon="pi pi-play"
        :disabled="!selectedItemId || !title.trim()"
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
