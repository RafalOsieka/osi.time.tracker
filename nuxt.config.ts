import Aura from '@primeuix/themes/aura';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@primevue/nuxt-module', '@nuxt/test-utils/module', '@nuxt/eslint'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  runtimeConfig: {
    // Server-only. Override at runtime with NUXT_DATABASE_URL or DATABASE_URL.
    databaseUrl: process.env.DATABASE_URL ?? '',
  },
  primevue: {
    options: {
      theme: {
        preset: Aura,
      },
    },
  },
});
