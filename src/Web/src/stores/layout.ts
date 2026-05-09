import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

const STORAGE_KEY = 'sidebarCollapsed';

export const useLayoutStore = defineStore('layout', () => {
  const sidebarCollapsed = ref<boolean>(localStorage.getItem(STORAGE_KEY) === 'true');

  watch(sidebarCollapsed, (val) => {
    localStorage.setItem(STORAGE_KEY, String(val));
  });

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  return { sidebarCollapsed, toggleSidebar };
});
