import { describe, expect, it } from 'vitest';
import { formatTaskSuggestionLabel } from '../../app/utils/task-suggestion-label';
import type { TaskDto } from '../../shared/types/task';

function task(overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id: 'task-1',
    name: 'Fix login',
    projectId: null,
    projectName: null,
    createdAt: '',
    ...overrides,
  };
}

describe('formatTaskSuggestionLabel', () => {
  it('includes project context when present', () => {
    expect(formatTaskSuggestionLabel(task({ projectName: 'Portal' }), '(no project)')).toBe(
      'Fix login · Portal',
    );
  });

  it('falls back to the no-project label when the task has no project', () => {
    expect(formatTaskSuggestionLabel(task(), '(no project)')).toBe('Fix login · (no project)');
  });

  it('appends the remote issue id when present', () => {
    expect(
      formatTaskSuggestionLabel(
        task({
          projectName: 'Portal',
          remoteIssueRef: {
            id: 'ref-1',
            taskId: 'task-1',
            userId: 'user-1',
            trackerId: 'cfg-1',
            remoteIssueId: '42',
            cachedTitle: 'Fix login',
            createdAt: '',
            updatedAt: '',
          },
        }),
        '(no project)',
      ),
    ).toBe('Fix login · Portal #42');
  });

  it('distinguishes same-name tasks that differ only by remote issue', () => {
    const base = {
      name: 'title1',
      projectId: 'p1',
      projectName: 'Portal',
    } as const;
    const a = formatTaskSuggestionLabel(
      task({
        ...base,
        id: 't-a',
        remoteIssueRef: {
          id: 't-a',
          taskId: 't-a',
          userId: 'u',
          trackerId: 'cfg',
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
          trackerId: 'cfg',
          remoteIssueId: '4899',
          cachedTitle: 'Two',
          createdAt: '',
          updatedAt: '',
        },
      }),
      '(no project)',
    );
    expect(a).toBe('title1 · Portal #4711');
    expect(b).toBe('title1 · Portal #4899');
    expect(a).not.toBe(b);
  });
});
