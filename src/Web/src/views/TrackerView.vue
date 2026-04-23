<script setup lang="ts">
import EntriesList from '../components/EntriesList.vue';
import TimerBar from '../components/TimerBar.vue';
</script>

<template>
  <div class="min-h-screen bg-slate-50 p-4 transition-colors duration-300 dark:bg-slate-950">
    <div class="mx-auto flex max-w-4xl flex-col gap-4">
      <header class="flex items-center gap-3">
        <div class="bg-primary flex h-10 w-10 items-center justify-center rounded-xl">
          <i class="pi pi-clock text-primary-contrast text-xl"></i>
        </div>
        <div>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Osi Time Tracker</h1>
          <p class="text-sm text-slate-500">Track your time across projects and items.</p>
        </div>
      </header>

      <TimerBar />
      <EntriesList />
    </div>
  </div>
</template>
