// Files-mode content viewer: the gap where search could tell you a term
// existed and on which line, but never let you read the document. Migrated
// from pw-test/file-viewer-test.js — same assertions/flow.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TMP = path.join(__dirname, 'fixtures');
const TXT = path.join(TMP, 'sample-doc.txt');

test.beforeAll(() => {
  fs.mkdirSync(TMP, { recursive: true });
  const lines = [];
  for (let i = 1; i <= 200; i++) {
    lines.push(i === 137 ? 'the NEEDLE we are searching for lives here' : `filler line number ${i}`);
  }
  fs.writeFileSync(TXT, lines.join('\n'), 'utf8');
});

test('open, navigate, and close the file content viewer', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(900);

  // Files mode + load a real file through the real input.
  await page.click('#filesModeBtn');
  await page.waitForTimeout(300);
  await page.setInputFiles('#fileInput', TXT);
  await page.waitForTimeout(1200);

  const fileRows = await page.$$eval('.file-item .file-name', els => els.map(e => e.textContent));
  expect(fileRows, 'file did not load').toContain('sample-doc.txt');

  // Search, then open the viewer from a specific match line.
  await page.fill('#searchInput', 'NEEDLE');
  await page.waitForTimeout(800);
  const matchLines = await page.$$eval('.match-line .line-num', els => els.map(e => e.textContent));
  expect(matchLines, 'expected the single seeded match at line 137').toEqual(['137']);

  await page.click('.match-line');
  await page.waitForTimeout(600);

  const viewer = await page.evaluate(() => {
    const bd = document.getElementById('fileViewerBackdrop');
    const cur = document.querySelector('.fv-line.fv-current');
    const total = document.querySelectorAll('.fv-line').length;
    const curRect = cur?.getBoundingClientRect();
    const bodyRect = document.getElementById('fileViewerBody').getBoundingClientRect();
    return {
      open: getComputedStyle(bd).display !== 'none',
      title: document.getElementById('fileViewerTitle').textContent,
      totalLines: total,
      currentLineText: cur?.textContent,
      hasHighlight: !!document.querySelector('.fv-line.fv-current mark'),
      // is the focused line actually scrolled into view, not just present?
      inView: !!curRect && curRect.top >= bodyRect.top && curRect.bottom <= bodyRect.bottom,
    };
  });
  expect(viewer.open, 'viewer did not open').toBe(true);
  expect(viewer.totalLines, 'viewer should render the whole file, not just matches').toBe(200);
  expect(viewer.currentLineText, 'focused line is not the matched line').toContain('NEEDLE');
  expect(viewer.hasHighlight, 'match should stay highlighted inside the viewer').toBe(true);
  expect(viewer.inView, 'focused line was not scrolled into view').toBe(true);
  expect(viewer.title, 'viewer title wrong').toContain('sample-doc.txt');
  expect(viewer.title, 'viewer title wrong').toContain('200 lines');

  // Escape closes it.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  expect(await page.$eval('#fileViewerBackdrop', el => getComputedStyle(el).display === 'none'),
    'Escape did not close viewer').toBe(true);

  // Sidebar row opens it too (previously the row did nothing).
  await page.click('.file-item .file-name');
  await page.waitForTimeout(500);
  const fromSidebar = await page.evaluate(() => ({
    open: getComputedStyle(document.getElementById('fileViewerBackdrop')).display !== 'none',
    scrolledToTop: document.getElementById('fileViewerBody').scrollTop === 0,
  }));
  expect(fromSidebar.open, 'sidebar row did not open the viewer').toBe(true);
  expect(fromSidebar.scrolledToTop, 'no focus line given — should start at the top').toBe(true);

  // Backdrop click closes.
  await page.click('#fileViewerBackdrop', { position: { x: 5, y: 5 } });
  await page.waitForTimeout(300);
  expect(await page.$eval('#fileViewerBackdrop', el => getComputedStyle(el).display === 'none'),
    'backdrop click did not close').toBe(true);

  // "Open" button on the result card.
  await page.click('.result-header .export-btn');
  await page.waitForTimeout(400);
  expect(await page.$eval('#fileViewerBackdrop', el => getComputedStyle(el).display !== 'none'),
    'Open button did not work').toBe(true);
  await page.keyboard.press('Escape');

  expect(errors).toEqual([]);
});
