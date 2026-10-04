// Regression: the toolbar's Align control wraps the selection in a raw
// <div align="..."> block. In CommonMark an HTML block's content is NOT
// parsed as markdown unless blank lines separate it from the tags — so the
// original wrapper (no blank lines) centered plain text fine but silently
// rendered **bold**, lists, headings, tables, images and callouts as raw
// text. Found by checking what Align actually renders, not by anyone
// reporting it; this drives the real toolbar and the real preview.
const { test, expect } = require('@playwright/test');

async function alignSelection(page, md, which) {
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.click('#newNoteBtn');
  await page.waitForFunction(() => document.activeElement?.id === 'noteTitleInput');
  await page.fill('#noteTitleInput', 'Align test');
  await page.fill('#editorTextarea', md);
  await page.evaluate(() => {
    const ta = document.getElementById('editorTextarea');
    ta.focus(); ta.setSelectionRange(0, ta.value.length);
  });
  await page.click('.toolbar-dropdown-btn[data-dropdown="align"]');
  await page.click(`#toolbarDropdownPopover .popover-menu-item:has-text("${which}")`);
  await page.click('.view-btn[data-view="preview"]');
  await page.waitForTimeout(600);
}

test('centered selection keeps its markdown formatting in the preview', async ({ page }) => {
  await alignSelection(page, 'some **bold** and *italic* text', 'Center');
  const r = await page.evaluate(() => {
    const d = document.querySelector('#editorPreview div[align="center"]');
    return { found: !!d, strong: !!d?.querySelector('strong'), em: !!d?.querySelector('em'), raw: /\*\*/.test(d?.textContent || '') };
  });
  expect(r.found, 'aligned wrapper missing from preview').toBe(true);
  expect(r.strong, '**bold** inside an aligned block must render as <strong>').toBe(true);
  expect(r.em, '*italic* inside an aligned block must render as <em>').toBe(true);
  expect(r.raw, 'raw ** leaked into the rendered text').toBe(false);
});

test('aligned lists, headings and tables render as real elements', async ({ page }) => {
  await alignSelection(page, '## Title\n\n- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |', 'Right');
  const r = await page.evaluate(() => {
    const d = document.querySelector('#editorPreview div[align="right"]');
    return { found: !!d, h2: !!d?.querySelector('h2'), li: d?.querySelectorAll('li').length, table: !!d?.querySelector('table') };
  });
  expect(r.found).toBe(true);
  expect(r.h2, 'heading inside an aligned block').toBe(true);
  expect(r.li, 'list items inside an aligned block').toBe(2);
  expect(r.table, 'table inside an aligned block').toBe(true);
});

test('alignment itself still applies', async ({ page }) => {
  await alignSelection(page, 'plain line', 'Center');
  const ta = await page.$eval('#editorPreview div[align="center"]', el => getComputedStyle(el).textAlign);
  expect(ta).toMatch(/center/);
});
