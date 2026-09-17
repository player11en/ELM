// PWA-path check: service worker registers/activates, manifest is valid,
// and the app still boots with the network cut (the offline promise the
// installed PWA depends on). Migrated from pw-test/pwa-test.js — same
// assertions/flow.
const { test, expect } = require('@playwright/test');

test('service worker, manifest, and offline boot', async ({ page, context }) => {
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  // --- service worker ------------------------------------------------------
  const sw = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { supported: false };
    const reg = await navigator.serviceWorker.getRegistration();
    return {
      supported: true,
      registered: !!reg,
      scope: reg?.scope || null,
      state: reg?.active?.state || reg?.installing?.state || reg?.waiting?.state || null,
    };
  });
  expect(sw.registered, 'service worker did not register').toBe(true);

  // wait for it to actually take control before testing offline
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.state;
  });
  await page.waitForTimeout(1500);

  // --- manifest ------------------------------------------------------------
  const manifest = await (await page.request.get('/manifest.json')).json();
  expect(manifest.display, 'manifest display changed').toBe('standalone');
  // Two entries by design: an unpadded "any" icon plus a separate padded
  // "maskable" one. A single icon declared "any maskable" (the old shape)
  // gets cropped by launcher masks because the art runs to the edges.
  const anyIcon = manifest.icons?.find(i => i.purpose === 'any');
  const maskIcon = manifest.icons?.find(i => i.purpose === 'maskable');
  expect(anyIcon?.sizes, 'manifest "any" icon missing/changed').toBe('512x512');
  expect(maskIcon?.sizes, 'manifest "maskable" icon missing/changed').toBe('512x512');
  expect(maskIcon.src, 'maskable icon must be the padded variant, not the same file').not.toBe(anyIcon.src);
  for (const src of [anyIcon.src, maskIcon.src]) {
    const res = await page.request.get(`/${src}`);
    expect(res.status(), `${src} not served`).toBe(200);
  }

  // --- create a note so there is state to survive the offline reload -------
  await page.click('#newNoteBtn');
  await page.waitForFunction(() => document.activeElement?.id === 'noteTitleInput');
  await page.fill('#noteTitleInput', 'Offline Survivor');
  await page.fill('#editorTextarea', '# Offline Survivor\n\n```javascript\nconst offline = true;\n```');
  await page.locator('#editorTextarea').blur();
  // Wait for the real save-confirmed signal, not a flat timeout — a fixed
  // sleep here is exactly what made this test flaky (a run that lands
  // before IndexedDB's write actually lands looks identical to the app
  // being broken, but isn't).
  await page.waitForFunction(() => document.getElementById('saveStatus')?.classList.contains('saved'), null, { timeout: 10000 });

  // --- cut the network and reload -----------------------------------------
  await context.setOffline(true);
  await page.reload({ waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(1800);

  const offlineState = await page.evaluate(() => ({
    booted: typeof IS_TAURI !== 'undefined' && typeof vaultAdapter !== 'undefined',
    isTauri: typeof IS_TAURI !== 'undefined' ? IS_TAURI : 'undefined',
    adapterOk: typeof vaultAdapter !== 'undefined' && typeof vaultAdapter.readText === 'function',
    titles: [...document.querySelectorAll('.ni-title')].map(e => e.textContent),
    // the CDN libs the app needs — proves SW cache served them with no network
    marked: typeof marked !== 'undefined',
    dompurify: typeof DOMPurify !== 'undefined',
    hljs: typeof hljs !== 'undefined',
  }));
  expect(offlineState.booted, 'app did not boot offline').toBe(true);
  expect(offlineState.isTauri, 'IS_TAURI must be false in the browser/PWA').toBe(false);
  expect(offlineState.adapterOk, 'vaultAdapter missing after offline boot').toBe(true);
  expect(offlineState.titles, 'note did not survive offline reload').toEqual(['Offline Survivor']);
  expect(offlineState.marked && offlineState.dompurify && offlineState.hljs,
    'CDN libraries were not served from the service-worker cache offline').toBe(true);

  // app still functional offline: preview renders with highlighting
  await page.click('.note-item');
  await page.waitForTimeout(500);
  await page.click('.view-btn[data-view="preview"]');
  await page.waitForTimeout(700);
  const offlineRender = await page.evaluate(() => ({
    h1: !!document.querySelector('#editorPreview h1'),
    hljs: !!document.querySelector('#editorPreview .hljs-keyword'),
  }));
  expect(offlineRender.h1 && offlineRender.hljs, 'markdown/highlighting broken offline').toBe(true);

  await context.setOffline(false);
  expect(errors, 'console/page errors during PWA run').toEqual([]);
});
