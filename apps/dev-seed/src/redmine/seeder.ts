import { z } from 'zod';
import type { RemoteTrackerAdapter } from '@osi/remote-trackers/contracts';
import type { TrackerSeeder } from '../executor.js';
import type { ClientFixture } from '../fixture/types.js';
import type { JsonHttp } from '../http.js';
import { normalizeComment, type RemoteState } from '../planner.js';

const PAGE = 100;

const projectsPageSchema = z.object({
  projects: z.array(
    z.object({
      id: z.number(),
      identifier: z.string(),
      parent: z.object({ id: z.number() }).optional(),
    }),
  ),
  total_count: z.number(),
});

const issuesPageSchema = z.object({
  issues: z.array(z.object({ id: z.number(), subject: z.string() })),
  total_count: z.number(),
});

const trackersSchema = z.object({
  trackers: z.array(z.object({ id: z.number(), name: z.string() })),
});

const statusesSchema = z.object({
  issue_statuses: z.array(z.object({ id: z.number(), name: z.string(), is_closed: z.boolean() })),
});

const createdProjectSchema = z.object({ project: z.object({ id: z.number() }) });
const createdIssueSchema = z.object({ issue: z.object({ id: z.number() }) });
const emptySchema = z.unknown();

export interface RedmineSeederDeps {
  http: JsonHttp;
  adapter: RemoteTrackerAdapter;
  baseUrl: string;
  fixture: ClientFixture;
}

/**
 * Redmine side of the seed. Projects, issues and status changes go through
 * the JSON API directly (OSI never creates those); time logs go through the
 * real `RedmineAdapter`, i.e. the path OSI uses to export. Remote ids of
 * projects and issues are cached as they are read or created so later
 * operations can reference fixture keys only.
 */
