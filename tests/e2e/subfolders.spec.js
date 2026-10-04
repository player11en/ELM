// Subfolders: create them in-app (files mode), see them as a collapsible tree,
// and have a parent folder include everything beneath it.
//
// Before this, nested folders on disk showed up indented and notes could be
// moved into them, but "+ New Folder" only ever made top-level ones (it strips
// "/" from the name), counts were direct-children-only, and clicking a parent
// hid its sub-folders' notes.
//
// Files mode runs against OPFS standing in for the File System Access API, same
// as the vault-adapter spec.
const { test, expect } = require('@playwright/test');

const OPFS_STUB = () => {
  window.showDirectoryPicker = async () => {
    const root = await navigator.storage.getDirectory();
    root.queryPermission = async () => 'granted';
    root.requestPermission = async () => 'granted';
    return root;
  };
};

const row = (page, id) => page.locator(`#folderList .folder-item[data-folder-id="${id}"]`);

async function connectVault(page) {
  await page.addInitScript(OPFS_STUB);
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.click('#vaultSetupBtn');
  await page.waitForFunction(() => storageMode === 'files', null, { timeout: 30000 });
}

// Real UI path: "+ New Folder" for the top level, a row's "+" for a subfolder.
async function newTopFolder(page, name) {
  await page.click('#addFolderBtn');
  await page.fill('#newFolderInput', name);
  await page.press('#newFolderInput', 'Enter');
  await expect(row(page, name)).toBeVisible();
}
async function newSubfolder(page, parentId, name) {
  await row(page, parentId).hover();
  await row(page, parentId).locator('.folder-add-sub').click();
  await expect(page.locator('#newFolderInput'), 'input should name its parent').toHaveAttribute('placeholder', new RegExp(parentId.split('/').pop()));
  await page.fill('#newFolderInput', name);
  await page.press('#newFolderInput', 'Enter');
  await expect(row(page, `${parentId}/${name}`)).toBeVisible();
}
const addNote = (page, folderId, title, body = 'body') => page.evaluate(async ([folderId, title, body]) => {
  selectedFolderId = folderId;
  const id = await createNote();
  await saveNote(id, { title, body });
  return id;
}, [folderId, title, body]);
const listedTitles = page => page.$$eval('#notesList .ni-title', els => els.map(e => e.textContent).sort());

test('create nested folders with the row "+" and see them as a tree', async ({ page }) => {
  await connectVault(page);
  await newTopFolder(page, 'Lore');
  await newSubfolder(page, 'Lore', 'Book 1');
  await newSubfolder(page, 'Lore/Book 1', 'Ch 1');

  // They are real directories, not just sidebar rows.
  const onDisk = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const lore = await root.getDirectoryHandle('Lore');
    const b1 = await lore.getDirectoryHandle('Book 1');
    await b1.getDirectoryHandle('Ch 1');
    return true;
  });
  expect(onDisk, 'Lore/Book 1/Ch 1 exists on disk').toBe(true);

  // Indentation grows with depth.
  const pad = id => row(page, id).evaluate(el => parseInt(getComputedStyle(el).paddingLeft, 10));
  expect(await pad('Lore/Book 1')).toBeGreaterThan(await pad('Lore'));
  expect(await pad('Lore/Book 1/Ch 1')).toBeGreaterThan(await pad('Lore/Book 1'));
});

test('a parent folder includes its sub-folders\' notes, with recursive counts', async ({ page }) => {
  await connectVault(page);
  await newTopFolder(page, 'Lore');
  await newSubfolder(page, 'Lore', 'Book 1');
  await newSubfolder(page, 'Lore/Book 1', 'Ch 1');
  await addNote(page, null, 'Root note');
  await addNote(page, 'Lore', 'Lore note');
  await addNote(page, 'Lore/Book 1', 'Book note');
  await addNote(page, 'Lore/Book 1/Ch 1', 'Chapter note', 'a needle here');
  await page.evaluate(() => refreshAll());

  const count = id => row(page, id).locator('.folder-count').textContent();
  expect(await count('Lore'), 'Lore counts the whole tree').toBe('3');
  expect(await count('Lore/Book 1')).toBe('2');
  expect(await count('Lore/Book 1/Ch 1')).toBe('1');

  await row(page, 'Lore').click();
  await page.waitForTimeout(300);
  expect(await listedTitles(page), 'selecting Lore lists everything under it, not the root note')
    .toEqual(['Book note', 'Chapter note', 'Lore note']);

  await row(page, 'Lore/Book 1').click();
  await page.waitForTimeout(300);
  expect(await listedTitles(page)).toEqual(['Book note', 'Chapter note']);

  // Search inside a folder respects the tree too.
  await row(page, 'Lore').click();
  await page.fill('#searchInput', 'needle');
  await page.waitForTimeout(700);
  expect(await listedTitles(page), 'search scoped to Lore finds the nested note').toEqual(['Chapter note']);
});

