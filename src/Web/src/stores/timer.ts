import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { timerApi } from '../api/client';
import type { StartTimerRequest, TimeEntry } from '../api/types';

export const useTimerStore = defineStore('timer', () => {
  const active = ref<TimeEntry | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const isRunning = computed(() => active.value !== null && active.value.endUtc === null);

  async function refresh() {
    loading.value = true;
    error.value = null;
    try {
      active.value = await timerApi.getActive();
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }

  async function start(req: StartTimerRequest) {
    loading.value = true;
    error.value = null;
    try {
      active.value = await timerApi.start(req);
    } catch (e) {
      error.value = await extractError(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function stop() {
    if (!active.value) return null;
    loading.value = true;
    error.value = null;
    const previous = active.value;
    // optimistic: clear immediately
    active.value = null;
    try {
      return await timerApi.stop();
    } catch (e) {
      active.value = previous;
      error.value = await extractError(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  return { active, loading, error, isRunning, refresh, start, stop };
});

async function extractError(e: unknown): Promise<string> {
  const err = e as { response?: Response; message?: string };
  if (err.response) {
    try {
      const text = await err.response.text();
      return text || err.message || 'Request failed';
    } catch {
      return err.message || 'Request failed';
    }
  }
  return err.message || 'Request failed';
}
