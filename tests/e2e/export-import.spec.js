// Export (md/HTML/JSON backup) and import (restore) round-trip. Migrated
// from pw-test/export-import-test.js — same assertions/flow.
const { test, expect } = require('@playwright/test');
const fs = require('fs');

test('export md/HTML/backup, then restore from the backup JSON', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(900);

  // Fresh IndexedDB note to export
  await page.click('#newNoteBtn');
  await page.waitForFunction(() => document.activeElement?.id === 'noteTitleInput');
  await page.fill('#noteTitleInput', 'Export Import Test Note');
  await page.fill('#editorTextarea', '# Export test\n\nSome content for round-trip verification.\n');
  await page.locator('#editorTextarea').blur();
  await page.waitForTimeout(1000);

  // --- single-note .md export ------------------------------------------------
  const mdDownload = page.waitForEvent('download');
  await page.click('#exportBtn');
  const md = await mdDownload;
  const mdContent = fs.readFileSync(await md.path(), 'utf8');
  expect(mdContent, '.md export missing content').toContain('Export test');
  expect(mdContent, '.md export missing body').toContain('Some content for round-trip verification');

  // --- single-note HTML export -----------------------------------------------
  const htmlDownload = page.waitForEvent('download');
  await page.click('#exportHtmlBtn');
  const html = await htmlDownload;
  const htmlContent = fs.readFileSync(await html.path(), 'utf8');
  expect(htmlContent, 'HTML export missing rendered heading').toContain('<h1');
  expect(/round-trip verification/.test(htmlContent), 'HTML export missing body text').toBe(true);

  // --- full JSON backup download ----------------------------------------------
  // #backupBtn exists but is responsively relegated into the header overflow
  // menu at this viewport (confirmed by smoke.spec.js's own passing overflow-
  // menu assertion) — go through the overflow, same pattern already proven
  // there, not the stale direct-button click this script originally used.
  const backupDownload = page.waitForEvent('download');
  await page.click('#headerOverflowBtn');
  await page.click('#headerOverflowPopover .popover-menu-item:has-text("Backup")');
  const backup = await backupDownload;
  const backupContent = fs.readFileSync(await backup.path(), 'utf8');
  const backupJson = JSON.parse(backupContent);
  expect(backupJson.version, 'backup missing version').toBeTruthy();
  expect(Array.isArray(backupJson.notes) && backupJson.notes.length >= 1, 'backup missing notes array').toBe(true);
  expect(backupJson.notes.some(n => n.title === 'Export Import Test Note'), 'backup missing our note').toBe(true);

  // --- restore (import) round-trip: wipe db, restore from the backup JSON, verify note comes back
  // restoreAll() confirms before actually restoring (added after this script
  // was first written) — an unhandled dialog auto-dismisses in Playwright,
  // which silently no-ops the whole restore. Accept it for real.
  page.on('dialog', d => d.accept());
  const restoreResult = await page.evaluate(async (backupJsonStr) => {
    // Directly exercise restoreAll's real code path with a real File object,
    // same as the file-input handler does — not reimplementing its logic.
    const file = new File([backupJsonStr], 'backup.json', { type: 'application/json' });
    // Wipe first so restore isn't a no-op confirming nothing.
    const tx = db.transaction(['notes', 'folders', 'attachments'], 'readwrite');
    await tx.objectStore('notes').clear();
    await tx.objectStore('folders').clear();
    await tx.objectStore('attachments').clear();
    await tx.done;
    const beforeCount = (await dbGetAll('notes')).length;
    await restoreAll(file);
    // restoreAll writes synchronously before its setTimeout(reload), so check now
    const afterNotes = await dbGetAll('notes');
    return { beforeCount, afterCount: afterNotes.length, titles: afterNotes.map(n => n.title) };
  }, backupContent);
  expect(restoreResult.beforeCount, 'db not actually wiped before restore').toBe(0);
  expect(restoreResult.titles, 'restored notes missing our note').toContain('Export Import Test Note');

  expect(errors, 'console/page errors occurred').toEqual([]);
});
