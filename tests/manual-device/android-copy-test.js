const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9333');
  const page = browser.contexts().flatMap(c => c.pages())[0];
  const out = await page.evaluate(async () => {
    const src = '/storage/emulated/0/Documents/ELM_Data';
    const dst = '/storage/emulated/0/Documents/ELM_Data_copytest';
    const result = { src, dst };
    try {
      await window.__TAURI__.core.invoke('grant_vault_scope', { path: src });
      result.srcGranted = true;
    } catch (e) { result.srcGrantError = e.message || String(e); }
    try {
      await window.__TAURI__.core.invoke('grant_vault_scope', { path: dst });
      result.dstGranted = true;
    } catch (e) { result.dstGrantError = e.message || String(e); }

    try {
      const copied = await copyTreeAbsolute(src, dst, 0);
      result.copied = copied;
    } catch (e) {
      result.copyError = e.message || String(e);
      result.copyErrorFull = JSON.stringify(e);
      result.copyErrorStack = e.stack;
    }
    return result;
  });
  console.log(JSON.stringify(out, null, 2));
  await browser.close().catch(() => {});
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
