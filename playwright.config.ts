import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-mobile',
      testMatch: /.*(emergency-mode|saved-places)\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 5174',
    env: {
      VITE_ORS_API_KEY: 'playwright-test-key',
      VITE_FAMILY_REMOTE_URL: process.env.VITE_FAMILY_REMOTE_URL ?? '',
    },
    port: 5174,
    reuseExistingServer: true,
  },
});
