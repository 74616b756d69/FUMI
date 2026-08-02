import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: {
    open: true
  },
  build: {
    target: 'ES2020',
    outDir: 'dist',
    sourcemap: true
  }
})
