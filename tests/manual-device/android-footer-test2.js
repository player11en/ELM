const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9333');
  const page = browser.contexts().flatMap(c => c.pages())[0];
  const out = await page.evaluate(async () => {
    const target = [...vaultIndex.values()].find(e => !e.isFolder);
    if (!target) return { error: 'no note found' };
    await openNote(target.id);
    await new Promise(r => setTimeout(r, 300));
    const ids = ['deleteNoteBtn', 'exportHtmlBtn', 'presentBtn'];
    const result = { openedId: target.id, windowH: window.innerHeight };
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) { result[id] = 'not-found'; continue; }
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      result[id] = {
        top: r.top, bottom: r.bottom,
        inViewport: r.bottom > 0 && r.top < window.innerHeight && r.width > 0 && r.height > 0,
        display: style.display, visibility: style.visibility,
      };
    }
    return result;
  });
  console.log(JSON.stringify(out, null, 2));
  await browser.close().catch(() => {});
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
