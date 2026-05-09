<script lang="ts" setup>
import { RouterView } from 'vue-router';

import AppSidebar from '../components/AppSidebar.vue';
</script>

<template>
  <div class="flex h-screen flex-col lg:flex-row" style="background-color: var(--ds-bg-base); color: var(--ds-text-hi)">
    <AppSidebar />
    <main class="flex-1 overflow-y-auto p-4">
      <RouterView />
    </main>
  </div>
</template>
