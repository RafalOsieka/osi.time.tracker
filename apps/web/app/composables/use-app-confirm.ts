export interface AppConfirmOptions {
  title: string;
  description?: string;
  /** The chip's glyph; defaults to a warning triangle (error) or an info mark. */
  icon?: string;
  /** Text inside the description shown in medium weight, e.g. the name of what is deleted. */
  emphasis?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: 'error' | 'primary' | 'neutral';
  /** Runs after accept, while the dialog stays open. Close only after it settles. */
  onConfirm?: () => Promise<void> | void;
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
    const modal = overlay.create(ConfirmModal, {
      destroyOnClose: true,
      props: options,
    });
    const result = await modal.open();
    return Boolean(result);
  };
}
