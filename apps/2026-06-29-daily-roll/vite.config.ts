import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    // three.js is a large single dependency; this app is one bundle on purpose.
    chunkSizeWarningLimit: 1000,
  },
})
