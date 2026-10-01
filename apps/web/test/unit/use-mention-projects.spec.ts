import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectDto } from '../../shared/types/project';

const fetchMock = vi.fn();

vi.stubGlobal('$fetch', fetchMock);

const { useMentionProjects } = await import('../../app/composables/use-mention-projects');

function project(id: string, name: string): ProjectDto {
  return {
    id,
    name,
    trackerId: null,
    trackerName: null,
    remoteProjectId: null,
    remoteProjectTitle: null,
    recentTrackedSeconds: 0,
    createdAt: '',
  };
}

describe('useMentionProjects', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('loads the project list', async () => {
    fetchMock.mockResolvedValue([project('1', 'Helios')]);
    const { projects, load } = useMentionProjects();
    await load();
    expect(fetchMock).toHaveBeenCalledWith('/api/projects');
    expect(projects.value.map((p) => p.name)).toEqual(['Helios']);
  });

  it('keeps the previous list when a reload fails, and replaces it on success', async () => {
    fetchMock.mockResolvedValueOnce([project('1', 'Helios')]);
    const { projects, load } = useMentionProjects();
    await load();

    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(load()).resolves.toBeUndefined();
    expect(projects.value.map((p) => p.name)).toEqual(['Helios']);

    fetchMock.mockResolvedValueOnce([project('2', 'Nordwind')]);
    await load();
    expect(projects.value.map((p) => p.name)).toEqual(['Nordwind']);
  });
});
