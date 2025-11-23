import { defineConfig } from 'vite';

export default defineConfig({
  base: '/tetracopter/',  // For GitHub Pages deployment
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
