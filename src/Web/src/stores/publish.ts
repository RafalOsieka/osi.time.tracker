import { defineStore } from 'pinia';

import type { Project, TimeEntry } from '../api/types';

export interface GroupedEntry {
  projectId: string;
  projectName: string;
  itemId: string;
  itemTitle: string;
  remoteId: string; // required for publishing
  spentOn: string; // YYYY-MM-DD
  rawSeconds: number;
  entries: TimeEntry[];
}

export const usePublishStore = defineStore('publish', () => {
  /**
   * Group unpublished, completed entries by (project, item, day).
   * Items must have a remoteId, and their owning project must be remote-configured.
   */
  function groupEntries(
    entries: TimeEntry[],
    projects: Project[],
    itemsById: Map<string, { id: string; title: string; projectId: string; remoteId: string | null }>
  ): GroupedEntry[] {
    const projectsById = new Map(projects.map(p => [p.id, p]));
    const groups: Record<string, GroupedEntry> = {};

    for (const e of entries) {
      if (e.published || !e.endUtc) continue;
      const item = itemsById.get(e.itemId) ?? e.item;
      if (!item || !item.remoteId) continue;
      const project = projectsById.get(item.projectId);
      if (!project || !project.isRemote) continue;

      const startDate = new Date(e.startUtc);
      const spentOn = `${startDate.getFullYear()}-${(startDate.getMonth() + 1)
        .toString()
        .padStart(2, '0')}-${startDate.getDate().toString().padStart(2, '0')}`;
      const key = `${item.id}_${spentOn}`;

      if (!groups[key]) {
        groups[key] = {
          projectId: project.id,
          projectName: project.name,
          itemId: item.id,
          itemTitle: item.title,
          remoteId: item.remoteId,
          spentOn,
          rawSeconds: 0,
          entries: [],
        };
      }
      const duration = (new Date(e.endUtc).getTime() - startDate.getTime()) / 1000;
      groups[key].rawSeconds += duration;
      groups[key].entries.push(e);
    }

    return Object.values(groups).sort(
      (a, b) =>
        a.spentOn.localeCompare(b.spentOn) ||
        a.projectName.localeCompare(b.projectName) ||
        a.itemTitle.localeCompare(b.itemTitle)
    );
  }

  function roundToNearest15(seconds: number): number {
    if (seconds <= 0) return 0;
    const minutes = seconds / 60;
    const steps = Math.round(minutes / 15);
    return Math.max(1, steps) * 15;
  }

  function formatIsoDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `PT${h}H${m}M`;
    if (h > 0) return `PT${h}H`;
    return `PT${m}M`;
  }

  function joinComments(entries: TimeEntry[]): string {
    const titles = [...new Set(entries.map(e => e.title.trim()))].filter(Boolean);
    let result = titles.join('; ');

    const LIMIT = 255;
    if (result.length > LIMIT) {
      let current = '';
      let added = 0;
      for (let i = 0; i < titles.length; i++) {
        const next = current ? current + '; ' + titles[i] : titles[i];
        if (next.length > LIMIT - 15) break;
        current = next;
        added++;
      }
      const remaining = titles.length - added;
      result = current + (remaining > 0 ? `; +${remaining} more` : '');
      if (result.length > LIMIT) result = result.substring(0, LIMIT - 3) + '...';
    }
    return result;
  }

  return {
    groupEntries,
    roundToNearest15,
    formatIsoDuration,
    joinComments,
  };
});
