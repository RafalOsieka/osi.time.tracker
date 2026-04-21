## Why

We need a modern, scalable, and customizable UI framework for the frontend. Integrating PrimeVue 4 with Tailwind CSS 4 provides a robust component library with utility-first styling, enabling rapid development of a consistent user interface. Using Tailwind 4 (which doesn't require PostCSS/Autoprefixer) and the Aura preset ensures a modern look and feel with minimal configuration overhead.

## What Changes

- Add PrimeVue 4 to the Vue.js frontend project.
- Configure PrimeVue to use Styled mode with the Aura preset.
- Integrate Tailwind CSS 4 as the styling engine.
- Install and configure PrimeIcons for UI icons.
- Update `main.ts` and Vite configuration to support the new UI stack.
- Remove any redundant styling configurations (Tailwind 4 replaces the need for separate PostCSS/Autoprefixer).

## Capabilities

### New Capabilities
- `ui-foundation`: Base UI infrastructure including PrimeVue configuration, Tailwind 4 setup, and icon support.

### Modified Capabilities
None (Initial project setup).

## Impact

- `src/Web/package.json`: New dependencies (`primevue`, `@primevue/themes`, `tailwindcss`, `primeicons`).
- `src/Web/vite.config.ts`: Updated to handle Tailwind CSS 4.
- `src/Web/src/main.ts`: PrimeVue plugin registration and theme configuration.
- `src/Web/src/style.css`: Inclusion of Tailwind 4 directives.
- Build Process: Transition to Tailwind 4's engine.
