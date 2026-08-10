import type { ButtonProps } from '@nuxt/ui';

/**
 * Shared dashboard sidebar/navbar toggle button props.
 * Typed against Nuxt UI `ButtonProps` so layouts do not use `Record<string, unknown>`.
 */
export function sidebarToggleProps(): Pick<ButtonProps, 'color' | 'variant'> {
  return {
    color: 'neutral',
    variant: 'ghost',
  };
}
