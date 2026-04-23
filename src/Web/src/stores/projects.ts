import { defineStore } from 'pinia';
import { ref } from 'vue';

import { projectsApi } from '../api/client';
import type { Project } from '../api/types';

export const useProjectsStore = defineStore('projects', () => {
  const projects = ref<Project[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  let loaded = false;

  async function load(force = false) {
    if (loaded && !force) return;
    loading.value = true;
    error.value = null;
    try {
      projects.value = await projectsApi.list();
      loaded = true;
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }

  async function create(name: string, color?: string | null) {
    const created = await projectsApi.create({ name, color });
    projects.value.push(created);
    projects.value.sort((a, b) => a.name.localeCompare(b.name));
    return created;
  }

  async function update(id: string, name: string, color: string | null, isArchived: boolean) {
    const updated = await projectsApi.update(id, { name, color, isArchived });
    const idx = projects.value.findIndex((p) => p.id === id);
    if (idx >= 0) {
      projects.value[idx] = updated;
    }
    return updated;
  }

  return { projects, loading, error, load, create, update };
});
