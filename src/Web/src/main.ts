import './style.css';

import Aura from '@primevue/themes/aura';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';

import App from './App.vue';
import router from './router';

const app = createApp(App);
const pinia = createPinia();

app.use(router);
app.use(pinia);
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      cssLayer: {
        name: 'primevue',
        order: 'tailwind-base, primevue, tailwind-utilities',
      },
      darkModeSelector: '@media (prefers-color-scheme: dark)',
    },
    extend: {
      primitive: {
        amber: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
      },
      semantic: {
        primary: {
          50: '{amber.50}',
          100: '{amber.100}',
          200: '{amber.200}',
          300: '{amber.300}',
          400: '{amber.400}',
          500: '{amber.500}',
          600: '{amber.600}',
          700: '{amber.700}',
          800: '{amber.800}',
          900: '{amber.900}',
          950: '{amber.950}',
        },
        colorScheme: {
          light: {
            surface: {
              0: '#ffffff',
              50: '#f8f8fa',
              100: '#f1f1f5',
              200: '#e2e2ea',
              300: '#c8c8d8',
              400: '#9ca3af',
              500: '#6b6b7a',
              600: '#4b4b5a',
              700: '#3d3d4a',
              800: '#2a2a35',
              900: '#1e1e26',
              950: '#16161c',
            },
          },
          dark: {
            surface: {
              0: '#ffffff',
              50: '#f8f8fa',
              100: '#1e1e26',
              200: '#2a2a35',
              300: '#3d3d4a',
              400: '#6b6b7a',
              500: '#9ca3af',
              600: '#c8c8d8',
              700: '#e2e2ea',
              800: '#f1f1f5',
              900: '#f8f8fa',
              950: '#ffffff',
            },
          },
        },
      },
    },
  },
});

app.directive('tooltip', Tooltip);

app.mount('#app');
