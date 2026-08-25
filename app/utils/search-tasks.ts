import type { TaskDto } from '../../shared/types/task';

export function searchTasks(query: string): Promise<TaskDto[]> {
  return $fetch<TaskDto[]>('/api/tasks', { query: { search: query } });
}
