// @ts-check
const path = require('node:path');
const os = require('node:os');
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  // This config now lives at tests/playwright.config.js (moved out of the
  // repo root — see package.json's own comment for why: Tauri's
  // frontendDist points at the whole repo root, and it hard-refuses to
  // build if node_modules is a DIRECT child of that folder. One level
  // deeper is fine — Node's module resolution still finds
  // tests/node_modules from anything under tests/**, and Tauri never sees
  // a node_modules folder sitting directly in the root it's told to embed.
  testDir: './e2e',
  // Found the hard way: Tauri's asset embedder walks frontendDist (the
  // whole repo root) at build time with no ignore mechanism, so it *sees*
  // whatever's sitting under tests/test-results/ too — trace/screenshot
  // files from a failed or retried test run. A build that starts after
  // such a file exists, then runs after it's cleaned up, fails trying to
  // embed a path that's since vanished ("os error 3", confirmed by hitting
  // this for real). Routing Playwright's output outside the repo entirely
  // removes the possibility, rather than just cleaning up after the fact.
  outputDir: path.join(os.tmpdir(), 'elm-playwright-results'),
  fullyParallel: false, // several specs create/reset shared IndexedDB/OPFS state — keep serial for now
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  webServer: {
    // Serve the repo root (one level up from here), not tests/ itself —
    // index.html and the rest of the shipped app live there.
    command: 'npx http-server .. -p 8123 -c-1',
    port: 8123,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  use: {
    baseURL: 'http://localhost:8123',
    trace: 'retain-on-failure',
  },
});
