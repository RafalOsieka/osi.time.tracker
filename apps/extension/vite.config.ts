import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig, type Plugin } from 'vite';
import { extensionManifest } from './src/manifest.js';

const root = dirname(fileURLToPath(import.meta.url));

function emitManifest(): Plugin {
  return {
    name: 'emit-extension-manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: `${JSON.stringify(extensionManifest, null, 2)}\n`,
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [vue(), emitManifest()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    modulePreload: false,
    rollupOptions: {
      input: {
        background: resolve(root, 'src/background.ts'),
        options: resolve(root, 'src/options/index.html'),
        popup: resolve(root, 'src/popup/index.html'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
