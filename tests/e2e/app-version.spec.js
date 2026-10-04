// The app shows its version, and it matches the desktop build's config so a
// release can't ship with a stale label.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

test('sidebar shows ELM vX.Y.Z matching the desktop config', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const label = await page.locator('#appVersionLabel').textContent();
  expect(label).toMatch(/^ELM v\d+\.\d+\.\d+$/);
  expect(await page.locator('header .logo').getAttribute('title')).toBe(label);

  // ELM-desktop sits next to the repo locally; skip the cross-check where it doesn't (CI).
  const conf = path.resolve(__dirname, '../../../ELM-desktop/src-tauri/tauri.conf.json');
  test.skip(!fs.existsSync(conf), 'desktop project not present');
  expect(label).toBe('ELM v' + JSON.parse(fs.readFileSync(conf, 'utf8')).version);
});
