import type { ProjectDto } from '../../shared/types/project';
import type { TrackerDto } from '../../shared/types/tracker';

export function fetchProjects(): Promise<ProjectDto[]> {
  return $fetch<ProjectDto[]>('/api/projects');
}

export function fetchTrackers(): Promise<TrackerDto[]> {
  return $fetch<TrackerDto[]>('/api/trackers');
}
