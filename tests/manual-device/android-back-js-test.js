const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9333');
  const page = browser.contexts().flatMap(c => c.pages())[0];
  const out = await page.evaluate(async () => {
    const target = [...vaultIndex.values()].find(e => !e.isFolder);
    if (!target) return { error: 'no note' };
    await openNote(target.id);
    const beforeNoteId = currentNoteId;
    const handledWithNoteOpen = window.handleAndroidBack();
    const afterNoteId = currentNoteId;
    const handledWithNoNote = window.handleAndroidBack();
    return { beforeNoteId, handledWithNoteOpen, afterNoteId, handledWithNoNote };
  });
  console.log(JSON.stringify(out, null, 2));
  await browser.close().catch(() => {});
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
