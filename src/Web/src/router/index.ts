import { createRouter, createWebHistory } from 'vue-router';

import HomeView from '../views/HomeView.vue';
import TrackerView from '../views/TrackerView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'tracker',
      component: TrackerView,
    },
    {
      path: '/weather',
      name: 'home',
      component: HomeView,
    },
  ],
});

export default router;
