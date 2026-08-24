import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    restoreMocks: true,
    exclude: ['e2e/**', 'backend/**', 'node_modules/**'],
  },
})
