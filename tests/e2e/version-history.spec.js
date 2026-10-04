// Version history: the History tab lists Syncthing's .stversions copies of
// the open note, diffs them against the editor, and restores into the editor.
const { test, expect } = require('@playwright/test');

const OPFS_STUB = () => {
  window.showDirectoryPicker = async () => {
    const root = await navigator.storage.getDirectory();
    root.queryPermission = async () => 'granted';
    root.requestPermission = async () => 'granted';
    return root;
  };
};

async function connectVault(page) {
  await page.addInitScript(OPFS_STUB);
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.click('#vaultSetupBtn');
  await page.waitForFunction(() => storageMode === 'files', null, { timeout: 30000 });
}

// Creates "Lore/Hero" with body "current text" and returns { id, path }.
async function makeHero(page) {
  return page.evaluate(async () => {
    selectedFolderId = await createFolder('Lore');
    const id = await createNote();
    await saveNote(id, { title: 'Hero', body: 'line one\ncurrent text\n' });
    await refreshAll();
    await openNote(id);
    return { id, path: vaultIndex.get(id).path };
  });
}
const putVersion = (page, relPath, tag, body) => page.evaluate(async ([relPath, tag, body]) => {
  await vaultAdapter.writeText(relPath.replace(/\.md$/, `~${tag}.md`), '---\ntitle: Hero\n---\n\n' + body);
}, [relPath, tag, body]);
const openHistoryTab = page => page.click('#footerTabBar [data-tab="history"]');

test('without .stversions the tab explains Syncthing is not in use', async ({ page }) => {
  await connectVault(page);
  await makeHero(page);
  await openHistoryTab(page);
  await expect(page.locator('#historySection')).toContainText('.stversions');
  await expect(page.locator('#tabBadgeHistory')).toBeHidden();
});

test('versions list newest first with a badge; other notes\' and non-md files are ignored', async ({ page }) => {
  await connectVault(page);
  const { path } = await makeHero(page);
  const stPath = '.stversions/' + path;
  await putVersion(page, stPath, '20260910-090000', 'old one');
  await putVersion(page, stPath, '20260915-173000', 'old two');
  await putVersion(page, '.stversions/Lore/Other.md', '20260912-100000', 'not mine');
  await page.evaluate(async () => { await vaultAdapter.writeText('.stversions/Lore/' + vaultIndex.get(currentNoteId).path.split('/').pop().replace('.md', '~20260911-000000.png'), 'x'); });
  await page.evaluate(() => renderHistorySection());

  const dates = await page.$$eval('#historySection .history-item-date', els => els.map(e => e.textContent));
  expect(dates).toHaveLength(2);
  expect(await page.evaluate(() => Number(document.getElementById('historySection').dataset.count))).toBe(2);
  await expect(page.locator('#tabBadgeHistory')).toBeVisible();
  const ts = await page.evaluate(async p => (await listNoteVersions(vaultIndex.get(currentNoteId))).versions.map(v => v.ts), path);
  expect(ts[0]).toBeGreaterThan(ts[1]);
});

test('Diff shows added/removed lines; identical version says so', async ({ page }) => {
  await connectVault(page);
  const { path } = await makeHero(page);
  const stPath = '.stversions/' + path;
  await putVersion(page, stPath, '20260910-090000', 'line one\nold text\n');
  await putVersion(page, stPath, '20260911-090000', 'line one\ncurrent text\n');
  await page.evaluate(() => renderHistorySection());

  await openHistoryTab(page);
  await page.locator('.history-diff-btn').nth(1).click();   // oldest
  await expect(page.locator('#versionDiffBackdrop')).toBeVisible();
  await expect(page.locator('#versionDiffBody .diff-del')).toContainText('old text');
  await expect(page.locator('#versionDiffBody .diff-add')).toContainText('current text');
  await page.keyboard.press('Escape');
  await expect(page.locator('#versionDiffBackdrop')).toBeHidden();

  await page.locator('.history-diff-btn').nth(0).click();   // newest, identical
  await expect(page.locator('#versionDiffBody')).toContainText('identical');
});

test('Restore loads the old body into the editor and leaves the file alone until autosave', async ({ page }) => {
  await connectVault(page);
  const { id, path } = await makeHero(page);
  await putVersion(page, '.stversions/' + path, '20260910-090000', 'restored body\n');
  await page.evaluate(() => renderHistorySection());
  const before = await page.evaluate(p => vaultAdapter.readText(p), path);
  const cur = () => page.evaluate(id => vaultAdapter.readText(vaultIndex.get(id).path), id);   // autosave may rename untitled.md -> hero.md

  page.once('dialog', d => d.accept());
  await openHistoryTab(page);
  await page.click('.history-restore-btn');
  await expect(page.locator('#editorTextarea')).toHaveValue('restored body\n');
  expect(await cur(), 'not written yet').toBe(before);

  await page.waitForFunction(async (id) => (await vaultAdapter.readText(vaultIndex.get(id).path))?.includes('restored body'), id, { timeout: 15000 });
  expect(await cur(), 'frontmatter kept').toContain('title: Hero');
});
