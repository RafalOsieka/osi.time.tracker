<script lang="ts" setup>
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { computed, onMounted, ref } from 'vue';

import type { TimeEntry } from '../api/types';
import { useEntriesStore } from '../stores/entries';
import { useItemsStore } from '../stores/items';
import { useProjectsStore } from '../stores/projects';
import { useTimerStore } from '../stores/timer';
import {
  endOfToday,
  formatDuration,
  fromLocalInputValue,
  startOfToday,
  startOfWeek,
  toLocalInputValue,
} from '../utils/time';

type Range = 'today' | 'week';

const entriesStore = useEntriesStore();
const itemsStore = useItemsStore();
const projectsStore = useProjectsStore();
const timerStore = useTimerStore();

const range = ref<Range>('today');
const editingId = ref<string | null>(null);

interface EditDraft {
  title: string;
  itemId: string;
  startLocal: string;
  endLocal: string;
}

const draft = ref<EditDraft>({ title: '', itemId: '', startLocal: '', endLocal: '' });

async function reload() {
  const to = endOfToday();
  const from = range.value === 'today' ? startOfToday() : startOfWeek();
  await Promise.all([entriesStore.load(from, to), itemsStore.load(), projectsStore.load()]);
}

onMounted(reload);

const itemOptions = computed(() =>
  itemsStore.items
    .filter(i => !i.isArchived)
    .map(i => {
      const proj = projectsStore.projects.find(p => p.id === i.projectId)?.name ?? '';
      const remote = i.remoteId ? ` #${i.remoteId}` : '';
      return { label: proj ? `${proj} • ${i.title}${remote}` : `${i.title}${remote}`, value: i.id };
    })
);

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
    itemId: e.itemId,
    startLocal: toLocalInputValue(e.startUtc),
    endLocal: toLocalInputValue(e.endUtc),
  };
}

function cancelEdit() {
  editingId.value = null;
}

