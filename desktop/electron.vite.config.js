import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/main',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.js') },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/preload',
      rollupOptions: {
        input: {
          settings: resolve(__dirname, 'src/preload/settings-preload.js'),
          overlay:  resolve(__dirname, 'src/preload/overlay-preload.js'),
        },
      },
    },
  },
  renderer: {
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/renderer/shared'),
      },
    },
    build: {
      outDir: 'dist-electron/renderer',
      rollupOptions: {
        input: {
          settings: resolve(__dirname, 'src/renderer/settings/index.html'),
          overlay:  resolve(__dirname, 'src/renderer/overlay/index.html'),
        },
      },
    },
    plugins: [react()],
  },
});
