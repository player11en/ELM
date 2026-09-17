const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9333');
  const page = browser.contexts().flatMap(c => c.pages())[0];
  const out = await page.evaluate(async () => {
    const result = {};
    result.bridgeExists = typeof window.AndroidNative !== 'undefined';
    if (result.bridgeExists) {
      try { result.hasAllFilesAccess = window.AndroidNative.hasAllFilesAccess(); }
      catch (e) { result.hasAllFilesAccessError = e.message || String(e); }
    }
    result.ensureFnExists = typeof ensureAllFilesAccess === 'function';
    return result;
  });
  console.log(JSON.stringify(out, null, 2));
  await browser.close().catch(() => {});
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