async function saveEdit(e: TimeEntry) {
  try {
    // If user re-targeted entry to a different item, perform "move":
    // backend exposes update for title/start/end only; for item moves we
    // use a small workaround — recreate entry under new item and delete original.
    const movingItem = draft.value.itemId && draft.value.itemId !== e.itemId;
    if (movingItem) {
      await entriesStore.create({
        itemId: draft.value.itemId,
        title: draft.value.title.trim(),
        startUtc: fromLocalInputValue(draft.value.startLocal),
        endUtc: draft.value.endLocal ? fromLocalInputValue(draft.value.endLocal) : null,
      });
      await entriesStore.remove(e.id);
    } else {
      await entriesStore.update(e.id, {
        title: draft.value.title.trim(),
        startUtc: isActive(e) ? e.startUtc : fromLocalInputValue(draft.value.startLocal),
        endUtc: isActive(e) ? null : (draft.value.endLocal ? fromLocalInputValue(draft.value.endLocal) : null),
      });
    }
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
    await entriesStore.update(e.id, {
      title: e.title,
      startUtc: e.startUtc,
      endUtc: mid,
    });
    await entriesStore.create({
      itemId: e.itemId,
      title: e.title,
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

function itemLabelOf(e: TimeEntry): string {
  const item = e.item ?? itemsStore.items.find(i => i.id === e.itemId);
  if (!item) return '';
  const proj = projectsStore.projects.find(p => p.id === item.projectId)?.name ?? '';
  const remote = item.remoteId ? ` #${item.remoteId}` : '';
  return proj ? `${proj} • ${item.title}${remote}` : `${item.title}${remote}`;
}
</script>

<template>
  <div class="rounded-xl border p-4" style="background-color: var(--ds-bg-surface); border-color: var(--ds-border)">
    <!-- Header -->
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h2 class="text-lg font-semibold" style="color: var(--ds-text-hi)">Entries</h2>
        <!-- Today / Week toggle -->
        <div class="flex rounded-full border overflow-hidden" style="border-color: var(--ds-border)">
          <button
            class="px-3 py-1 text-sm transition-colors"
            :style="range === 'today'
              ? 'background-color: var(--ds-accent); color: #fff;'
              : 'color: var(--ds-text-lo);'"
            @click="range = 'today'; reload()"
          >Today</button>
          <button
            class="px-3 py-1 text-sm transition-colors"
            :style="range === 'week'
              ? 'background-color: var(--ds-accent); color: #fff;'
              : 'color: var(--ds-text-lo);'"
            @click="range = 'week'; reload()"
          >This Week</button>
        </div>
      </div>
      <div class="text-sm" style="color: var(--ds-text-lo)">
        Total:
        <span class="font-mono font-semibold" style="color: var(--ds-accent)">
          {{ formatDuration(totalSeconds) }}
        </span>
      </div>
    </div>

    <div v-if="entriesStore.loading" class="py-6 text-center" style="color: var(--ds-text-lo)">Loading…</div>

    <div v-else-if="entriesStore.entries.length === 0" class="py-8 text-center" style="color: var(--ds-text-lo)">
      No entries in the selected range.
    </div>

    <!-- Timeline -->
    <ul v-else class="relative">
      <!-- Vertical connecting line -->
      <div class="absolute left-[10px] top-3 bottom-3 w-px" style="background-color: var(--ds-border); transform: translateX(-50%)"></div>

      <li
        v-for="entry in entriesStore.entries"
        :key="entry.id"
        class="group relative flex gap-4 py-3"
      >
        <!-- Dot -->
        <div class="relative z-10 flex w-5 shrink-0 items-center justify-center pt-0.5">
          <span
            v-if="isActive(entry)"
            class="block w-3 h-3 rounded-full"
            style="background-color: var(--ds-success); animation: dot-pulse 1.5s ease-in-out infinite"
          ></span>
          <span
            v-else
            class="block w-3 h-3 rounded-full"
            style="background-color: var(--ds-border-hi)"
          ></span>
        </div>

        <!-- Edit form -->
        <template v-if="editingId === entry.id">
          <div class="flex flex-1 flex-col gap-2">
            <InputText v-model="draft.title" placeholder="Title" />
            <Select
              v-model="draft.itemId"
              :options="itemOptions"
              filter
              option-label="label"
              option-value="value"
              placeholder="Move to item"
            />
            <div v-if="!isActive(entry)" class="flex flex-wrap gap-2">
              <label class="flex flex-col text-xs" style="color: var(--ds-text-lo)">
                Start
                <input
                  v-model="draft.startLocal"
                  class="rounded border px-2 py-1 text-sm"
                  style="border-color: var(--ds-border); background-color: var(--ds-bg-raised); color: var(--ds-text-hi)"
                  type="datetime-local"
                />
              </label>
              <label class="flex flex-col text-xs" style="color: var(--ds-text-lo)">
                End
                <input
                  v-model="draft.endLocal"
                  class="rounded border px-2 py-1 text-sm"
                  style="border-color: var(--ds-border); background-color: var(--ds-bg-raised); color: var(--ds-text-hi)"
                  type="datetime-local"
                />
              </label>
            </div>
            <div class="flex gap-2">
              <Button icon="pi pi-check" label="Save" size="small" @click="saveEdit(entry)" />
              <Button icon="pi pi-times" label="Cancel" severity="secondary" size="small" @click="cancelEdit" />
            </div>
          </div>
        </template>

        <!-- View row -->
        <template v-else>
          <div class="flex flex-1 items-start justify-between gap-3 min-w-0">
            <div class="flex min-w-0 flex-1 flex-col">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-medium truncate" style="color: var(--ds-text-hi)">{{ entry.title }}</span>
                <span
                  v-if="isActive(entry)"
                  class="rounded-full px-2 py-0.5 text-xs"
                  style="background-color: color-mix(in srgb, var(--ds-success) 15%, transparent); color: var(--ds-success)"
                >running</span>
                <span
                  v-if="entry.published"
                  class="rounded-full px-2 py-0.5 text-xs"
                  style="background-color: color-mix(in srgb, var(--ds-accent) 15%, transparent); color: var(--ds-accent)"
                >published</span>
              </div>
              <span class="text-xs" style="color: var(--ds-text-lo)">{{ itemLabelOf(entry) }}</span>
              <span class="mt-0.5 font-mono text-xs" style="color: var(--ds-text-lo)">
                {{ new Date(entry.startUtc).toLocaleString() }} – {{ entry.endUtc ? new Date(entry.endUtc).toLocaleTimeString() : '…' }}
              </span>
            </div>
            <div class="flex flex-col items-end gap-1 shrink-0">
              <span class="font-mono font-semibold" style="color: var(--ds-text-hi)">
                {{ formatDuration(entryDuration(entry)) }}
              </span>
              <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  v-tooltip.top="isActive(entry) ? 'Edit title & item' : 'Edit entry'"
                  aria-label="Edit"
                  icon="pi pi-pencil"
                  rounded
                  size="small"
                  text
                  @click="startEdit(entry)"
                />
                <Button
                  v-tooltip.top="'Split entry in half'"
                  :disabled="isActive(entry)"
                  aria-label="Split"
                  icon="pi pi-clone"
                  rounded
                  size="small"
                  text
                  @click="splitEntry(entry)"
                />
                <Button
                  v-tooltip.top="'Delete entry'"
                  :disabled="isActive(entry) && timerStore.isRunning"
                  aria-label="Delete"
                  icon="pi pi-trash"
                  rounded
                  severity="danger"
                  size="small"
                  text
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
