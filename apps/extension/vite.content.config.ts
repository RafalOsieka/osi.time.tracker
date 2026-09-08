import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
    lib: {
      entry: 'src/content.ts',
      name: 'osiExtensionContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
