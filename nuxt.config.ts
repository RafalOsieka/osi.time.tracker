import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

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
    locales: [
      { code: 'en', language: 'en-US', file: 'en.json' },
      { code: 'pl', language: 'pl-PL', file: 'pl.json' },
    ],
    langDir: '../i18n/locales',
    vueI18n: '../i18n/i18n.config.ts',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale',
      cookieSecure: process.env.NODE_ENV === 'production',
      cookieCrossOrigin: false,
      alwaysRedirect: false,
      redirectOn: 'root',
    },
  },
  css: ['primeicons/primeicons.css', '~/assets/css/main.css'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  routeRules: {
    '/api/auth/login': {
      security: {
        rateLimiter: {
          tokensPerInterval: 5,
          interval:
            process.env.NODE_ENV === 'test' ||
            Boolean(process.env.VITEST) ||
            process.env.IS_E2E === 'true'
              ? 2000
              : 60000,
        },
      },
    },
  },
  runtimeConfig: {
    // Server-only. Override at runtime with NUXT_DATABASE_URL or DATABASE_URL.
    databaseUrl: process.env.DATABASE_URL ?? '',
    public: {
      // Very-small "timer-stack" breakpoint (px). Below this width the timer
      // region drops to its own full-width row. Distinct from the lg (1024 px)
      // rail→drawer threshold. Override at runtime with NUXT_PUBLIC_TIMER_STACK_BREAKPOINT.
      timerStackBreakpoint: 480,
    },
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
    // Disable rate limiter in development to prevent Vite HMR and unbundled requests from getting blocked.
    rateLimiter: process.env.NODE_ENV === 'development' ? false : undefined,
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
  vite: {
    server: {
      // Disable HMR in E2E tests to avoid flakiness when running against the dev server.
      hmr: process.env.IS_E2E === 'true' ? false : undefined,
    },
    optimizeDeps: {
      include: ['@primevue/forms', '@primevue/forms/resolvers/zod', 'zod'],
    },
  },
  typescript: {
    typeCheck: true,
    tsConfig: {
      // NOTE: nuxt tests are included by default
      include: ['../test/e2e/*', '../test/unit/*'],
    },
  },
});
