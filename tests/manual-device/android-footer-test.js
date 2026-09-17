const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9333');
  const page = browser.contexts().flatMap(c => c.pages())[0];
  const out = await page.evaluate(() => {
    const ids = ['deleteNoteBtn', 'exportHtmlBtn', 'presentBtn'];
    const result = {};
    for (const id of ids) {
      const el = document.getElementById(id) || document.querySelector(`[data-action="${id}"]`);
      if (!el) { result[id] = 'not-found'; continue; }
      const r = el.getBoundingClientRect();
      result[id] = { top: r.top, bottom: r.bottom, visible: r.bottom > 0 && r.top < window.innerHeight, windowH: window.innerHeight };
    }
    return result;
  });
  console.log(JSON.stringify(out, null, 2));
  await browser.close().catch(() => {});
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
