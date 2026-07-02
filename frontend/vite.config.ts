import {defineConfig} from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Fast Refresh is dev-server-only and breaks component rendering under
  // Vitest ("@vitejs/plugin-react can't detect preamble"), so disable it
  // when running tests.
  plugins: [react({ fastRefresh: !process.env.VITEST })],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
