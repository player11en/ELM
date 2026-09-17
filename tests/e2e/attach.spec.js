// Attaching files to a NOTE (not files-mode import): multi-select, and
// drag-drop onto the editor, which previously did nothing at all outside
// files mode. Migrated from pw-test/attach-test.js — same assertions/flow.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const FIX = path.join(__dirname, 'fixtures');
const A = path.join(FIX, 'attach-a.txt');
const B = path.join(FIX, 'attach-b.txt');

const OPFS_STUB = () => {
  window.showDirectoryPicker = async () => {
    const root = await navigator.storage.getDirectory();
    root.queryPermission = async () => 'granted';
    root.requestPermission = async () => 'granted';
    return root;
  };
};

test.beforeAll(() => {
  fs.mkdirSync(FIX, { recursive: true });
  fs.writeFileSync(A, 'file A contents');
  fs.writeFileSync(B, 'file B contents');
});

test('multi-file select and drag-drop attach to a note', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.addInitScript(OPFS_STUB);
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(900);

  // Vault mode so attachments land as real files.
  await page.click('#vaultSetupBtn');
  await page.waitForFunction(() => storageMode === 'files', null, { timeout: 30000 });

  await page.click('#newNoteBtn');
  await page.waitForFunction(() => document.activeElement?.id === 'noteTitleInput');
  await page.fill('#noteTitleInput', 'Attach Target');
  await page.fill('#editorTextarea', 'body\n');
  await page.locator('#editorTextarea').blur();
  await page.waitForTimeout(1000);

  // --- multi-file select through the real input --------------------------
  await page.setInputFiles('#attachFileInput', [A, B]);
  await page.waitForTimeout(2000);

  const afterMulti = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const names = [];
    try {
      const att = await root.getDirectoryHandle('attachments');
      for await (const [n] of att.entries()) names.push(n);
    } catch {}
    return { attachments: names.sort(), body: document.getElementById('editorTextarea').value };
  });
  expect(afterMulti.attachments.length, 'both selected files should be written to attachments/').toBe(2);
  const links = (afterMulti.body.match(/\]\(/g) || []).length;
  expect(links, 'both files should be linked in the note body').toBe(2);
  expect(/\)\n\[|\)\n!\[/.test(afterMulti.body), 'multiple attachments should be newline-separated, not run together').toBe(true);

  // --- drag-drop onto the note -------------------------------------------
  const dropped = await page.evaluate(async () => {
    const dt = new DataTransfer();
    dt.items.add(new File(['dropped contents'], 'dropped-file.txt', { type: 'text/plain' }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 2500));
    const root = await navigator.storage.getDirectory();
    const names = [];
    const att = await root.getDirectoryHandle('attachments');
    for await (const [n] of att.entries()) names.push(n);
    return { attachments: names.sort(), body: document.getElementById('editorTextarea').value };
  });
  expect(dropped.attachments.length, 'dropped file should have been attached').toBe(3);
  expect(dropped.attachments.some(n => n.includes('dropped-file')), 'dropped file missing from attachments/').toBe(true);
  expect(dropped.body, 'dropped file should be linked in the note body').toContain('dropped-file');

  expect(errors).toEqual([]);
});
