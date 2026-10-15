import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build runs from any folder (the desktop app loads dist/index.html from disk).
  base: './',
  server: { port: 5173, open: false },
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 1000 }, // three.js ~550 kB + peerjs
});
