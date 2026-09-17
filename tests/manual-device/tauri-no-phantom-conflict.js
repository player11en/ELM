// The Date-vs-number mtime bug also fed the save-time conflict check
// (`stat.mtime !== currentNoteDiskMtime`), which with two Date objects is
// ALWAYS true — so every save of an open note claimed the file had changed
// underneath. If that's still happening, this save blocks on a real native
// confirm dialog and the assertion below times out instead of passing.
const { chromium } = require('playwright');
const assert = require('assert');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9341');
  const page = browser.contexts().flatMap(c => c.pages())[0];
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  // Open the first existing note (read-then-write of the user's own vault is
  // what a normal edit does anyway; content is restored below).
  await page.click('.note-item');
  await page.waitForTimeout(800);
  const original = await page.evaluate(() => document.getElementById('editorTextarea').value);

  const marker = `\n\nphantom-conflict-probe ${Date.now()}`;
  await page.fill('#editorTextarea', original + marker);
  await page.locator('#editorTextarea').blur();

  // Poll for the save to actually complete. A phantom conflict would park a
  // native dialog on screen and this never reaches "Saved".
  let saved = false;
  for (let i = 0; i < 30; i++) {
    const s = await page.evaluate(() => document.getElementById('saveStatus')?.textContent || '');
    if (/saved/i.test(s)) { saved = true; break; }
    await page.waitForTimeout(200);
  }
  console.log('save completed without a conflict prompt:', saved);
  assert(saved, 'save did not complete — a phantom "changed on disk" dialog is likely blocking it');

  // Save a second time: this is where the stale-mtime comparison would bite,
  // since the file's mtime has now definitely moved since it was opened.
  await page.fill('#editorTextarea', original + marker + '\nsecond edit');
  await page.locator('#editorTextarea').blur();
  let saved2 = false;
  for (let i = 0; i < 30; i++) {
    const s = await page.evaluate(() => document.getElementById('saveStatus')?.textContent || '');
    if (/saved/i.test(s)) { saved2 = true; break; }
    await page.waitForTimeout(200);
  }
  console.log('second consecutive save also clean:', saved2);
  assert(saved2, 'second save blocked — phantom conflict on re-save');

  // Put the note back the way it was.
  await page.fill('#editorTextarea', original);
  await page.locator('#editorTextarea').blur();
  await page.waitForTimeout(1500);
  const restored = await page.evaluate(() => document.getElementById('editorTextarea').value);
  assert.strictEqual(restored, original, 'failed to restore the note content');
  console.log('note content restored');

  console.log('errors:', JSON.stringify(errors));
  assert.strictEqual(errors.length, 0);
  console.log('=== NO PHANTOM CONFLICT — SAVES CLEAN ===');
  await browser.close().catch(() => {});
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
