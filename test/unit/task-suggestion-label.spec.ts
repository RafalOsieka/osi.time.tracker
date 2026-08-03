import { describe, expect, it } from 'vitest';
import { formatTaskSuggestionLabel } from '../../app/utils/taskSuggestionLabel';
import type { TaskDto } from '../../shared/types/task';

function task(overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id: 'task-1',
    name: 'Fix login',
    projectId: null,
    projectName: null,
    clientName: null,
    createdAt: '',
    ...overrides,
  };
}

describe('formatTaskSuggestionLabel', () => {
  it('includes project and client context when present', () => {
    expect(
      formatTaskSuggestionLabel(
        task({ projectName: 'Portal', clientName: 'Acme' }),
        '(no project)',
      ),
    ).toBe('Fix login · Portal · Acme');
  });

  it('falls back to the no-project label when the task has no project', () => {
    expect(formatTaskSuggestionLabel(task(), '(no project)')).toBe('Fix login · (no project)');
  });

  it('appends the remote issue id when present', () => {
    expect(
      formatTaskSuggestionLabel(
        task({
          projectName: 'Portal',
          clientName: 'Acme',
          remoteIssueRef: {
            id: 'ref-1',
            taskId: 'task-1',
            userId: 'user-1',
            remoteSystemConfigId: 'cfg-1',
            remoteIssueId: '42',
            cachedTitle: 'Fix login',
            createdAt: '',
            updatedAt: '',
          },
        }),
        '(no project)',
      ),
    ).toBe('Fix login · Portal · Acme #42');
  });

  it('distinguishes same-name tasks that differ only by remote issue', () => {
    const base = {
      name: 'title1',
      projectId: 'p1',
      projectName: 'Portal',
      clientName: 'Acme',
    } as const;
    const a = formatTaskSuggestionLabel(
      task({
        ...base,
        id: 't-a',
        remoteIssueRef: {
          id: 't-a',
          taskId: 't-a',
          userId: 'u',
          remoteSystemConfigId: 'cfg',
          remoteIssueId: '4711',
          cachedTitle: 'One',
          createdAt: '',
          updatedAt: '',
        },
      }),
      '(no project)',
    );
    const b = formatTaskSuggestionLabel(
      task({
        ...base,
        id: 't-b',
        remoteIssueRef: {
          id: 't-b',
          taskId: 't-b',
          userId: 'u',
          remoteSystemConfigId: 'cfg',
          remoteIssueId: '4899',
          cachedTitle: 'Two',
          createdAt: '',
          updatedAt: '',
        },
      }),
      '(no project)',
    );
    expect(a).toBe('title1 · Portal · Acme #4711');
    expect(b).toBe('title1 · Portal · Acme #4899');
    expect(a).not.toBe(b);
  });
});
