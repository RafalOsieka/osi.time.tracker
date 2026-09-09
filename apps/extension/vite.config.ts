import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { build as viteBuild, defineConfig, type Plugin } from 'vite';
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

/** Main `emptyOutDir` wipes content.js; rebuild it after every (watch) bundle. */
function emitContentScript(): Plugin {
  let building = false;
  return {
    name: 'emit-content-script',
    apply: 'build',
    async closeBundle() {
      if (building) return;
      building = true;
      try {
        await viteBuild({ configFile: resolve(root, 'vite.content.config.ts') });
      } finally {
        building = false;
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [vue(), emitManifest(), emitContentScript()],
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
