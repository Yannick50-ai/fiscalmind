import { defineConfig } from 'vite';

export default defineConfig({
  // base relative : le build statique se déploie tel quel sur Cloudflare Pages
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
