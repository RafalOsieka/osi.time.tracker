/**
 * Pure helpers for `@project` mentions in time-entry titles (REQ-372–REQ-375).
 * Shared by the top-bar timer and the add-entry dialog; no Vue dependency.
 */

/** Maximum projects listed while the overlay is in project mode (REQ-372). */
export const MENTION_MAX_RESULTS = 5;

/** The fields of a project that mention matching and ranking depend on. */
export interface MentionProject {
  name: string;
  recentTrackedSeconds: number;
}

export interface MentionToken {
  /** Index of the `@` character. */
  start: number;
  /** Index just after the last character of the token (the caret). */
  end: number;
  /** Text between the `@` and `end`; may contain spaces. */
  query: string;
}

/** Lowercase, strip diacritics, and drop whitespace, `-` and `_` (REQ-373). */
export function normalizeMentionText(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      // NFD does not decompose `ł`, so fold it explicitly.
      .replace(/ł/g, 'l')
      .replace(/[\s_-]/g, '')
  );
}

/** An `@` opens a mention only at the start of the text or right after whitespace. */
function isMentionStart(text: string, index: number): boolean {
  return text[index] === '@' && (index === 0 || /\s/.test(text.charAt(index - 1)));
}

function lastMentionStart(text: string, limit: number): number {
  for (let index = Math.min(limit, text.length) - 1; index >= 0; index--) {
    if (isMentionStart(text, index)) return index;
  }
  return -1;
}

/** Finds the mention token that ends at the caret, or `null` (REQ-372). */
export function findMentionAtCaret(text: string, caret: number): MentionToken | null {
  const start = lastMentionStart(text, caret);
  if (start === -1) return null;
  return { start, end: caret, query: text.slice(start + 1, caret) };
}

function matchTier(name: string, query: string): number {
  if (normalizeMentionText(name).startsWith(query)) return 0;
  const wordMatch = name
    .split(/[\s_-]+/)
    .some((word) => normalizeMentionText(word).startsWith(query));
  if (wordMatch) return 1;
  return normalizeMentionText(name).includes(query) ? 2 : -1;
}

/**
 * Projects matching `query`, ordered by match tier, recent tracked time
 * (descending), then name (REQ-373). An empty query matches everything.
 */
export function rankMentionProjects<T extends MentionProject>(
  projects: readonly T[],
  query: string,
  limit = MENTION_MAX_RESULTS,
): T[] {
  const normalizedQuery = normalizeMentionText(query);
  return projects
    .map((project) => ({ project, tier: matchTier(project.name, normalizedQuery) }))
    .filter(({ tier }) => tier !== -1)
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        b.project.recentTrackedSeconds - a.project.recentTrackedSeconds ||
        a.project.name.localeCompare(b.project.name),
    )
    .slice(0, limit)
    .map(({ project }) => project);
}

/**
 * Removes `[start, end)` from `text` and collapses the whitespace left at the
 * seam, leaving the rest of the title untouched.
 */
export function removeMention(text: string, start: number, end: number): string {
  const before = text.slice(0, start).trimEnd();
  const after = text.slice(end).trimStart();
  return before && after ? `${before} ${after}` : `${before}${after}`;
}

export interface ResolvedMention<T extends MentionProject> {
  title: string;
  project: T;
}

/**
 * Resolves the last mention token of `text` when its longest word-prefix equals
 * exactly one project's normalized name (REQ-375). Partial or ambiguous names
 * return `null` so the text stays literal.
 */
export function resolveTypedMention<T extends MentionProject>(
  text: string,
  projects: readonly T[],
): ResolvedMention<T> | null {
  const start = lastMentionStart(text, text.length);
  if (start === -1) return null;

  const rest = text.slice(start + 1);
  // End offset (within `rest`) of each successive word.
  const wordEnds = [...rest.matchAll(/\S+/g)].map((match) => match.index + match[0].length);

  for (let count = wordEnds.length; count >= 1; count--) {
    const end = wordEnds[count - 1] ?? 0;
    const candidate = normalizeMentionText(rest.slice(0, end));
    if (!candidate) continue;
    const matches = projects.filter((project) => normalizeMentionText(project.name) === candidate);
    const [project] = matches;
    if (matches.length === 1 && project) {
      return { title: removeMention(text, start, start + 1 + end), project };
    }
  }
  return null;
}

/** Project shown in the title input's chip (REQ-374). */
export interface TitleProject {
  id: string;
  name: string;
}

/** Suggestion bound to the title text by identity (REQ-180). */
export interface TitleTask {
  id: string;
  name: string;
}
