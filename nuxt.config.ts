import Aura from '@primeuix/themes/aura';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@primevue/nuxt-module',
    '@nuxt/test-utils/module',
    '@nuxt/eslint',
    'nuxt-auth-utils',
    'nuxt-security',
  ],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  routeRules: {
    '/api/auth/login': {
      security: {
        rateLimiter: {
          tokensPerInterval: 5,
          interval: 60000, // 1 minute
        },
      },
    },
  },
  runtimeConfig: {
    // Server-only. Override at runtime with NUXT_DATABASE_URL or DATABASE_URL.
    databaseUrl: process.env.DATABASE_URL ?? '',
    // Server-side session settings consumed by nuxt-auth-utils.
    // The sealing secret is provided via NUXT_SESSION_PASSWORD (32+ chars).
    session: {
      // Fixed lifetime (no sliding expiry for the MVP): 1 week.
      maxAge: 60 * 60 * 24 * 7,
      cookie: {
        sameSite: 'strict',
        httpOnly: true,
        // HTTPS-only cookie in production; relaxed for local HTTP dev.
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  security: {
    // CSRF protection for state-changing requests. The underlying nuxt-csurf
    // module defaults to POST/PUT/PATCH; DELETE is added to satisfy the spec.
    csrf: {
      methodsToProtect: ['POST', 'PUT', 'PATCH', 'DELETE'],
    },
    headers: {
      // Baseline Content-Security-Policy; tighten iteratively post-MVP.
      contentSecurityPolicy: {
        'img-src': ["'self'", 'data:'],
      },
    },
  },
  primevue: {
    options: {
      theme: {
        preset: Aura,
      },
    },
  },
});
