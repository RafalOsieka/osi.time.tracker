import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

import type { TimeEntry } from '../api/types';

export interface GroupedEntry {
  remoteId: string;
  itemId: string;
  itemName: string;
  projectId: string;
  projectName: string;
  spentOn: string; // YYYY-MM-DD
  rawSeconds: number;
  entries: TimeEntry[];
}

export interface PublishConfig {
  target: 1 | 2; // 1 = Redmine, 2 = OpenProject
  baseUrl: string;
  token: string;
  remember: boolean;
  activityId?: string;
}

export const usePublishStore = defineStore('publish', () => {
  const config = ref<PublishConfig>({
    target: 1,
    baseUrl: '',
    token: '',
    remember: false,
  });

  // Load config from localStorage
  const savedConfig = localStorage.getItem('publish_config');
  if (savedConfig) {
    try {
      const parsed = JSON.parse(savedConfig);
      config.value = { ...config.value, ...parsed };
      if (!config.value.remember) {
        config.value.token = '';
      }
    } catch (e) {
      console.error('Failed to parse publish config', e);
    }
  }

  // Persist config
  watch(
    config,
    (val) => {
      const toSave = { ...val };
      if (!val.remember) {
        toSave.token = '';
      }
      localStorage.setItem('publish_config', JSON.stringify(toSave));
    },
    { deep: true }
  );

  function groupEntries(entries: TimeEntry[]): GroupedEntry[] {
    const unpublished = entries.filter((e) => !e.published && e.endUtc && e.item);
    const groups: Record<string, GroupedEntry> = {};

    for (const e of unpublished) {
      const item = e.item!;
      const startDate = new Date(e.startUtc);
      const spentOn = `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}-${startDate.getDate().toString().padStart(2, '0')}`;
      const key = `${item.remoteId}_${spentOn}`;

      if (!groups[key]) {
        groups[key] = {
          remoteId: item.remoteId,
          itemId: item.id,
          itemName: item.name,
          projectId: e.projectId,
          projectName: e.project?.name ?? 'Unknown',
          spentOn,
          rawSeconds: 0,
          entries: [],
        };
      }
      const duration = (new Date(e.endUtc!).getTime() - startDate.getTime()) / 1000;
      groups[key].rawSeconds += duration;
      groups[key].entries.push(e);
    }

    return Object.values(groups).sort((a, b) => a.spentOn.localeCompare(b.spentOn) || a.itemName.localeCompare(b.itemName));
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
    const titles = [...new Set(entries.map((e) => e.title.trim()))].filter(Boolean);
    let result = titles.join('; ');
    if (result.length > 800) {
      result = result.substring(0, 797) + '...';
    }
    return result;
  }

  return {
    config,
    groupEntries,
    roundToNearest15,
    formatIsoDuration,
    joinComments,
  };
});
