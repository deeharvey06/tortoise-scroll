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
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'NODE_ENV=test SESSION_SECRET=e2e-only-session-secret-at-least-32-characters ROOT_USER_EMAIL=e2e-root@tortoise-scroll.test ROOT_USER_INITIAL_PASSWORD=e2e-root-password-strong-123 npm run dev --prefix ../server',
      url: 'http://localhost:5050/api/health',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'NODE_ENV=test npm run dev --prefix ../client -- --host 127.0.0.1 --port 5174 --strictPort',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
