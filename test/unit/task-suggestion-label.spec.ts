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
});
