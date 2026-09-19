// Published static-site pages must not overflow horizontally on a phone —
// content deliberately chosen to stress it: a wide table, a long unbroken
// code line, a very long URL. Migrated from pw-test/site-responsive-test.js
// — same assertions/flow.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Outside the repo, not tests/test-results/ — Tauri's asset embedder walks
// the whole repo root at build time with no ignore mechanism, so files
// that appear/disappear here between test runs can break an unrelated
// native build (confirmed by hitting exactly that failure once).
const OUT = path.join(os.tmpdir(), 'elm-test-artifacts', 'site-responsive');

test('published pages have no horizontal overflow at phone/tablet/desktop widths', async ({ page, browser }) => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  page.on('pageerror', e => { throw new Error('PAGEERROR: ' + e.message); });

  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(900);

  const generated = await page.evaluate(async () => {
    const opfsRoot = await navigator.storage.getDirectory();
    vaultHandle = await opfsRoot.getDirectoryHandle('responsive-vault', { create: true });
    vaultAdapter = fsaVaultAdapter;
    storageMode = 'files';
    vaultIndex = new Map();

    selectedFolderId = 'Site';
    const id = await createNote();
    await saveNote(id, {
      title: 'Wide Content',
      body: [
        '# Wide Content',
        '',
        '| Column One | Column Two | Column Three | Column Four | Column Five | Column Six |',
        '|---|---|---|---|---|---|',
        '| aaaaaaaaaa | bbbbbbbbbb | cccccccccc | dddddddddd | eeeeeeeeee | ffffffffff |',
        '',
        '```js',
        'const aVeryLongLineOfCodeThatWillNotWrapNaturally = someFunction(argumentOne, argumentTwo, argumentThree, argumentFour);',
        '```',
        '',
        'A long URL: https://example.com/some/extremely/long/path/that/keeps/going/and/going/without/any/spaces/at/all/whatsoever',
        '',
        '- [ ] an unchecked task',
        '- [x] a completed task',
      ].join('\n'),
    });
    await refreshAll();

    const built = await buildSiteFiles('Site');
    const out = {};
    for (const [p, content] of built.files) {
      if (typeof content === 'string') out[p] = content;
    }
    return out;
  });

  for (const [name, html] of Object.entries(generated)) {
    fs.writeFileSync(path.join(OUT, name), html);
  }
  expect(Object.keys(generated).length, 'expected at least one generated page').toBeGreaterThan(0);

  const results = {};
  for (const [label, size] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 768, height: 1024 }], ['desktop', { width: 1440, height: 900 }]]) {
    const p = await browser.newPage({ viewport: size });
    await p.goto('file:///' + path.join(OUT, 'wide-content.html').replace(/\\/g, '/'));
    await p.waitForTimeout(300);
    const metrics = await p.evaluate(() => ({
      docScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      hasViewportMeta: !!document.querySelector('meta[name="viewport"]'),
    }));
    metrics.horizontalOverflowPx = metrics.docScrollWidth - metrics.innerWidth;
    results[label] = metrics;
    await p.screenshot({ path: path.join(OUT, `${label}.png`), fullPage: false });
    await p.close();
  }

  expect(results.phone.hasViewportMeta, 'published page missing viewport meta').toBe(true);
  for (const label of ['phone', 'tablet', 'desktop']) {
    expect(results[label].horizontalOverflowPx,
      `${label}: page overflows horizontally — content does not scale`).toBeLessThanOrEqual(1);
  }
});
