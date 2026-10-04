// Trash view: deleted notes are listed with where they came from, and can be
// restored to that place, deleted for good, or cleared in one go.
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

const makeNote = (page, folder, title) => page.evaluate(async ([folder, title]) => {
  let fid = null;
  if (folder) fid = (await getAllFolders()).find(f => f.id === folder)?.id || await createFolder(folder);
  selectedFolderId = fid;
  const id = await createNote();
  await saveNote(id, { title, body: 'body of ' + title });
  await refreshAll();
  return id;
}, [folder, title]);

const trashItems = page => page.$$eval('#trashBody .trash-item .trash-item-name', els => els.map(e => e.textContent));

test('Trash button only exists in files mode', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await expect(page.locator('#trashOpenBtn')).toBeHidden();
});

test('a deleted note shows in Trash and restores into its original folder', async ({ page }) => {
  await connectVault(page);
  const id = await makeNote(page, 'Lore', 'Dragon');
  await page.evaluate(id => deleteNote(id), id);
  await page.evaluate(() => refreshAll());

  expect(await page.evaluate(async () => (await getAllNotes()).map(n => n.title))).not.toContain('Dragon');

  await page.click('#trashOpenBtn');
  await expect(page.locator('#trashBackdrop')).toBeVisible();
  expect(await trashItems(page)).toHaveLength(1);
  await expect(page.locator('#trashBody .trash-item-meta')).toContainText('Lore/');

  await page.click('#trashBody .trash-restore-btn');
  await expect(page.locator('#trashBody .trash-empty')).toBeVisible();

  const back = await page.evaluate(async () => (await getAllNotes()).filter(n => n.title === 'Dragon').map(n => n.folderId));
  expect(back, 'note is back, in Lore').toEqual(['Lore']);
});

test('restore never overwrites: a taken name gets a suffix', async ({ page }) => {
  await connectVault(page);
  const id = await makeNote(page, null, 'Same');
  const pathBefore = await page.evaluate(id => vaultIndex.get(id).path, id);
  await page.evaluate(id => deleteNote(id), id);
  // A new note grabs the freed file name.
  await page.evaluate(async (p) => { await vaultAdapter.writeText(p, '---\ntitle: Squatter\n---\n\nhi'); }, pathBefore);

  await page.evaluate(() => openTrash());
  await page.click('#trashBody .trash-restore-btn');
  await expect(page.locator('#trashBody .trash-empty')).toBeVisible();

  const files = await page.evaluate(async () => (await vaultAdapter.list('')).filter(e => e.kind === 'file').map(e => e.name).sort());
  expect(files.filter(n => n.endsWith('.md')), 'both files exist').toHaveLength(2);
  expect(await page.evaluate(async p => (await vaultAdapter.readText(p)).includes('Squatter'), pathBefore), 'squatter untouched').toBe(true);
});

test('delete forever and empty trash remove the files', async ({ page }) => {
  await connectVault(page);
  for (const t of ['A', 'B', 'C']) {
    const id = await makeNote(page, null, t);
    await page.evaluate(id => deleteNote(id), id);
  }
  await page.evaluate(() => openTrash());
  expect(await trashItems(page)).toHaveLength(3);

  page.on('dialog', d => d.accept());
  await page.click('#trashBody .trash-delete-btn');
  await expect(page.locator('#trashBody .trash-item')).toHaveCount(2);

  await page.click('#trashEmptyBtn');
  await expect(page.locator('#trashBody .trash-empty')).toBeVisible();
  expect(await page.evaluate(async () => (await vaultAdapter.list('.trash')).length)).toBe(0);
});

test('Escape closes the Trash', async ({ page }) => {
  await connectVault(page);
  await page.evaluate(() => openTrash());
  await expect(page.locator('#trashBackdrop')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#trashBackdrop')).toBeHidden();
});
