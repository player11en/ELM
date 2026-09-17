const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9333');
  const page = browser.contexts().flatMap(c => c.pages())[0];
  const out = await page.evaluate(async () => {
    const result = { windowWidth: window.innerWidth };
    const target = [...vaultIndex.values()].find(e => !e.isFolder);
    if (!target) return { error: 'no note' };
    await openNote(target.id);
    document.getElementById('midPanel').classList.add('hidden-mobile');
    result.afterOpen = {
      mobileNoteOpen: document.getElementById('layout').classList.contains('mobile-note-open'),
      midHidden: document.getElementById('midPanel').classList.contains('hidden-mobile'),
    };
    // Exact same sequence as the delete button handler
    const id = target.id;
    closeNote();
    await deleteNote(id);
    await refreshAll();
    const layout = document.getElementById('layout');
    const midPanel = document.getElementById('midPanel');
    const main = document.getElementById('main') || document.querySelector('.main');
    result.afterDelete = {
      mobileNoteOpen: layout.classList.contains('mobile-note-open'),
      midHiddenMobile: midPanel.classList.contains('hidden-mobile'),
      midPanelDisplay: getComputedStyle(midPanel).display,
      mainDisplay: main ? getComputedStyle(main).display : 'no-main-el',
      vaultIndexSize: vaultIndex.size,
    };
    return result;
  });
  console.log(JSON.stringify(out, null, 2));
  await browser.close().catch(() => {});
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
