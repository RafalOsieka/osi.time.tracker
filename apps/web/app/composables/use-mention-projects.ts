import { ref } from 'vue';
import type { ProjectDto } from '../../shared/types/project';

/**
 * Project list backing `@project` mentions (REQ-372). Loaded on demand (input
 * focus / dialog open) and matched client-side. A failed load keeps the last
 * successful list without surfacing an error, so a failure only means `@`
 * stays literal text.
 */
export function useMentionProjects() {
  const projects = ref<ProjectDto[]>([]);

  async function load(): Promise<void> {
    try {
      projects.value = await $fetch<ProjectDto[]>('/api/projects');
    } catch {
      // Keep the previous list; typing must never be interrupted by a toast.
    }
  }

  return { projects, load };
}
