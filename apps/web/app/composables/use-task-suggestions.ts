import { ref } from 'vue';
import type { TaskDto } from '../../shared/types/task';

/** Trailing-edge debounce before a keystroke turns into a suggestion request. */
const SUGGESTION_DEBOUNCE_MS = 200;

/**
 * Debounced, stale-response-safe task-title suggestions shared by the
 * top-bar timer and the add-entry dialog (REQ-360). While the user keeps
 * typing, only one request is issued for the settled text once typing
 * pauses; a response for text that a newer request has since superseded is
 * discarded. A failed request leaves the previous suggestions untouched
 * rather than surfacing an error, so a transient failure never interrupts
 * typing a title. Relies on the server's own cap and most-recently-used
 * ranking (REQ-133) — never asks for more than it can show.
 */
export function useTaskSuggestions() {
  const suggestions = ref<TaskDto[]>([]);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  // Monotonically increasing token used to suppress stale/superseded responses.
  let requestToken = 0;

  async function fetchSuggestions(query: string): Promise<void> {
    const token = ++requestToken;
    try {
      const results = await $fetch<TaskDto[]>('/api/tasks', { query: { search: query } });
      if (token !== requestToken) return; // superseded by a newer request
      suggestions.value = results;
    } catch {
      // Keep the previously shown suggestions; a transient failure should
      // not interrupt typing or surface an error toast.
    }
  }

  function search(query: string): void {
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      void fetchSuggestions(query);
    }, SUGGESTION_DEBOUNCE_MS);
  }

  return { suggestions, search };
}
