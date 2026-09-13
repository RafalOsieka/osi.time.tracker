import { z } from 'zod';
import type { JsonValue, RemoteTrackerAdapter } from '@osi/remote-trackers/contracts';
import type { TrackerSeeder } from '../executor.js';
import type { ClientFixture } from '../fixture/types.js';
import type { JsonHttp } from '../http.js';
import { normalizeComment, type RemoteState } from '../planner.js';

const PAGE = 100;

/** Stock projects OpenProject seeds on first boot; removed so the fixture stands alone. */
export const OPENPROJECT_DEMO_IDENTIFIERS: readonly string[] = [
  'demo-project',
  'your-scrum-project',
];

const projectsPageSchema = z.object({
  total: z.number(),
  _embedded: z.object({
    elements: z.array(z.object({ id: z.number(), identifier: z.string() })),
  }),
});

const workPackagesPageSchema = z.object({
  total: z.number(),
  _embedded: z.object({
    elements: z.array(z.object({ id: z.number(), subject: z.string(), lockVersion: z.number() })),
  }),
});

const statusesSchema = z.object({
  _embedded: z.object({
    elements: z.array(z.object({ id: z.number(), name: z.string(), isClosed: z.boolean() })),
  }),
});

const projectTypesSchema = z.object({
  _embedded: z.object({ elements: z.array(z.object({ id: z.number(), name: z.string() })) }),
});

const createdSchema = z.object({ id: z.number(), lockVersion: z.number().optional() });
const emptySchema = z.unknown();

export interface OpenProjectSeederDeps {
  http: JsonHttp;
  adapter: RemoteTrackerAdapter;
  baseUrl: string;
  fixture: ClientFixture;
  /** Waits between polls while a deleted project disappears. */
  sleep: (ms: number) => Promise<void>;
}

/** Filter for "every work package of this project, subprojects excluded". */
export function workPackageFilters(): string {
  return JSON.stringify([
    { status: { operator: '*', values: [] } },
    { subprojectId: { operator: '!*', values: [] } },
  ]);
}

/**
 * OpenProject side of the seed. Projects, work packages, status changes and
 * demo-project removal use API v3 directly; time logs go through the real
 * `OpenProjectAdapter` (form validation + create, as OSI exports). Project
 * deletion is asynchronous, so it polls until the project is gone.
 */
