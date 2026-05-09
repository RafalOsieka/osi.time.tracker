import { createRouter, createWebHistory } from 'vue-router';

import TrackerView from '../views/TrackerView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'tracker',
      component: TrackerView,
    },
  ],
});

export default router;
