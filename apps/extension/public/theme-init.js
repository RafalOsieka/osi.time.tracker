// Applies the stored extension theme before first paint (no flash of light for dark users).
// Loaded as a classic blocking script in both page heads; keep the key in sync with
// src/composables/use-extension-theme.ts.
try {
  if (localStorage.getItem('osi-extension-theme') === 'dark') {
    document.documentElement.classList.add('dark');
  }
} catch {
  // Unreadable storage keeps the default light theme.
}
