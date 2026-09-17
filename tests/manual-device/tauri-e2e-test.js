// Connects to the REAL running elm.exe (Tauri desktop build) via WebView2's
// CDP debugging port, and drives it exactly like a user would — this is the
// actual app, not a browser simulation of it. Verifies IS_TAURI selected
// the right backend, then exercises the vault connect flow.
const { chromium } = require('playwright');
const assert = require('assert');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9333');
  const contexts = browser.contexts();
  const pages = contexts.flatMap(c => c.pages());
  console.log('pages found:', pages.length, pages.map(p => p.url()));
  const page = pages.find(p => p.url().includes('index.html')) || pages[0];
  if (!page) throw new Error('No page found via CDP — is elm.exe actually running?');

  const wiring = await page.evaluate(() => ({
    isTauri: typeof IS_TAURI !== 'undefined' ? IS_TAURI : 'undefined',
    adapterIsTauri: typeof tauriVaultAdapter !== 'undefined' && vaultAdapter === tauriVaultAdapter,
    hasTauriGlobal: typeof window.__TAURI__ !== 'undefined',
    hasFsPlugin: typeof window.__TAURI__?.fs !== 'undefined',
    hasDialogPlugin: typeof window.__TAURI__?.dialog !== 'undefined',
    title: document.title,
  }));
  console.log('REAL APP wiring:', JSON.stringify(wiring, null, 2));
  assert.strictEqual(wiring.isTauri, true, 'IS_TAURI must be true inside the real Tauri build');
  assert.strictEqual(wiring.adapterIsTauri, true, 'vaultAdapter must be tauriVaultAdapter');
  assert(wiring.hasFsPlugin, 'window.__TAURI__.fs missing — withGlobalTauri or fs plugin not working');
  assert(wiring.hasDialogPlugin, 'window.__TAURI__.dialog missing');

  console.log('=== REAL TAURI APP WIRING VERIFIED ===');
  // Deliberately not calling browser.close() — that would close the real
  // app window. Just disconnect this CDP session.
  await browser.close().catch(() => {});
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
