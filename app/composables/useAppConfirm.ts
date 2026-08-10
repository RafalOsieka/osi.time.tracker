import type { Component } from 'vue';

export interface AppConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: 'error' | 'primary' | 'neutral';
}

/**
 * Nuxt UI `useOverlay().create` expects a Vue `Component`; SFC default exports
 * are slightly wider, so adapt once here instead of casting at call sites.
 */
function asOverlayComponent(component: unknown): Component {
  return component as Component;
}

/**
 * Promise-based confirmation via Nuxt UI `useOverlay` + `ConfirmModal`.
 * Resolves `true` on accept and `false` on reject/dismiss.
 */
export function useAppConfirm() {
  const overlay = useOverlay();

  return async (options: AppConfirmOptions): Promise<boolean> => {
    // Resolve lazily so unit/nuxt tests can stub without a full Nuxt component registry.
    const { default: ConfirmModal } = await import('~/components/ConfirmModal.vue');
    const modal = overlay.create(asOverlayComponent(ConfirmModal), {
      destroyOnClose: true,
      props: options,
    });
    const result = await modal.open();
    return Boolean(result);
  };
}
