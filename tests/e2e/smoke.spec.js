// Broad smoke test (legacy/IndexedDB mode). Covers core note flow plus UI
// features across the app, so a regression anywhere obvious gets caught on
// every PR. Migrated from the ad-hoc pw-test/smoke.js script written during
// development — same assertions, same flow, now on @playwright/test's
// fixtures (auto browser launch/teardown, baseURL from playwright.config.js)
// instead of manual chromium.launch()/assert().
//
// Kept as ONE continuous test rather than split into several: the final
// check (state survives a page.reload()) is only meaningful if it's the
// same session that created the notes/folder, and Playwright gives each
// `test()` a fresh page/context by default — splitting this up would lose
// exactly the thing it's testing.
const { test, expect } = require('@playwright/test');

test('create notes, use core UI features, and survive a reload', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(900);

  // --- create + save a note -------------------------------------------------
  await page.click('#newNoteBtn');
  await page.waitForFunction(() => document.activeElement?.id === 'noteTitleInput');
  await page.fill('#noteTitleInput', 'Smoke Note');
  await page.fill('#editorTextarea',
    '# Smoke Note\n\nLink to [[Second Note]].\n\n```javascript\nconst x = 1;\n```\n\n- [ ] a task\n');
  await page.locator('#editorTextarea').blur();
  await page.waitForTimeout(1200);

  // --- markdown + syntax highlighting in preview ---------------------------
  await page.click('.view-btn[data-view="preview"]');
  await page.waitForTimeout(700);
  const preview = await page.evaluate(() => ({
    h1: !!document.querySelector('#editorPreview h1'),
    hljs: !!document.querySelector('#editorPreview .hljs-keyword'),
    wikilink: !!document.querySelector('#editorPreview .wikilink'),
  }));
  expect(preview.h1, 'heading did not render').toBe(true);
  expect(preview.hljs, 'syntax highlighting did not apply').toBe(true);
  expect(preview.wikilink, 'wikilink did not render').toBe(true);
  await page.click('.view-btn[data-view="edit"]');

  // --- second note + folder -------------------------------------------------
  await page.click('#newNoteBtn');
  await page.waitForFunction(() => document.activeElement?.id === 'noteTitleInput');
  await page.fill('#noteTitleInput', 'Second Note');
  await page.fill('#editorTextarea', 'Second body with searchterm inside.');
  await page.locator('#editorTextarea').blur();
  await page.waitForTimeout(1200);

  await page.click('#addFolderBtn');
  await page.fill('#newFolderInput', 'Smoke Folder');
  await page.click('#saveFolderBtn');
  await page.waitForTimeout(700);
  const folders = await page.$$eval('.folder-name', els => els.map(e => e.textContent));
  expect(folders, 'folder not created').toContain('Smoke Folder');

  // --- search ---------------------------------------------------------------
  await page.fill('#searchInput', 'searchterm');
  await page.waitForTimeout(800);
  const hits = await page.$$eval('.ni-title', els => els.map(e => e.textContent));
  expect(hits, 'search did not filter to the matching note').toEqual(['Second Note']);
  await page.fill('#searchInput', '');
  await page.waitForTimeout(600);

  // --- UI features -----------------------------------------------------------
  const sidebarW0 = await page.$eval('.sidebar', el => el.getBoundingClientRect().width);
  await page.click('#sidebarCollapseBtn');
  await page.waitForTimeout(300);
  const sidebarW1 = await page.$eval('.sidebar', el => el.getBoundingClientRect().width);
  expect(sidebarW0, 'sidebar collapse toggle broken').toBeGreaterThan(100);
  expect(sidebarW1, 'sidebar collapse toggle broken').toBe(0);
  await page.click('#sidebarCollapseBtn');

  await page.click('.note-item');
  await page.waitForTimeout(500);
  const footerVisible0 = await page.$eval('.footer-fields', el => getComputedStyle(el).display !== 'none');
  await page.click('#footerCollapseBtn');
  await page.waitForTimeout(300);
  const footerVisible1 = await page.$eval('.footer-fields', el => getComputedStyle(el).display !== 'none');
  const actionsStillVisible = await page.$eval('.footer-actions', el => getComputedStyle(el).display !== 'none');
  expect(footerVisible0 && !footerVisible1 && actionsStillVisible, 'footer collapse toggle broken').toBe(true);
  await page.click('#footerCollapseBtn');

  // overflow menu: desktop shows only the low-frequency actions
  await page.click('#headerOverflowBtn');
  await page.waitForTimeout(250);
  const overflow = await page.$$eval('#headerOverflowPopover .popover-menu-item', els => els.map(e => e.textContent));
  expect(overflow, 'overflow menu contents changed').toEqual(
    ['⬆ Backup', '⬇ Restore', '📖 Style guide', '📅 Today\'s note', '🕸 Graph view', '🌐 Publish site']
  );
  await page.click('#headerOverflowPopover .popover-menu-item:has-text("Style guide")');
  await page.waitForTimeout(400);
  const sgOpen = await page.$eval('#styleGuideBackdrop', el => getComputedStyle(el).display !== 'none');
  expect(sgOpen, 'style guide did not open from the overflow menu').toBe(true);
  await page.keyboard.press('Escape');

  // align dropdown
  await page.click('#editorTextarea');
  await page.click('.toolbar-dropdown-btn[data-dropdown="align"]');
  await page.waitForTimeout(250);
  const alignItems = await page.$$eval('#toolbarDropdownPopover .popover-menu-item', els => els.map(e => e.textContent));
  expect(alignItems, 'align dropdown changed').toEqual(['⬅ Left', '↔ Center', '➡ Right']);
  await page.keyboard.press('Escape');

  // command palette
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(400);
  const paletteOpen = await page.$eval('#cmdkBackdrop', el => getComputedStyle(el).display !== 'none').catch(() => false);
  expect(paletteOpen, 'command palette did not open').toBe(true);
  await page.keyboard.press('Escape');

  // --- persistence across reload -------------------------------------------
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const afterReload = await page.evaluate(() => ({
    titles: [...document.querySelectorAll('.ni-title')].map(e => e.textContent).sort(),
    folders: [...document.querySelectorAll('.folder-name')].map(e => e.textContent),
  }));
  expect(afterReload.titles, 'notes lost across reload').toEqual(['Second Note', 'Smoke Note']);
  expect(afterReload.folders, 'folder lost across reload').toContain('Smoke Folder');

  expect(errors, 'console/page errors during smoke run').toEqual([]);
});
