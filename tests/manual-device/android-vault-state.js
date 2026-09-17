const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9333');
  const page = browser.contexts().flatMap(c => c.pages())[0];
  const out = await page.evaluate(async () => {
    return {
      isTauri: typeof IS_TAURI !== 'undefined' ? IS_TAURI : 'undefined',
      isAndroid: typeof IS_ANDROID !== 'undefined' ? IS_ANDROID : 'undefined',
      storageMode: typeof storageMode !== 'undefined' ? storageMode : 'undefined',
      vaultPath: typeof vaultPath !== 'undefined' ? vaultPath : 'undefined',
      vaultIndexSize: typeof vaultIndex !== 'undefined' ? vaultIndex.size : 'undefined',
    };
  });
  console.log(JSON.stringify(out, null, 2));
  await browser.close().catch(() => {});
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
