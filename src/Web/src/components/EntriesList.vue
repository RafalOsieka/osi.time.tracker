<script setup lang="ts">
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import { computed, onMounted, ref } from 'vue';

import type { TimeEntry } from '../api/types';
import { useEntriesStore } from '../stores/entries';
import { useTimerStore } from '../stores/timer';
import { endOfToday, formatDuration, fromLocalInputValue, startOfToday, startOfWeek, toLocalInputValue } from '../utils/time';

type Range = 'today' | 'week';

const entriesStore = useEntriesStore();
const timerStore = useTimerStore();

const range = ref<Range>('today');
const editingId = ref<string | null>(null);

interface EditDraft {
  title: string;
  note: string;
  startLocal: string;
  endLocal: string;
}
const draft = ref<EditDraft>({ title: '', note: '', startLocal: '', endLocal: '' });

async function reload() {
  const to = endOfToday();
  const from = range.value === 'today' ? startOfToday() : startOfWeek();
  await entriesStore.load(from, to);
}

onMounted(reload);

function entryDuration(e: TimeEntry): number {
  const start = new Date(e.startUtc).getTime();
  const end = e.endUtc ? new Date(e.endUtc).getTime() : Date.now();
  return Math.max(0, Math.floor((end - start) / 1000));
}

const totalSeconds = computed(() => entriesStore.entries.reduce((sum, e) => sum + entryDuration(e), 0));

function startEdit(e: TimeEntry) {
  editingId.value = e.id;
  draft.value = {
    title: e.title,
    note: e.note ?? '',
    startLocal: toLocalInputValue(e.startUtc),
    endLocal: toLocalInputValue(e.endUtc),
  };
}

function cancelEdit() {
  editingId.value = null;
}

async function saveEdit(e: TimeEntry) {
  try {
    await entriesStore.update(e.id, {
      title: draft.value.title.trim(),
      note: draft.value.note.trim() || null,
      startUtc: fromLocalInputValue(draft.value.startLocal),
      endUtc: draft.value.endLocal ? fromLocalInputValue(draft.value.endLocal) : null,
    });
    editingId.value = null;
  } catch (err) {
    alert((err as Error).message);
  }
}

async function removeEntry(e: TimeEntry) {
  if (!confirm(`Delete entry "${e.title}"?`)) return;
  try {
    await entriesStore.remove(e.id);
  } catch (err) {
    alert((err as Error).message);
  }
}

async function splitEntry(e: TimeEntry) {
  if (!e.endUtc) {
    alert('Cannot split a running entry. Stop it first.');
    return;
  }
  const start = new Date(e.startUtc).getTime();
  const end = new Date(e.endUtc).getTime();
  const mid = new Date(start + Math.floor((end - start) / 2)).toISOString();
  try {
    // Shorten original to mid
    await entriesStore.update(e.id, {
      title: e.title,
      note: e.note,
      startUtc: e.startUtc,
      endUtc: mid,
    });
    // Create second half
    await entriesStore.create({
      itemId: e.itemId,
      title: e.title,
      note: e.note,
      startUtc: mid,
      endUtc: e.endUtc,
    });
  } catch (err) {
    alert((err as Error).message);
  }
}

function isActive(e: TimeEntry): boolean {
  return e.endUtc === null;
}
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div class="mb-3 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Entries</h2>
        <div class="flex rounded-md border border-slate-200 dark:border-slate-700">
          <button
            :class="[
              'px-3 py-1 text-sm',
              range === 'today' ? 'bg-primary text-primary-contrast' : 'text-slate-600 dark:text-slate-300',
            ]"
            @click="range = 'today'; reload()"
          >
            Today
          </button>
          <button
            :class="[
              'px-3 py-1 text-sm',
              range === 'week' ? 'bg-primary text-primary-contrast' : 'text-slate-600 dark:text-slate-300',
            ]"
            @click="range = 'week'; reload()"
          >
            This Week
          </button>
        </div>
      </div>
      <div class="text-sm text-slate-500">
        Total: <span class="font-mono font-semibold text-slate-800 dark:text-slate-200">{{ formatDuration(totalSeconds) }}</span>
      </div>
    </div>

    <div v-if="entriesStore.loading" class="py-6 text-center text-slate-400">Loading...</div>

    <div v-else-if="entriesStore.entries.length === 0" class="py-8 text-center text-slate-400">
      No entries in the selected range.
    </div>

    <ul v-else class="divide-y divide-slate-100 dark:divide-slate-800">
      <li v-for="entry in entriesStore.entries" :key="entry.id" class="py-3">
        <template v-if="editingId === entry.id">
          <div class="flex flex-col gap-2">
            <InputText v-model="draft.title" placeholder="Title" />
            <InputText v-model="draft.note" placeholder="Note" />
            <div class="flex flex-wrap gap-2">
              <label class="flex flex-col text-xs text-slate-500">
                Start
                <input
                  v-model="draft.startLocal"
                  type="datetime-local"
                  class="rounded border border-slate-200 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label class="flex flex-col text-xs text-slate-500">
                End
                <input
                  v-model="draft.endLocal"
                  type="datetime-local"
                  class="rounded border border-slate-200 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
            </div>
            <div class="flex gap-2">
              <Button label="Save" icon="pi pi-check" size="small" @click="saveEdit(entry)" />
              <Button label="Cancel" icon="pi pi-times" severity="secondary" size="small" @click="cancelEdit" />
            </div>
          </div>
        </template>
        <template v-else>
          <div class="flex items-start justify-between gap-3">
            <div class="flex min-w-0 flex-1 flex-col">
              <div class="flex items-center gap-2">
                <span class="truncate font-medium text-slate-900 dark:text-white">{{ entry.title }}</span>
                <span
                  v-if="isActive(entry)"
                  class="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-300"
                >
                  running
                </span>
              </div>
              <span v-if="entry.item" class="text-xs text-slate-500">
                {{ entry.item.name }} (#{{ entry.item.remoteId }})
              </span>
              <span v-if="entry.note" class="text-xs text-slate-500 italic">{{ entry.note }}</span>
              <span class="mt-1 text-xs text-slate-400">
                {{ new Date(entry.startUtc).toLocaleString() }}
                –
                {{ entry.endUtc ? new Date(entry.endUtc).toLocaleTimeString() : '…' }}
              </span>
            </div>
            <div class="flex flex-col items-end gap-1">
              <span class="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {{ formatDuration(entryDuration(entry)) }}
              </span>
              <div class="flex gap-1">
                <Button
                  icon="pi pi-pencil"
                  text
                  rounded
                  size="small"
                  aria-label="Edit"
                  :disabled="isActive(entry)"
                  @click="startEdit(entry)"
                />
                <Button
                  icon="pi pi-clone"
                  text
                  rounded
                  size="small"
                  aria-label="Split"
                  :disabled="isActive(entry)"
                  @click="splitEntry(entry)"
                />
                <Button
                  icon="pi pi-trash"
                  text
                  rounded
                  size="small"
                  severity="danger"
                  aria-label="Delete"
                  :disabled="isActive(entry) && timerStore.isRunning"
                  @click="removeEntry(entry)"
                />
              </div>
            </div>
          </div>
        </template>
      </li>
    </ul>
  </div>
</template>
