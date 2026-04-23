import { defineStore } from 'pinia';
import { ref } from 'vue';

import { entriesApi } from '../api/client';
import type { CreateEntryRequest, TimeEntry, UpdateEntryRequest } from '../api/types';

export const useEntriesStore = defineStore('entries', () => {
  const entries = ref<TimeEntry[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function load(from: Date, to: Date, itemId?: string) {
    loading.value = true;
    error.value = null;
    try {
      entries.value = await entriesApi.list(from.toISOString(), to.toISOString(), itemId);
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }

  function upsert(entry: TimeEntry) {
    const idx = entries.value.findIndex((e) => e.id === entry.id);
    if (idx >= 0) entries.value[idx] = entry;
    else entries.value.unshift(entry);
    entries.value.sort((a, b) => b.startUtc.localeCompare(a.startUtc));
  }

  async function create(req: CreateEntryRequest) {
    const created = await entriesApi.create(req);
    upsert(created);
    return created;
  }

  async function update(id: string, req: UpdateEntryRequest) {
    // optimistic update
    const snapshot = entries.value.map((e) => ({ ...e }));
    const idx = entries.value.findIndex((e) => e.id === id);
    if (idx >= 0) {
      entries.value[idx] = {
        ...entries.value[idx],
        title: req.title,
        note: req.note ?? null,
        startUtc: req.startUtc,
        endUtc: req.endUtc ?? null,
      };
    }
    try {
      const updated = await entriesApi.update(id, req);
      upsert(updated);
      return updated;
    } catch (e) {
      entries.value = snapshot;
      throw e;
    }
  }

  async function remove(id: string) {
    const snapshot = entries.value.slice();
    entries.value = entries.value.filter((e) => e.id !== id);
    try {
      await entriesApi.remove(id);
    } catch (e) {
      entries.value = snapshot;
      throw e;
    }
  }

  return { entries, loading, error, load, create, update, remove, upsert };
});