test('the caret collapses and expands a branch, and the choice is remembered', async ({ page }) => {
  await connectVault(page);
  await newTopFolder(page, 'Lore');
  await newSubfolder(page, 'Lore', 'Book 1');
  await newSubfolder(page, 'Lore/Book 1', 'Ch 1');
  await addNote(page, 'Lore/Book 1/Ch 1', 'Deep note');
  await page.evaluate(() => { selectedFolderId = null; return refreshAll(); });

  await expect(row(page, 'Lore/Book 1/Ch 1')).toBeVisible();
  await row(page, 'Lore').locator('.folder-toggle').click();
  await expect(row(page, 'Lore/Book 1'), 'child hidden').toHaveCount(0);
  await expect(row(page, 'Lore/Book 1/Ch 1'), 'grandchild hidden too').toHaveCount(0);
  expect(await row(page, 'Lore').locator('.folder-count').textContent(), 'collapsed parent still reports what is inside').toBe('1');
  expect(await page.evaluate(() => localStorage.getItem('elm-collapsed-folders')), 'remembered').toContain('Lore');

  // Collapsing must not have selected the folder.
  expect(await page.evaluate(() => selectedFolderId)).toBeNull();

  await row(page, 'Lore').locator('.folder-toggle').click();
  await expect(row(page, 'Lore/Book 1/Ch 1')).toBeVisible();

  // Creating a subfolder inside a collapsed parent must reveal it.
  await row(page, 'Lore').locator('.folder-toggle').click();      // collapse again
  await row(page, 'Lore').hover();
  await row(page, 'Lore').locator('.folder-add-sub').click();
  await page.fill('#newFolderInput', 'Book 2');
  await page.press('#newFolderInput', 'Enter');
  await expect(row(page, 'Lore/Book 2'), 'new subfolder visible after creation').toBeVisible();
});

test('nesting stops at the depth the vault scanner can index', async ({ page }) => {
  await connectVault(page);
  const made = await page.evaluate(async () => {
    const ids = [await createFolder('a')];
    for (const n of ['b', 'c', 'd', 'e']) ids.push(await createFolder(n, undefined, ids[ids.length - 1]));
    const tooDeep = await createFolder('f', undefined, ids[ids.length - 1]);
    await refreshAll();
    return { ids, tooDeep, max: MAX_VAULT_DEPTH };
  });
  expect(made.ids.every(Boolean), `levels 1..${made.max} are allowed`).toBe(true);
  expect(made.tooDeep, 'one level deeper is refused').toBeNull();
  await expect(row(page, made.ids[made.ids.length - 1]).locator('.folder-add-sub'), 'no "+" on a folder that cannot take a child').toHaveCount(0);
});

test('deleting a parent folder moves every nested note out and removes the tree', async ({ page }) => {
  await connectVault(page);
  await newTopFolder(page, 'Lore');
  await newSubfolder(page, 'Lore', 'Book 1');
  await addNote(page, 'Lore', 'Lore note');
  await addNote(page, 'Lore/Book 1', 'Book note');
  await page.evaluate(() => refreshAll());

  page.once('dialog', d => d.accept());
  await row(page, 'Lore').hover();
  await row(page, 'Lore').locator('.folder-delete').click();
  await expect(row(page, 'Lore')).toHaveCount(0);
  await expect(row(page, 'Lore/Book 1')).toHaveCount(0);

  const titles = await page.evaluate(async () => (await getAllNotes()).map(n => n.title).sort());
  expect(titles, 'no note was lost').toEqual(['Book note', 'Lore note']);
});

test('IndexedDB mode: folders stay flat, and the note\'s Folder dropdown shows names, not UUIDs', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => storageMode)).toBe('indexeddb');

  await page.evaluate(async () => {
    const fid = await createFolder('Lore');
    selectedFolderId = fid;
    const id = await createNote();
    await saveNote(id, { title: 'In Lore', body: 'x' });
    await refreshAll();
    await openNote(id);
  });
  await expect(page.locator('#folderList .folder-item', { hasText: 'Lore' })).toBeVisible();
  expect(await page.locator('#folderList .folder-toggle, #folderList .folder-add-sub').count(), 'no tree controls without real directories').toBe(0);

  const options = await page.$$eval('#folderSelect option', els => els.map(e => e.textContent));
  expect(options, 'dropdown lists the folder by name').toContain('Lore');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
  expect(options.some(o => uuid.test(o)), 'dropdown must not show raw UUIDs').toBe(false);
});
