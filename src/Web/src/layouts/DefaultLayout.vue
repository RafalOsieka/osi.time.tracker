<script lang="ts" setup>
import { RouterView } from 'vue-router';

import AppSidebar from '../components/AppSidebar.vue';
</script>

<template>
  <div class="flex h-screen flex-col bg-slate-50 dark:bg-slate-950 lg:flex-row">
    <AppSidebar />
    <main class="flex-1 overflow-y-auto p-4">
      <RouterView />
    </main>
  </div>
</template>
