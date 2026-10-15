import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build runs from any folder (itch.io serves games from a subpath).
  base: './',
  server: { port: 5173, open: false },
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 800 }, // three.js is ~550 kB
});
