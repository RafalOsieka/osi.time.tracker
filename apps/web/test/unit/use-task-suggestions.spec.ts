import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { TaskDto } from '../../shared/types/task';

const fetchMock = vi.fn();

vi.stubGlobal('$fetch', fetchMock);

const { useTaskSuggestions } = await import('../../app/composables/use-task-suggestions');

const SUGGESTION_DEBOUNCE_MS = 200;

const taskA: TaskDto = {
  id: 'task-a',
  name: 'A Task',
  projectId: null,
  projectName: null,
  createdAt: '',
};
const taskB: TaskDto = {
  id: 'task-b',
  name: 'B Task',
  projectId: null,
  projectName: null,
  createdAt: '',
};

describe('useTaskSuggestions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('issues one request carrying the final text after rapid typing', async () => {
    fetchMock.mockResolvedValue([taskA]);
    const { search } = useTaskSuggestions();

    search('a');
    await vi.advanceTimersByTimeAsync(50);
    search('ab');
    await vi.advanceTimersByTimeAsync(50);
    search('abc');
    await vi.advanceTimersByTimeAsync(SUGGESTION_DEBOUNCE_MS);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/tasks', { query: { search: 'abc' } });
  });

  it('discards a stale response that resolves after a newer request', async () => {
    let resolveFirst: (value: TaskDto[]) => void = () => {};
    let resolveSecond: (value: TaskDto[]) => void = () => {};
    const firstResponse = new Promise<TaskDto[]>((resolve) => {
      resolveFirst = resolve;
    });
    const secondResponse = new Promise<TaskDto[]>((resolve) => {
      resolveSecond = resolve;
    });
    fetchMock.mockImplementationOnce(() => firstResponse);
    fetchMock.mockImplementationOnce(() => secondResponse);

    const { search, suggestions } = useTaskSuggestions();

    search('a');
    await vi.advanceTimersByTimeAsync(SUGGESTION_DEBOUNCE_MS);
    search('ab');
    await vi.advanceTimersByTimeAsync(SUGGESTION_DEBOUNCE_MS);

    // Newer request resolves first with its real result...
    resolveSecond([taskB]);
    await Promise.resolve();
    await Promise.resolve();
    expect(suggestions.value).toEqual([taskB]);

    // ...then the stale response for the superseded search arrives late.
    resolveFirst([taskA]);
    await Promise.resolve();
    await Promise.resolve();

    expect(suggestions.value).toEqual([taskB]);
  });

  it('keeps the previous suggestions when a request fails', async () => {
    fetchMock.mockResolvedValueOnce([taskA]);
    const { search, suggestions } = useTaskSuggestions();

    search('a');
    await vi.advanceTimersByTimeAsync(SUGGESTION_DEBOUNCE_MS);
    expect(suggestions.value).toEqual([taskA]);

    fetchMock.mockRejectedValueOnce(new Error('network error'));
    search('ab');
    await vi.advanceTimersByTimeAsync(SUGGESTION_DEBOUNCE_MS);

    expect(suggestions.value).toEqual([taskA]);
  });
});
