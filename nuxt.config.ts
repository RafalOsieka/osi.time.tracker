import { PROD_LOGIN_RATE_LIMIT, E2E_LOGIN_RATE_LIMIT } from './shared/config/rate-limit';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
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
  css: ['~/assets/css/main.css'],
  // Bundled with @nuxt/ui; classSuffix '' (`.dark`) is set by the UI module.
  // Default preference is system so OS prefers-color-scheme is honored until overridden.
  colorMode: {
    preference: 'system',
    fallback: 'light',
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: process.env.IS_E2E !== 'true' },
  routeRules: {
    '/api/auth/login': {
      security: {
        rateLimiter:
          process.env.NODE_ENV === 'test' ||
          Boolean(process.env.VITEST) ||
          process.env.IS_E2E === 'true'
            ? E2E_LOGIN_RATE_LIMIT
            : PROD_LOGIN_RATE_LIMIT,
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
    // Disable the global rate limiter in development and E2E tests to prevent
    // ordinary application requests from exhausting the shared test bucket.
    // The login route keeps its dedicated limiter below for auth-specific tests.
    rateLimiter:
      process.env.NODE_ENV === 'development' || process.env.IS_E2E === 'true' ? false : undefined,
    // CSRF protection for state-changing requests. The underlying nuxt-csurf
    // module defaults to POST/PUT/PATCH; DELETE is added to satisfy the spec.
    csrf: {
      methodsToProtect: ['POST', 'PUT', 'PATCH', 'DELETE'],
    },
    headers: {
      // Baseline Content-Security-Policy; tighten iteratively post-MVP.
      contentSecurityPolicy: {
        'img-src': ["'self'", 'data:'],
        // Remote-issue-linking (REQ-103) performs a *browser-side* fetch
        // straight to each user's own configured OpenProject/Redmine base
        // URL (never proxied through the OSI server), so the exact origin
        // is not known at build time and cannot be enumerated per-request
        // with a static nuxt-security directive. As a pragmatic MVP
        // trade-off (see design.md risk "CSP blocks configured origins"),
        // connect-src is broadened to any HTTP(S) origin rather than
        // implementing per-session dynamic CSP; 'data:'/other schemes stay
        // blocked, and all other directives remain at their strict default.
        'connect-src': ["'self'", 'https:', 'http:'],
      },
    },
  },
  vite: {
    server: {
      // Disable HMR in E2E tests to avoid flakiness when running against the dev server.
      hmr: process.env.IS_E2E === 'true' ? false : undefined,
    },
    optimizeDeps: {
      include: ['temporal-polyfill', 'zod'],
    },
  },
  typescript: {
    // Disabled rather than `true`: with Nuxt 4.5 (Vite 8), the in-dev live checker
    // (vite-plugin-checker) fails to resolve its runtime client under Nuxt's non-root
    // `/_nuxt/` base ("Failed to resolve import ... @vite-plugin-checker-runtime"), a
    // known upstream bug (fi3ework/vite-plugin-checker#661) unfixed as of v0.14.4.
    // `pnpm type-check` (run in CI) still performs the full `vue-tsc` type check.
    typeCheck: false,
    tsConfig: {
      // NOTE: nuxt tests are included by default
      include: ['../test/e2e/*', '../test/unit/*'],
    },
  },
});
