export default defineNuxtPlugin(() => {
  const { preference, applyFromPreference } = useColorMode();

  applyFromPreference();

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (preference.value === 'system') {
      applyFromPreference();
    }
  };

  media.addEventListener('change', onChange);

  // Clean up the listener on HMR dispose to prevent duplicate listeners during development.
  if (import.meta.hot) {
    import.meta.hot.dispose(() => media.removeEventListener('change', onChange));
  }

  onNuxtReady(() => {
    applyFromPreference();
  });
});
