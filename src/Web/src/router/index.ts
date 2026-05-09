import { createRouter, createWebHistory } from 'vue-router';

import DefaultLayout from '../layouts/DefaultLayout.vue';
import PublishPage from '../views/PublishPage.vue';
import ReportsPage from '../views/ReportsPage.vue';
import SettingsPage from '../views/SettingsPage.vue';
import TrackerPage from '../views/TrackerPage.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: DefaultLayout,
      children: [
        { path: '', redirect: '/tracker' },
        { path: 'tracker', name: 'tracker', component: TrackerPage },
        { path: 'reports', name: 'reports', component: ReportsPage },
        { path: 'publish', name: 'publish', component: PublishPage },
        { path: 'settings', name: 'settings', component: SettingsPage },
      ],
    },
  ],
});

export default router;
