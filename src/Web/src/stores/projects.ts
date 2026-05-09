import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { projectsApi } from '../api/client';
import type { CreateProjectRequest, Project, UpdateProjectRequest } from '../api/types';

export const useProjectsStore = defineStore('projects', () => {
  const projects = ref<Project[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  let loaded = false;

  const defaultProject = computed(() => projects.value.find(p => p.isDefault) ?? null);
  const remoteProjects = computed(() => projects.value.filter(p => p.isRemote && !p.isArchived));

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

  function sortInPlace() {
    projects.value.sort((a, b) => {
      // Default project first
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  async function create(req: CreateProjectRequest) {
    const created = await projectsApi.create(req);
    projects.value.push(created);
    sortInPlace();
    return created;
  }

  async function update(id: string, req: UpdateProjectRequest) {
    const updated = await projectsApi.update(id, req);
    const idx = projects.value.findIndex(p => p.id === id);
    if (idx >= 0) {
      projects.value[idx] = updated;
    }
    sortInPlace();
    return updated;
  }

  async function remove(id: string) {
    await projectsApi.remove(id);
    projects.value = projects.value.filter(p => p.id !== id);
  }

  return { projects, loading, error, defaultProject, remoteProjects, load, create, update, remove };
});
