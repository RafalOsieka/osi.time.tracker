/**
 * Adapter-neutral remote-project catalog entry, returned by
 * `RemoteTrackerAdapter.listProjects()`. `parentId` is present only when the
 * provider reports a parent project, letting callers render an indented
 * hierarchy without any other provider-specific data crossing the boundary.
 */
export interface RemoteProjectDto {
  remoteProjectId: string;
  title: string;
  parentId?: string;
}