export function createOpenProjectSeeder(deps: OpenProjectSeederDeps): TrackerSeeder {
  const { http, adapter, baseUrl, fixture, sleep } = deps;
  const api = `${baseUrl}/api/v3`;
  const projectIds = new Map<string, number>();
  const issueIds = new Map<string, number>();
  const activityIds = new Map<string, string>();
  let closedStatusId: number | null = null;

  const issueKey = (projectIdentifier: string, subject: string) =>
    `${projectIdentifier}|${subject}`;

  function projectIdFor(identifier: string): number {
    const id = projectIds.get(identifier);
    if (id === undefined) throw new Error(`project ${identifier} has no remote id yet`);
    return id;
  }

  async function loadActivities(workPackageId: string): Promise<void> {
    if (activityIds.size > 0) return;
    for (const option of await adapter.getActivityOptions(workPackageId)) {
      activityIds.set(option.name, option.id);
    }
  }

  function activityIdFor(index: number): string {
    const name = fixture.activities[index] ?? fixture.activities[0];
    const id = name === undefined ? undefined : activityIds.get(name);
    if (id === undefined) {
      throw new Error(
        `activity "${name}" not found on OpenProject (have: ${[...activityIds.keys()].join(', ')})`,
      );
    }
    return id;
  }

  async function taskTypeHref(projectId: number): Promise<string> {
    const { payload } = await http.request(
      'GET',
      `${api}/projects/${projectId}/types`,
      projectTypesSchema,
    );
    const types = payload?._embedded.elements ?? [];
    const type = types.find((candidate) => candidate.name === 'Task') ?? types[0];
    if (!type) throw new Error(`project ${projectId} has no work package types enabled`);
    return `/api/v3/types/${type.id}`;
  }

  return {
    tracker: 'openproject',
    logConcurrency: 4,

    async readState(window): Promise<RemoteState> {
      const statuses = await http.request('GET', `${api}/statuses`, statusesSchema);
      closedStatusId =
        statuses.payload?._embedded.elements.find((status) => status.isClosed)?.id ?? null;

      const projects: { id: number; identifier: string }[] = [];
      for (let offset = 1; ; offset += 1) {
        const params = new URLSearchParams({ pageSize: String(PAGE), offset: String(offset) });
        const { payload } = await http.request(
          'GET',
          `${api}/projects?${params}`,
          projectsPageSchema,
        );
        if (!payload) break;
        projects.push(...payload._embedded.elements);
        if (projects.length >= payload.total || payload._embedded.elements.length === 0) break;
      }
      projectIds.clear();
      for (const project of projects) projectIds.set(project.identifier, project.id);

      const state: RemoteState = { projects: [], issues: [], logs: [], demoProjects: [] };
      for (const project of projects) {
        const entry = { identifier: project.identifier, remoteId: String(project.id) };
        if (OPENPROJECT_DEMO_IDENTIFIERS.includes(project.identifier))
          state.demoProjects.push(entry);
        else state.projects.push(entry);
      }

      issueIds.clear();
      const fixtureIdentifiers = new Set(fixture.projects.map((project) => project.identifier));
      let anyWorkPackageId: string | null = null;
      for (const project of projects) {
        if (!fixtureIdentifiers.has(project.identifier)) continue;
        for (let offset = 1; ; offset += 1) {
          const params = new URLSearchParams({
            pageSize: String(PAGE),
            offset: String(offset),
            filters: workPackageFilters(),
          });
          const { payload } = await http.request(
            'GET',
            `${api}/projects/${project.id}/work_packages?${params}`,
            workPackagesPageSchema,
          );
          if (!payload) break;
          for (const element of payload._embedded.elements) {
            anyWorkPackageId ??= String(element.id);
            issueIds.set(issueKey(project.identifier, element.subject), element.id);
            state.issues.push({
              remoteId: String(element.id),
              projectIdentifier: project.identifier,
              subject: element.subject,
            });
          }
          if (offset * PAGE >= payload.total || payload._embedded.elements.length === 0) break;
        }
      }
      if (anyWorkPackageId !== null) await loadActivities(anyWorkPackageId);

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
      async deleteDemoProject(project) {
        await http.request('DELETE', `${api}/projects/${project.remoteId}`, emptySchema);
        for (let attempt = 0; attempt < 60; attempt += 1) {
          const { status } = await http.request(
            'GET',
            `${api}/projects/${project.remoteId}`,
            emptySchema,
          );
          if (status === 404) return;
          await sleep(1000);
        }
        throw new Error(
          `project ${project.identifier} still exists after waiting for its deletion`,
        );
      },

      async createProject(project) {
        // OpenProject rejects `_links: null`; an empty object means "top-level".
        const parentLink: JsonValue =
          project.parent === null
            ? {}
            : { parent: { href: `/api/v3/projects/${projectIdFor(project.parent)}` } };
        const body: JsonValue = {
          identifier: project.identifier,
          name: project.name,
          _links: parentLink,
        };
        const { payload } = await http.request('POST', `${api}/projects`, createdSchema, body);
        if (!payload) throw new Error('project creation returned no id');
        projectIds.set(project.identifier, payload.id);
      },

      async createIssue(projectIdentifier, issue, close) {
        const projectId = projectIdFor(projectIdentifier);
        const { payload } = await http.request(
          'POST',
          `${api}/projects/${projectId}/work_packages`,
          createdSchema,
          { subject: issue.subject, _links: { type: { href: await taskTypeHref(projectId) } } },
        );
        if (!payload) throw new Error('work package creation returned no id');
        issueIds.set(issueKey(projectIdentifier, issue.subject), payload.id);
        if (close) {
          if (closedStatusId === null) throw new Error('OpenProject has no closed status');
          await http.request('PATCH', `${api}/work_packages/${payload.id}`, emptySchema, {
            lockVersion: payload.lockVersion ?? 0,
            _links: { status: { href: `/api/v3/statuses/${closedStatusId}` } },
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
            `work package [${log.projectIdentifier}] ${log.issueSubject} has no remote id yet`,
          );
        }
        await loadActivities(String(issueId));
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
