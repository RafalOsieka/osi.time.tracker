<script lang="ts" setup>
import Button from 'primevue/button';
import Card from 'primevue/card';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import DatePicker from 'primevue/datepicker';
import { onMounted, ref } from 'vue';

import { useReportsStore } from '../stores/reports';
import { endOfToday, formatDuration, startOfWeek } from '../utils/time';

const reportsStore = useReportsStore();

const dateRange = ref<Date[]>([startOfWeek(), endOfToday()]);

async function load() {
  if (dateRange.value && dateRange.value[0] && dateRange.value[1]) {
    await reportsStore.loadReports(dateRange.value[0], dateRange.value[1]);
  }
}

onMounted(load);

function exportCsv() {
  const headers = ['Project', 'Item', 'Duration (seconds)', 'Duration (formatted)'];
  const rows = reportsStore.itemReport.map(r => [
    r.projectName,
    r.itemTitle,
    r.totalSeconds,
    formatDuration(r.totalSeconds),
  ]);

  const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `time-report-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <Card>
      <template #content>
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">Range:</span>
            <DatePicker
              v-model="dateRange"
              :manual-input="false"
              icon-display="input"
              selection-mode="range"
              show-icon
              @update:model-value="load"
            />
          </div>
          <Button icon="pi pi-download" label="Export CSV" severity="secondary" @click="exportCsv" />
        </div>
      </template>
    </Card>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <template #title>Daily Totals</template>
        <template #content>
          <DataTable :loading="reportsStore.loading" :value="reportsStore.dailyReport" size="small">
            <Column field="date" header="Date"></Column>
            <Column header="Total Time">
              <template #body="slotProps">
                {{ formatDuration(slotProps.data.totalSeconds) }}
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>

      <Card>
        <template #title>By Item</template>
        <template #content>
          <DataTable :loading="reportsStore.loading" :value="reportsStore.itemReport" size="small">
            <Column field="projectName" header="Project"></Column>
            <Column field="itemTitle" header="Item"></Column>
            <Column header="Total Time">
              <template #body="slotProps">
                {{ formatDuration(slotProps.data.totalSeconds) }}
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>
    </div>

    <div
      v-if="reportsStore.error"
      class="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-300"
    >
      <i class="pi pi-exclamation-circle mt-0.5"></i>
      <span>{{ reportsStore.error }}</span>
    </div>
  </div>
</template>
