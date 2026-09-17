const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9333');
  const page = browser.contexts().flatMap(c => c.pages())[0];
  const out = await page.evaluate(async () => {
    const dir = '/storage/emulated/0/Documents/ELM_Data';
    const testFile = dir + '/__elm_debug_write_test.md';
    const result = {};
    try {
      await window.__TAURI__.fs.writeTextFile(testFile, 'test content');
      result.wrote = true;
    } catch (e) { result.writeError = e.message || String(e); return result; }

    try {
      const entries = await window.__TAURI__.fs.readDir(dir);
      result.afterWriteEntries = entries.map(e => e.name);
      result.afterWriteCount = entries.length;
      result.ownFileVisible = entries.some(e => e.name === '__elm_debug_write_test.md');
    } catch (e) { result.readDirError = e.message || String(e); }

    // cleanup
    try { await window.__TAURI__.fs.remove(testFile); result.cleaned = true; } catch (e) { result.cleanupError = e.message || String(e); }
    return result;
  });
  console.log(JSON.stringify(out, null, 2));
  await browser.close().catch(() => {});
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
