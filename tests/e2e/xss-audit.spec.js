// Security regression test: hostile markdown must not execute, in either
// the live preview or the exported standalone HTML file. Migrated from
// pw-test/xss-audit.js — same payload/flow, but the script-tag/event-
// handler-survival checks (previously just logged) are now real assertions,
// not information for a human to eyeball after the fact.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', '..', 'test-results', 'xss-audit');

test('hostile markdown does not execute in live preview or exported HTML', async ({ page, browser }) => {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const dialogs = [];
  page.on('dialog', async d => { dialogs.push(d.message()); await d.dismiss(); });
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(800);

  // 1) LIVE PREVIEW — render hostile markdown through the real note pipeline
  const live = await page.evaluate(async () => {
    const payload = [
      '<script>window.__PWNED__="script"<\/script>',
      '<img src=x onerror="window.__PWNED__=\'img\'">',
      '<span style="background:url(javascript:window.__PWNED__=\'css\')">styled</span>',
      '<svg onload="window.__PWNED__=\'svg\'"></svg>',
      '[md link](javascript:window.__PWNED__="mdlink")',
      '<details open ontoggle="window.__PWNED__=\'toggle\'"></details>',
    ].join('\n\n');
    selectedFolderId = null;
    const id = await createNote();
    await saveNote(id, { title: 'Attack Note', body: payload });
    await refreshAll();
    await openNote(id);
    setEditorView('preview');
    await renderPreview();
    await new Promise(r => setTimeout(r, 600));
    return {
      pwned: window.__PWNED__ ?? null,
      previewHTML: document.getElementById('editorPreview').innerHTML,
      noteId: id,
    };
  });

  expect(live.pwned, 'payload executed in the live preview').toBeNull();
  expect(live.previewHTML, 'live preview retains a <script> tag').not.toMatch(/<script/i);
  expect(live.previewHTML, 'live preview retains an on* event-handler attribute').not.toMatch(/\son(error|load|toggle)=/i);

  // 2) EXPORTED STANDALONE FILE — the shareable artifact, opened from disk
  const html = await page.evaluate(async (id) => {
    const note = await getNoteById(id);
    const { map } = await buildBase64AssetMap(note.body, note);
    return await buildReaderHTML(note, map);
  }, live.noteId);

  const outPath = path.join(OUT_DIR, 'attack-export.html');
  fs.writeFileSync(outPath, html);

  const p2 = await browser.newPage();
  const exportDialogs = [];
  p2.on('dialog', async d => { exportDialogs.push(d.message()); await d.dismiss(); });
  await p2.goto('file:///' + outPath.replace(/\\/g, '/'));
  await p2.waitForTimeout(900);
  const exportPwned = await p2.evaluate(() => window.__PWNED__ ?? null);
  await p2.close();

  expect(exportPwned, 'payload executed in the exported standalone file').toBeNull();
  // Real check, not just "does the whole file contain the substring
  // <script> anywhere" (the export's own CSS/boilerplate is legitimately
  // allowed to have script-like text) — scope it to content after </style>,
  // same boundary the original audit used, matching where user content
  // actually renders.
  const bodyPart = html.split('</style>')[1] || '';
  expect(bodyPart, 'exported file retains a <script> tag in rendered content').not.toMatch(/<script/i);
  expect(html, 'exported file retains an on* event-handler attribute').not.toMatch(/\son(error|load|toggle)=/i);

  expect(dialogs, 'a dialog fired during live preview — payload triggered a prompt').toEqual([]);
  expect(exportDialogs, 'a dialog fired opening the exported file — payload triggered a prompt').toEqual([]);
});
