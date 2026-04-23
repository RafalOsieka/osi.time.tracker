import { defineStore } from 'pinia';
import { ref } from 'vue';

import { reportsApi } from '../api/client';
import type { DailyReportDto, ItemReportDto } from '../api/types';

export const useReportsStore = defineStore('reports', () => {
  const dailyReport = ref<DailyReportDto[]>([]);
  const itemReport = ref<ItemReportDto[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function loadReports(from: Date, to: Date) {
    loading.value = true;
    error.value = null;
    try {
      const fromStr = from.toISOString();
      const toStr = to.toISOString();
      const [daily, item] = await Promise.all([
        reportsApi.getDaily(fromStr, toStr),
        reportsApi.getItem(fromStr, toStr),
      ]);
      dailyReport.value = daily;
      itemReport.value = item;
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }

  return { dailyReport, itemReport, loading, error, loadReports };
});
