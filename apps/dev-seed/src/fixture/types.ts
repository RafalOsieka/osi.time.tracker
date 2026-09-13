export type TrackerKey = 'redmine' | 'openproject';

/**
 * Where an issue sits in the three-month story. Determines its final status
 * and which part of the range its logs fall into (design.md — D4):
 * `closed-early` first ~40 %, `closed-mid` ~30–75 %, `in-progress` last ~40 %,
 * `open-unlogged` never logged so OSI can link it without prior history.
 */
export type ArcSlot = 'closed-early' | 'closed-mid' | 'in-progress' | 'open-unlogged';

export interface IssueFixture {
  subject: string;
  arc: ArcSlot;
  /**
   * Work-note style comments used as log comments. The first is the issue's
   * "main" note, repeated across days so OSI reuses one Task for it.
   */
  comments: readonly string[];
}

export interface ProjectFixture {
  identifier: string;
  name: string;
  /** Parent identifier; `null` for top-level projects. */
  parent: string | null;
  /** Never scoped in OSI; its logs stay unmatched on import. */
  internal: boolean;
  /** Empty for container projects that only group children. */
  issues: readonly IssueFixture[];
}

export interface ClientFixture {
  tracker: TrackerKey;
  clientName: string;
  /** Activity names to rotate through, resolved by name on the tracker. */
  activities: readonly string[];
  projects: readonly ProjectFixture[];
}
