<script setup lang="ts">
import Button from 'primevue/button'
import HelloWorld from './components/HelloWorld.vue'
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-screen bg-slate-50">
    <div class="p-8 bg-white rounded-xl shadow-lg flex flex-col items-center gap-4">
      <h1 class="text-3xl font-bold text-primary">PrimeVue + Tailwind 4</h1>
      <Button label="Click Me" icon="pi pi-check" class="w-full" />
      <p class="text-slate-500 italic">
        <i class="pi pi-info-circle mr-1"></i>
        If you see a styled button and icons, setup is successful!
      </p>
    </div>
    <HelloWorld class="mt-8" />
  </div>
</template>
