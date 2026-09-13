import { describe, expect, it } from 'vitest';
import { CLIENT_FIXTURES, projectDepth, projectsWithIssues } from '../src/fixture/index.js';

describe.each(CLIENT_FIXTURES.map((fixture) => [fixture.clientName, fixture] as const))(
  'fixture %s',
  (_name, fixture) => {
    const identifiers = fixture.projects.map((project) => project.identifier);

    it('has unique identifiers and resolvable parents', () => {
      expect(new Set(identifiers).size).toBe(identifiers.length);
      for (const project of fixture.projects) {
        if (project.parent !== null) expect(identifiers).toContain(project.parent);
      }
    });

    it('is three levels deep with at least two top-level siblings and one internal project', () => {
      const depths = fixture.projects.map((project) => projectDepth(fixture, project));
      expect(Math.max(...depths)).toBe(2);
      expect(depths.filter((depth) => depth === 2).length).toBeGreaterThanOrEqual(4);
      const roots = fixture.projects.filter((project) => project.parent === null);
      expect(roots.length).toBeGreaterThanOrEqual(3);
      const internal = fixture.projects.filter((project) => project.internal);
      expect(internal).toHaveLength(1);
      expect(internal[0]?.parent).toBeNull();
    });

    it('gives every leaf and sibling project 6–8 issues with distinct subjects', () => {
      const withIssues = projectsWithIssues(fixture);
      expect(withIssues.length).toBeGreaterThanOrEqual(6);
      for (const project of withIssues) {
        expect(project.issues.length).toBeGreaterThanOrEqual(6);
        expect(project.issues.length).toBeLessThanOrEqual(8);
        const subjects = project.issues.map((issue) => issue.subject);
        expect(new Set(subjects).size).toBe(subjects.length);
      }
      const containers = fixture.projects.filter((project) => project.issues.length === 0);
      for (const container of containers) {
        expect(fixture.projects.some((project) => project.parent === container.identifier)).toBe(
          true,
        );
      }
    });

    it('keeps at least two never-logged issues per project and comments only on logged ones', () => {
      for (const project of projectsWithIssues(fixture)) {
        const unlogged = project.issues.filter((issue) => issue.arc === 'open-unlogged');
        expect(unlogged.length).toBeGreaterThanOrEqual(2);
        for (const issue of project.issues) {
          if (issue.arc === 'open-unlogged') expect(issue.comments).toHaveLength(0);
          else expect(issue.comments.length).toBeGreaterThanOrEqual(1);
        }
        expect(project.issues.some((issue) => issue.arc === 'in-progress')).toBe(true);
        expect(project.issues.some((issue) => issue.arc === 'closed-early')).toBe(true);
      }
    });

    it('names at least two activities', () => {
      expect(fixture.activities.length).toBeGreaterThanOrEqual(2);
    });
  },
);
