import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config for the full MVP browser flow. Prerequisites (not started by
 * this config): MongoDB must already be running locally — Playwright has
 * no way to manage a database process, and this project never fabricates
 * that dependency away. Both the API server and the Vite client ARE
 * started automatically below via `webServer`, reusing an already-running
 * dev server if you have one open (handy while iterating on a test).
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // the MVP flow spec is intentionally sequential/stateful
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'npm run dev --prefix ../server',
      url: 'http://localhost:5050/api/health',
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'npm run dev --prefix ../client',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
