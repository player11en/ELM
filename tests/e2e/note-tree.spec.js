// Note tree: notes nest under the note named in their `parent:` property.
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

// Writes notes straight to disk with a parent property, then lets the app index them.
async function seed(page, notes) {
  await page.evaluate(async (notes) => {
    for (const [title, parent] of notes) {
      const fm = ['---', `title: ${title}`, parent ? `parent: "[[${parent}]]"` : null, '---', '', 'body'].filter(x => x !== null).join('\n');
      await vaultAdapter.writeText(`${title}.md`, fm);
    }
    await reconcileVault();
    await refreshAll();
  }, notes);
}

test('tree nests children under their parent, and only lists notes in a hierarchy', async ({ page }) => {
  await connectVault(page);
  await seed(page, [['Saga', null], ['Book One', 'Saga'], ['Chapter 1', 'Book One'], ['Book Two', 'Saga'], ['Loner', null]]);
  await page.evaluate(() => openNoteTree());

  const depthOf = async title => page.locator('#treeBody .tree-node', { hasText: new RegExp(`^${title}$`) })
    .evaluate(el => { let d = 0; for (let p = el.parentElement; p && p.id !== 'treeBody'; p = p.parentElement) if (p.classList.contains('tree-children')) d++; return d; });

  expect(await depthOf('Saga')).toBe(0);
  expect(await depthOf('Book One')).toBe(1);
  expect(await depthOf('Chapter 1')).toBe(2);
  expect(await depthOf('Book Two')).toBe(1);
  await expect(page.locator('#treeBody .tree-node', { hasText: 'Loner' }), 'unrelated note not listed').toHaveCount(0);
});

test('clicking a node opens that note and closes the tree', async ({ page }) => {
  await connectVault(page);
  await seed(page, [['Saga', null], ['Book One', 'Saga']]);
  await page.evaluate(() => openNoteTree());
  await page.click('#treeBody .tree-node:has-text("Book One")');
  await expect(page.locator('#treeBackdrop')).toBeHidden();
  expect(await page.evaluate(() => vaultIndex.get(currentNoteId).title)).toBe('Book One');
});

test('a parent cycle does not hang or hide the notes', async ({ page }) => {
  await connectVault(page);
  await seed(page, [['Ping', 'Pong'], ['Pong', 'Ping']]);
  await page.evaluate(() => openNoteTree());
  expect(await page.locator('#treeBody .tree-node').count(), 'both notes shown, finite').toBeGreaterThanOrEqual(2);
  expect(await page.locator('#treeBody .tree-node').count()).toBeLessThan(10);
});

test('empty state explains how to use it; Escape closes', async ({ page }) => {
  await connectVault(page);
  await page.evaluate(() => openNoteTree());
  await expect(page.locator('#treeBody')).toContainText('No notes have a parent yet');
  await expect(page.locator('#treeBody')).toContainText('parent:');
  await page.keyboard.press('Escape');
  await expect(page.locator('#treeBackdrop')).toBeHidden();
});
