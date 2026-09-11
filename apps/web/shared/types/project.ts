import { z } from 'zod';

export const PROJECT_NAME_MAX_LENGTH = 100;
export const PROJECT_REMOTE_PROJECT_ID_MAX_LENGTH = 64;
export const PROJECT_REMOTE_PROJECT_TITLE_MAX_LENGTH = 200;

export const createProjectSchema = z
  .object({
    name: z
      .string({ error: 'error.projectNameRequired' })
      .trim()
      .min(1, { error: 'error.projectNameRequired' })
      .max(PROJECT_NAME_MAX_LENGTH, { error: 'error.projectNameTooLong' }),
    trackerId: z.uuid({ error: 'error.projectTrackerInvalid' }).nullish(),
    // Optional remote-project scope (REQ-325): a single remote project id +
    // cached title, restricting remote-issue search to that project and its
    // descendants. Both fields SHALL be present together, and only when
    // `trackerId` is set.
    remoteProjectId: z
      .string({ error: 'error.projectRemoteScopeIncomplete' })
      .trim()
      .min(1, { error: 'error.projectRemoteScopeIncomplete' })
      .max(PROJECT_REMOTE_PROJECT_ID_MAX_LENGTH, { error: 'error.projectRemoteScopeIncomplete' })
      .nullish(),
    remoteProjectTitle: z
      .string({ error: 'error.projectRemoteScopeIncomplete' })
      .trim()
      .min(1, { error: 'error.projectRemoteScopeIncomplete' })
      .max(PROJECT_REMOTE_PROJECT_TITLE_MAX_LENGTH, {
        error: 'error.projectRemoteScopeIncomplete',
      })
      .nullish(),
  })
  .refine((value) => Boolean(value.remoteProjectId) === Boolean(value.remoteProjectTitle), {
    error: 'error.projectRemoteScopeIncomplete',
    path: ['remoteProjectId'],
  });
// "Scope requires a tracker" (REQ-325) is enforced per-route rather than here:
// on create there is no existing tracker to fall back on, so `trackerId: null`
// with a scope is always invalid. On update, a request that also changes or
// clears trackerId force-nulls the scope instead of rejecting it (REQ-326) —
// the shared schema cannot tell those two update shapes apart from the body
// alone, since it never sees the project's current trackerId.

export type CreateProjectDto = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema;

export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;

export const listProjectsQuerySchema = z.object({
  trackerId: z.string().optional(),
});

export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;

export interface ProjectDto {
  id: string;
  name: string;
  trackerId: string | null;
  trackerName: string | null;
  remoteProjectId: string | null;
  remoteProjectTitle: string | null;
  createdAt: string;
}
