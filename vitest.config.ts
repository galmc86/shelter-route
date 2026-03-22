import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    __SHELTER_DATA_VERSION__: JSON.stringify('test'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/.claude/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      thresholds: {
        'src/services/**': {
          statements: 60,
          branches: 60,
          functions: 60,
          lines: 60,
        },
        'src/hooks/**': {
          statements: 15,
          branches: 10,
          functions: 15,
          lines: 15,
        },
      },
    },
  },
})
