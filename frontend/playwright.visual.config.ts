import { defineConfig } from '@playwright/test';

const port = process.env.UI_CHECK_PORT || '4173';
const baseURL = process.env.UI_CHECK_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    headless: true,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run start -- --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
