import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';

const CustomAuraTheme = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{cyan.50}',
      100: '{cyan.100}',
      200: '{cyan.200}',
      300: '{cyan.300}',
      400: '{cyan.400}',
      500: '{cyan.500}',
      600: '{cyan.600}',
      700: '{cyan.700}',
      800: '{cyan.800}',
      900: '{cyan.900}',
      950: '{cyan.950}',
    },
    colorScheme: {
      light: {
        primary: {
          color: '{primary.700}',
          contrastColor: '#ffffff',
        },
      },
      dark: {
        primary: {
          color: '{primary.300}',
          contrastColor: '{surface.950}',
        },
      },
    },
  },
});

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@primevue/nuxt-module',
    '@nuxt/test-utils/module',
    '@nuxt/eslint',
    'nuxt-auth-utils',
    'nuxt-security',
    '@nuxtjs/i18n',
  ],
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'en',
    fallbackLocale: 'en',
    locales: [
      { code: 'en', language: 'en-US', file: 'en.json' },
      { code: 'pl', language: 'pl-PL', file: 'pl.json' },
    ],
    lazy: true,
    langDir: '../i18n/locales',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale',
      cookieSecure: process.env.NODE_ENV === 'production',
      cookieCrossOrigin: false,
      alwaysRedirect: false,
      redirectOn: 'root',
    },
  },
  css: ['~/assets/css/main.css'],
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
        preset: CustomAuraTheme,
        options: {
          darkModeSelector: '.dark',
        },
      },
    },
  },
});