export function createRedmineSeeder(deps: RedmineSeederDeps): TrackerSeeder {
  const { http, adapter, baseUrl, fixture } = deps;
  const projectIds = new Map<string, number>();
  const issueIds = new Map<string, number>();
  const activityIds = new Map<string, string>();
  let trackerIds: number[] = [];
  let closedStatusId: number | null = null;

  const issueKey = (projectIdentifier: string, subject: string) =>
    `${projectIdentifier}|${subject}`;

  async function listAll<T>(
    fetchPage: (offset: number) => Promise<{ items: T[]; total: number } | null>,
  ): Promise<T[]> {
    const items: T[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const page = await fetchPage(offset);
      if (!page) break;
      items.push(...page.items);
      if (items.length >= page.total || page.items.length === 0) break;
    }
    return items;
  }

  async function loadEnumerations(): Promise<void> {
    const trackers = await http.request('GET', `${baseUrl}/trackers.json`, trackersSchema);
    trackerIds = trackers.payload?.trackers.map((tracker) => tracker.id) ?? [];
    const statuses = await http.request('GET', `${baseUrl}/issue_statuses.json`, statusesSchema);
    closedStatusId =
      statuses.payload?.issue_statuses.find((status) => status.is_closed)?.id ?? null;
    for (const option of await adapter.getActivityOptions('0')) {
      activityIds.set(option.name, option.id);
    }
  }

  function activityIdFor(index: number): string {
    const name = fixture.activities[index] ?? fixture.activities[0];
    const id = name === undefined ? undefined : activityIds.get(name);
    if (id === undefined) {
      throw new Error(
        `activity "${name}" not found on Redmine (have: ${[...activityIds.keys()].join(', ')})`,
      );
    }
    return id;
  }

  function projectIdFor(identifier: string): number {
    const id = projectIds.get(identifier);
    if (id === undefined) throw new Error(`project ${identifier} has no remote id yet`);
    return id;
  }

  return {
    tracker: 'redmine',
    logConcurrency: 1,

    async readState(window): Promise<RemoteState> {
      await loadEnumerations();
      const projects = await listAll(async (offset) => {
        const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
        const { payload } = await http.request(
          'GET',
          `${baseUrl}/projects.json?${params}`,
          projectsPageSchema,
        );
        return payload ? { items: payload.projects, total: payload.total_count } : null;
      });
      projectIds.clear();
      for (const project of projects) projectIds.set(project.identifier, project.id);

      const state: RemoteState = { projects: [], issues: [], logs: [], demoProjects: [] };
      for (const project of projects) {
        state.projects.push({ identifier: project.identifier, remoteId: String(project.id) });
      }

      issueIds.clear();
      const fixtureIdentifiers = new Set(fixture.projects.map((project) => project.identifier));
      for (const project of projects) {
        if (!fixtureIdentifiers.has(project.identifier)) continue;
        const issues = await listAll(async (offset) => {
          const params = new URLSearchParams({
            project_id: String(project.id),
            status_id: '*',
            subproject_id: '!*',
            limit: String(PAGE),
            offset: String(offset),
          });
          const { payload } = await http.request(
            'GET',
            `${baseUrl}/issues.json?${params}`,
            issuesPageSchema,
          );
          return payload ? { items: payload.issues, total: payload.total_count } : null;
        });
        for (const issue of issues) {
          issueIds.set(issueKey(project.identifier, issue.subject), issue.id);
          state.issues.push({
            remoteId: String(issue.id),
            projectIdentifier: project.identifier,
            subject: issue.subject,
          });
        }
      }

      for (const log of await adapter.fetchTimeLogsInRange({ from: window.from, to: window.to })) {
        state.logs.push({
          remoteLogId: log.remoteLogId,
          issueRemoteId: log.remoteIssueId,
          spentOn: log.spentOn,
          comment: normalizeComment(log.comment),
        });
      }
      return state;
    },

    handlers: {
      async deleteDemoProject() {
        // Redmine ships no demo projects; nothing to do.
      },

      async createProject(project) {
        const { payload } = await http.request(
          'POST',
          `${baseUrl}/projects.json`,
          createdProjectSchema,
          {
            project: {
              name: project.name,
              identifier: project.identifier,
              parent_id: project.parent === null ? null : projectIdFor(project.parent),
              is_public: true,
              inherit_members: true,
              enabled_module_names: ['issue_tracking', 'time_tracking'],
              tracker_ids: trackerIds,
            },
          },
        );
        if (!payload) throw new Error('project creation returned no id');
        projectIds.set(project.identifier, payload.project.id);
      },

      async createIssue(projectIdentifier, issue, close) {
        const trackerId = trackerIds[1] ?? trackerIds[0];
        if (trackerId === undefined) throw new Error('Redmine has no issue trackers configured');
        const { payload } = await http.request(
          'POST',
          `${baseUrl}/issues.json`,
          createdIssueSchema,
          {
            issue: {
              project_id: projectIdFor(projectIdentifier),
              subject: issue.subject,
              tracker_id: trackerId,
            },
          },
        );
        if (!payload) throw new Error('issue creation returned no id');
        issueIds.set(issueKey(projectIdentifier, issue.subject), payload.issue.id);
        if (close) {
          if (closedStatusId === null) throw new Error('Redmine has no closed issue status');
          await http.request('PUT', `${baseUrl}/issues/${payload.issue.id}.json`, emptySchema, {
            issue: { status_id: closedStatusId },
          });
        }
      },

      async deleteLog(log) {
        const outcome = await adapter.deleteTimeEntry(log.remoteLogId);
        if (outcome.status !== 'deleted' && outcome.status !== 'not_found') {
          throw new Error(`delete returned ${outcome.status} (${outcome.messageKey})`);
        }
      },

      async createLog(log) {
        const issueId = issueIds.get(issueKey(log.projectIdentifier, log.issueSubject));
        if (issueId === undefined) {
          throw new Error(
            `issue [${log.projectIdentifier}] ${log.issueSubject} has no remote id yet`,
          );
        }
        await adapter.createTimeEntry({
          remoteIssueId: String(issueId),
          spentOn: log.spentOn,
          durationSeconds: log.durationSeconds,
          activityId: activityIdFor(log.activityIndex),
          comment: log.comment ?? undefined,
        });
      },
    },
  };
}
