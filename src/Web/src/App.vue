<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import HelloWorld from './components/HelloWorld.vue'

const weatherData = ref<any[] | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function fetchWeather() {
  loading.value = true
  error.value = null
  weatherData.value = null
  
  try {
    const response = await fetch('/api/weatherforecast')
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    weatherData.value = await response.json()
  } catch (e: any) {
    error.value = e.message || 'Failed to fetch weather forecast'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
    <div class="p-8 bg-white rounded-xl shadow-lg flex flex-col items-center gap-4 w-full max-w-md">
      <h1 class="text-3xl font-bold text-primary text-center">PrimeVue + Tailwind 4</h1>
      
      <Button 
        label="Fetch Weather Forecast" 
        icon="pi pi-cloud-download" 
        class="w-full" 
        :loading="loading"
        @click="fetchWeather" 
      />

      <div v-if="weatherData" class="w-full mt-4">
        <h2 class="text-xl font-semibold mb-2">Forecast Results:</h2>
        <ul class="space-y-2">
          <li v-for="(item, index) in weatherData" :key="index" class="p-2 bg-slate-100 rounded text-sm">
            <span class="font-bold">{{ item.date }}</span>: {{ item.temperatureC }}°C ({{ item.summary }})
          </li>
        </ul>
      </div>

      <div v-if="error" class="w-full mt-4 p-4 bg-red-100 text-red-700 rounded-lg border border-red-200">
        <i class="pi pi-exclamation-triangle mr-2"></i>
        {{ error }}
      </div>

      <p class="text-slate-500 italic text-center text-sm">
        <i class="pi pi-info-circle mr-1"></i>
        Requests are proxied from <code class="bg-slate-200 px-1 rounded">/api</code> to the backend.
      </p>
    </div>
    <HelloWorld class="mt-8" />
  </div>
</template>
