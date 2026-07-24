/**
 * Thin wrapper over Nuxt UI `useToast` with the severity/title shape used across pages.
 */
export function useAppToast() {
  const toast = useToast();

  return {
    success(title: string, description?: string, duration = 3000) {
      toast.add({
        title,
        description,
        color: 'success',
        duration,
      });
    },
    error(title: string, description?: string, duration = 4000) {
      toast.add({
        title,
        description,
        color: 'error',
        duration,
      });
    },
  };
}
