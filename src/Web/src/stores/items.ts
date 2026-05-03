import { defineStore } from 'pinia';
import { ref } from 'vue';

import { itemsApi } from '../api/client';
import type { CreateItemRequest, Item, MatchItemRequest } from '../api/types';

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

  function upsert(item: Item) {
    const idx = items.value.findIndex((i) => i.id === item.id);
    if (idx >= 0) items.value[idx] = item;
    else items.value.push(item);
  }

  async function create(req: CreateItemRequest) {
    const created = await itemsApi.create(req);
    upsert(created);
    return created;
  }

  async function update(id: string, title: string, isArchived: boolean) {
    const updated = await itemsApi.update(id, { title, isArchived });
    upsert(updated);
    return updated;
  }

  async function match(id: string, req: MatchItemRequest) {
    const updated = await itemsApi.match(id, req);
    upsert(updated);
    return updated;
  }

  async function merge(sourceId: string, targetId: string) {
    const target = await itemsApi.merge({ sourceId, targetId });
    upsert(target);
    // Source item is archived server-side; refresh from server next time.
    await load(true);
    return target;
  }

  async function remove(id: string) {
    await itemsApi.remove(id);
    items.value = items.value.filter((i) => i.id !== id);
  }

  return { items, loading, error, load, create, update, match, merge, remove, upsert };
});
