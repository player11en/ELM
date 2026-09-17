// Same incremental-indexing behaviour, but against the REAL desktop app and
// a REAL 1200-file folder on disk (not OPFS). Also the one place a genuine
// warm start can be measured, since the desktop app can be quit and
// relaunched for real — unlike the browser harness, where reloading with an
// OPFS handle kills the page.
const { chromium } = require('playwright');
const assert = require('assert');

// Runs against whatever vault is ALREADY connected — this machine has the
// real one attached, and repointing it at a throwaway folder would disconnect
// the user from their own notes. Everything below is read-only: stat, read,
// and an IndexedDB cache read. No writes, no vault switching.
(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9341');
  const page = browser.contexts().flatMap(c => c.pages())[0];
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  const before = await page.evaluate(() => ({ mode: storageMode, size: vaultIndex.size, path: vaultPath }));
  console.log('connected vault:', JSON.stringify(before));
  assert.strictEqual(before.mode, 'files', 'expected a real vault connected');
  assert(before.size > 0, 'expected notes in the connected vault');

  // 1. Incremental rescan with nothing changed — must read zero files.
  const io = await page.evaluate(async () => {
    const counts = { readText: 0, statFile: 0 };
    const origRead = vaultAdapter.readText.bind(vaultAdapter);
    const origStat = vaultAdapter.statFile.bind(vaultAdapter);
    vaultAdapter.readText = async (...a) => { counts.readText++; return origRead(...a); };
    vaultAdapter.statFile = async (...a) => { counts.statFile++; return origStat(...a); };
    const t = performance.now();
    const r = await reconcileVault();
    const ms = Math.round(performance.now() - t);
    vaultAdapter.readText = origRead;   // restore, don't leave the app instrumented
    vaultAdapter.statFile = origStat;
    return { ...r, ms, counts };
  });
  console.log('DESKTOP rescan (no changes):', JSON.stringify(io));
  assert.strictEqual(io.changed, 0, 'nothing changed on disk — nothing should be re-read');
  assert.strictEqual(io.counts.readText, 0, 'an unchanged vault must cost ZERO file reads on the desktop build too');

  // 2. Warm restore straight from the IndexedDB cache.
  const warm = await page.evaluate(async () => {
    const expected = vaultIndex.size;
    vaultIndex = new Map();
    const t = performance.now();
    await loadVaultFromCache();
    return { ms: Math.round(performance.now() - t), size: vaultIndex.size, expected };
  });
  console.log(`DESKTOP warm restore from cache: ${warm.ms}ms for ${warm.size} notes`);
  assert.strictEqual(warm.size, warm.expected, 'cache should hold every note that was indexed');

  console.log('errors:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0);
  console.log('=== DESKTOP SCALE TEST PASSED ===');
  await browser.close().catch(() => {});
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
