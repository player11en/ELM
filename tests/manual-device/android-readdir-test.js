const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9333');
  const page = browser.contexts().flatMap(c => c.pages())[0];
  const out = await page.evaluate(async () => {
    const src = '/storage/emulated/0/Documents/ELM_Data';
    const result = {};
    try {
      const entries = await window.__TAURI__.fs.readDir(src);
      result.entries = entries;
      result.count = entries.length;
    } catch (e) {
      result.readDirError = e.message || String(e);
      result.readDirErrorFull = JSON.stringify(e);
    }
    try {
      result.exists = await window.__TAURI__.fs.exists(src);
    } catch (e) { result.existsError = e.message || String(e); }
    return result;
  });
  console.log(JSON.stringify(out, null, 2));
  await browser.close().catch(() => {});
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
