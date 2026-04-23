import { defineStore } from 'pinia';
import { ref } from 'vue';

import { itemsApi } from '../api/client';
import type { Item } from '../api/types';

export const useItemsStore = defineStore('items', () => {
  const items = ref<Item[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  let loaded = false;

  async function load(force = false) {
    if (loaded && !force) return;
    loading.value = true;
    error.value = null;
    try {
      items.value = await itemsApi.list();
      loaded = true;
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }

  async function update(id: string, name: string, isArchived: boolean) {
    const updated = await itemsApi.update(id, { name, isArchived });
    const idx = items.value.findIndex((i) => i.id === id);
    if (idx >= 0) {
      items.value[idx] = updated;
    }
    return updated;
  }

  return { items, loading, error, load, update };
});
