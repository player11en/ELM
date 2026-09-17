const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9333');
  const page = browser.contexts().flatMap(c => c.pages())[0];
  const out = await page.evaluate(async () => {
    const result = { steps: [] };
    try {
      result.beforeSize = vaultIndex.size;
      const target = [...vaultIndex.values()].find(e => !e.isFolder) || [...vaultIndex.values()][0];
      result.target = target ? { id: target.id, path: target.path } : null;
      if (target) {
        await deleteNote(target.id);
        result.deleteOk = true;
        result.afterSize = vaultIndex.size;
      }
    } catch (e) {
      result.deleteError = e.message || String(e);
      result.deleteStack = e.stack;
    }
    return result;
  });
  console.log(JSON.stringify(out, null, 2));
  await browser.close().catch(() => {});
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
