// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // several specs create/reset shared IndexedDB/OPFS state — keep serial for now
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  webServer: {
    command: 'npx http-server . -p 8123 -c-1',
    port: 8123,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  use: {
    baseURL: 'http://localhost:8123',
    trace: 'retain-on-failure',
  },
});
