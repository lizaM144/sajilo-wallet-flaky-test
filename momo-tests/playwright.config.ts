import { defineConfig, devices } from '@playwright/test';

// STARTER CONFIG: one browser, one worker, nothing for CI yet.
// You will grow this file in Checkpoint 1 (parallel, browsers, devices)
// and Checkpoint 3 (headless, evidence on failure, CI settings).
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4100',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',
    use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',
    use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', testMatch: /mobile\.spec\.ts/, use: { ...devices['Galaxy S24'] } },
    { name: 'mobile-safari', testMatch: /mobile\.spec\.ts/, use: { ...devices['iPhone 14'] } },
  ],
});
