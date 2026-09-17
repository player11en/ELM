// Publish-as-static-site: builds a real vault (three notes across a folder
// and a subfolder, one attachment shared from two different depths, one
// in-scope wikilink and one out-of-scope wikilink), publishes just the
// "Docs" folder, and unzips the real output to verify what the feature is
// actually for — asset dedup and correct wikilink scoping — not just "did a
// zip download happen." Migrated from pw-test/site-export-test.js, which
// saved the zip to disk "for real unzip inspection" but never automated
// that inspection; this does, since that's the feature's actual point.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUT_DIR = path.join(__dirname, '..', '..', 'test-results', 'site-export');

test('publish a folder: asset dedup and wikilink scoping in the real zip', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(900);

  const result = await page.evaluate(async () => {
    const opfsRoot = await navigator.storage.getDirectory();
    vaultHandle = await opfsRoot.getDirectoryHandle('site-export-vault', { create: true });
    vaultAdapter = fsaVaultAdapter;
    storageMode = 'files';
    vaultIndex = new Map();

    // Real 1x1 PNG bytes, shared by two notes in the "Docs" folder
    const pngBytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='), c => c.charCodeAt(0));
    const pngBlob = new Blob([pngBytes], { type: 'image/png' });
    await vaultAdapter.writeBinary('attachments/shared.png', pngBlob);

    async function mk(title, folderId, body) {
      selectedFolderId = folderId;
      const id = await createNote();
      await saveNote(id, { title, body });
      return id;
    }

    const idOutsider = await mk('Outsider', null, 'Not part of the Docs publish.');
    // Docs is depth 1 (one ../ to reach vault root), Docs/Sub is depth 2 (two ../) —
    // same convention attachmentRelativePath() already establishes elsewhere in the app.
    const idPageOne = await mk('Page One', 'Docs', 'Links to [[Page Two]] and [[Outsider]].\n\n![shared](../attachments/shared.png)');
    const idPageTwo = await mk('Page Two', 'Docs/Sub', 'Links back to [[Page One]].\n\n![shared](../../attachments/shared.png)');
    await refreshAll();

    const files = new Map();
    const originalDownload = downloadBlob;
    downloadBlob = (blob, filename) => { files.set(filename, blob); };
    try {
      await publishSiteExport('Docs');
    } finally {
      downloadBlob = originalDownload;
    }

    const zipBlob = files.get('elm-site.zip');
    const buf = await zipBlob.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = btoa(binary);

    return { idOutsider, idPageOne, idPageTwo, downloadedNames: [...files.keys()], zipBase64: b64 };
  });

  expect(result.downloadedNames.length, 'expected exactly one zip download').toBe(1);
  expect(result.downloadedNames[0]).toBe('elm-site.zip');
  expect(result.zipBase64.length, 'zip is empty').toBeGreaterThan(0);

  // --- real unzip, real filesystem inspection — the actual point ------------
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const zipPath = path.join(OUT_DIR, 'elm-site.zip');
  fs.writeFileSync(zipPath, Buffer.from(result.zipBase64, 'base64'));
  execSync(`unzip -o -q "${zipPath}" -d "${OUT_DIR}/extracted"`);

  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]
  );
  const allFiles = walk(path.join(OUT_DIR, 'extracted')).map(f => path.relative(path.join(OUT_DIR, 'extracted'), f).replace(/\\/g, '/'));

  // Asset dedup: shared.png is referenced by two notes at different relative
  // depths — must appear exactly ONCE in the published output, not once per
  // referencing note (the actual bug this feature's asset map exists to fix).
  const pngFiles = allFiles.filter(f => /shared.*\.png$/i.test(f));
  expect(pngFiles.length, `expected exactly one deduped shared.png, got ${JSON.stringify(pngFiles)}`).toBe(1);

  // In-scope wikilink (Page One -> Page Two, both under Docs) must become a
  // real relative href, not stay a dead app-only anchor.
  const pageOneFile = allFiles.find(f => /page-one/i.test(f) && f.endsWith('.html'));
  expect(pageOneFile, `Page One's output file not found in ${JSON.stringify(allFiles)}`).toBeTruthy();
  const pageOneHtml = fs.readFileSync(path.join(OUT_DIR, 'extracted', pageOneFile), 'utf8');
  const pageTwoFile = allFiles.find(f => /page-two/i.test(f) && f.endsWith('.html'));
  expect(pageTwoFile, 'Page Two not published under Docs/Sub').toBeTruthy();
  expect(pageOneHtml, 'in-scope wikilink to Page Two did not become a real href')
    .toMatch(new RegExp(`href="[^"]*${path.basename(pageTwoFile).replace('.', '\\.')}`));

  // Out-of-scope wikilink (Page One -> Outsider, not under Docs) must be
  // unwrapped to plain text, not shipped as a dead link.
  expect(pageOneHtml, 'out-of-scope link text missing entirely').toContain('Outsider');
  expect(pageOneHtml, 'out-of-scope wikilink should be unwrapped, not a dead <a> tag')
    .not.toMatch(/<a[^>]*>Outsider<\/a>/);

  expect(errors, 'errors during publish').toEqual([]);
});
