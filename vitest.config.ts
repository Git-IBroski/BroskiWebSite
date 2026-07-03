import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Vitest configuration kept separate from vite.config.ts so the production
// Vite build is unaffected by test tooling.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'api/**/*.{test,spec}.{ts,tsx}'],
  },
})
