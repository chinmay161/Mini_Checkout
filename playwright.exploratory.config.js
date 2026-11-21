const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './exploratory',
  fullyParallel: false,
  reporter: [
    ['list']
  ],
  use: {
    baseURL: 'http://localhost:3100',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node server.js',
    url: 'http://localhost:3100',
    env: {
      PORT: '3100',
    },
    reuseExistingServer: !process.env.CI,
  },
});
