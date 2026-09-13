import { HELIOS } from './helios.js';
import { NORDWIND } from './nordwind.js';
import type { ClientFixture, ProjectFixture } from './types.js';

export type { ArcSlot, ClientFixture, IssueFixture, ProjectFixture, TrackerKey } from './types.js';
export { HELIOS, NORDWIND };

/** One client per local tracker. */
export const CLIENT_FIXTURES: readonly ClientFixture[] = [NORDWIND, HELIOS];

/** Depth of a project in its tree: 0 for top-level. */
export function projectDepth(fixture: ClientFixture, project: ProjectFixture): number {
  let depth = 0;
  let current = project;
  while (current.parent !== null) {
    const parentId = current.parent;
    const parent = fixture.projects.find((candidate) => candidate.identifier === parentId);
    if (!parent) throw new Error(`fixture: unknown parent ${parentId} for ${current.identifier}`);
    current = parent;
    depth += 1;
  }
  return depth;
}

/** Projects that carry issues (leaves and siblings), in fixture order. */
export function projectsWithIssues(fixture: ClientFixture): ProjectFixture[] {
  return fixture.projects.filter((project) => project.issues.length > 0);
}
