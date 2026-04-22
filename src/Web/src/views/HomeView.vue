<script setup lang="ts">
import ky from 'ky';
import Button from 'primevue/button';
import { ref } from 'vue';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const weatherData = ref<any[] | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

async function fetchWeather() {
  loading.value = true;
  error.value = null;
  weatherData.value = null;

  try {
    // Using ky as requested
    weatherData.value = await ky.get('/api/weatherforecast').json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    error.value = e.message || 'Failed to fetch weather forecast';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div
    class="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 transition-colors duration-300 dark:bg-slate-950"
  >
    <div
      class="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900"
    >
      <div class="flex flex-col items-center gap-2">
        <div class="bg-primary shadow-primary/20 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg">
          <i class="pi pi-clock text-primary-contrast text-3xl"></i>
        </div>
        <h1 class="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">Osi Time Tracker</h1>
        <p class="text-center text-balance text-slate-500 dark:text-slate-400">
          Manage your time efficiently with a modern and simple interface.
        </p>
      </div>

      <div class="h-px w-full bg-slate-100 dark:bg-slate-800"></div>

      <div class="flex w-full flex-col gap-3">
        <Button
          label="Fetch Weather Forecast"
          icon="pi pi-cloud-download"
          class="w-full py-3 text-lg font-medium"
          :loading="loading"
          @click="fetchWeather"
        />

        <p class="text-center text-xs text-slate-400 italic">
          <i class="pi pi-info-circle mr-1 text-[10px]"></i>
          Test API connection using weather endpoint
        </p>
      </div>

      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="transform scale-95 opacity-0"
        enter-to-class="transform scale-100 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="transform scale-100 opacity-100"
        leave-to-class="transform scale-95 opacity-0"
      >
        <div v-if="weatherData" class="mt-2 w-full">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="text-sm font-bold tracking-wider text-slate-400 uppercase">Forecast</h2>
            <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800">
              {{ weatherData.length }} days
            </span>
          </div>
          <ul class="space-y-2">
            <li
              v-for="(item, index) in weatherData"
              :key="index"
              class="group hover:border-primary/30 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 transition-colors dark:border-slate-800 dark:bg-slate-800/50"
            >
              <div class="flex flex-col">
                <span class="font-semibold text-slate-700 dark:text-slate-200">{{ item.date }}</span>
                <span class="text-xs text-slate-500">{{ item.summary }}</span>
              </div>
              <span class="text-primary text-lg font-bold">{{ item.temperatureC }}°C</span>
            </li>
          </ul>
        </div>
      </Transition>

      <div
        v-if="error"
        class="mt-2 flex w-full items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400"
      >
        <i class="pi pi-exclamation-circle mt-0.5"></i>
        <span>{{ error }}</span>
      </div>
    </div>
  </div>
</template>
