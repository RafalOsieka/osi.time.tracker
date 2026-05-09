<script lang="ts" setup>
import { ref } from 'vue';
import Button from 'primevue/button';
import EntriesList from '../components/EntriesList.vue';
import PublishPanel from '../components/PublishPanel.vue';
import TimerBar from '../components/TimerBar.vue';
import SettingsPanel from '../components/SettingsPanel.vue';
import ReportsPanel from '../components/ReportsPanel.vue';

const activeView = ref<'tracker' | 'reports' | 'settings'>('tracker');
</script>

<template>
  <div class="min-h-screen bg-slate-50 p-4 transition-colors duration-300 dark:bg-slate-950">
    <div class="mx-auto flex max-w-4xl flex-col gap-4">
      <header class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="bg-primary flex h-10 w-10 items-center justify-center rounded-xl">
            <i class="pi pi-clock text-primary-contrast text-xl"></i>
          </div>
          <div>
            <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Osi Time Tracker</h1>
            <p class="text-sm text-slate-500">Track your time across projects and items.</p>
          </div>
        </div>
        <div class="flex gap-2">
          <Button :text="activeView !== 'tracker'" icon="pi pi-clock" label="Tracker" @click="activeView = 'tracker'" />
          <Button
            :text="activeView !== 'reports'"
            icon="pi pi-chart-bar"
            label="Reports"
            @click="activeView = 'reports'"
          />
          <Button
            :text="activeView !== 'settings'"
            icon="pi pi-cog"
            label="Settings"
            @click="activeView = 'settings'"
          />
        </div>
      </header>

      <template v-if="activeView === 'tracker'">
        <TimerBar />
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div class="lg:col-span-2">
            <EntriesList />
          </div>
          <div>
            <PublishPanel />
          </div>
        </div>
      </template>

      <template v-else-if="activeView === 'reports'">
        <ReportsPanel />
      </template>

      <template v-else-if="activeView === 'settings'">
        <SettingsPanel />
      </template>
    </div>
  </div>
</template>
