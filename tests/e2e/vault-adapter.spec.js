// Blast-radius test for the storage-backend (vaultAdapter) refactor.
// Exercises files/vault mode end-to-end so every adapter method
// (ensureDir/writeText/readText/list/statFile/rename/delete) runs for real,
// against the real filesystem-equivalent (OPFS), not the in-memory index.
//
// FSA is substituted with OPFS: navigator.storage.getDirectory() returns a
// handle with the same interface, so the app's adapter code runs unmodified.
// Migrated from pw-test/vault-adapter-test.js — same assertions/flow.
const { test, expect } = require('@playwright/test');

const OPFS_STUB = () => {
  window.showDirectoryPicker = async () => {
    const root = await navigator.storage.getDirectory();
    // OPFS handles lack the permission methods the FSA path calls; the whole
    // point of the desktop port is that these always-granted stubs are what
    // a real browser refuses to guarantee.
    root.queryPermission = async () => 'granted';
    root.requestPermission = async () => 'granted';
    return root;
  };
};

test('vaultAdapter round-trips through the real filesystem (OPFS-backed)', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.addInitScript(OPFS_STUB);
  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(900);

  // Backend wiring — assert it directly.
  const wiring = await page.evaluate(() => ({
    isTauri: IS_TAURI,
    adapterIsFsa: vaultAdapter === fsaVaultAdapter,
    hasVaultBefore: hasVault(),
    methods: Object.keys(fsaVaultAdapter).sort(),
  }));
  expect(wiring.isTauri, 'browser run must not report as Tauri').toBe(false);
  expect(wiring.adapterIsFsa, 'browser must select the FSA backend').toBe(true);
  expect(wiring.hasVaultBefore, 'no vault connected yet').toBe(false);
  for (const m of ['delete','ensureDir','exists','list','readBinary','readText',
                   'remove','removeDirIfEmpty','rename','statFile','writeBinary','writeText']) {
    expect(wiring.methods, `adapter lost method: ${m}`).toContain(m);
  }

  // Connect the vault (runs connectVault -> the feature gate).
  await page.click('#vaultSetupBtn');
  await page.waitForTimeout(1200);
  const afterConnect = await page.evaluate(() => ({
    storageMode, hasVault: hasVault(), status: document.getElementById('vaultStatus').textContent.trim(),
  }));
  expect(afterConnect.storageMode, 'expected files mode after connecting').toBe('files');
  expect(afterConnect.hasVault, 'hasVault() must be true once connected').toBe(true);
  expect(afterConnect.status, 'vault status should show a connected state').toContain('Vault');
  expect(afterConnect.status, 'must not show Reconnect right after connecting').not.toContain('Reconnect');

  // Create + save a note: ensureDir/writeText/statFile/list all run here.
  await page.click('#newNoteBtn');
  await page.waitForFunction(() => document.activeElement?.id === 'noteTitleInput');
  await page.fill('#noteTitleInput', 'Adapter Refactor Note');
  await page.fill('#editorTextarea', '# Adapter Refactor Note\n\nBody written through the renamed adapter.');
  await page.locator('#editorTextarea').blur();
  await page.waitForTimeout(1500);

  // Read it back off the real filesystem, not the in-memory index.
  const onDisk = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const out = [];
    for await (const [name, h] of root.entries()) {
      if (h.kind === 'file' && name.endsWith('.md')) {
        out.push({ name, text: await (await h.getFile()).text() });
      }
    }
    return out;
  });
  expect(onDisk.length, 'exactly one .md file should exist on disk').toBe(1);
  expect(onDisk[0].text, 'note body did not reach disk through the adapter')
    .toContain('Body written through the renamed adapter');

  // Rename: exercises adapter.rename (read + write-new + delete-old).
  await page.fill('#noteTitleInput', 'Renamed Through Adapter');
  await page.locator('#noteTitleInput').blur();
  await page.waitForTimeout(1600);
  const afterRename = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const names = [];
    for await (const [name, h] of root.entries()) if (h.kind === 'file') names.push(name);
    return names;
  });
  expect(afterRename.some(n => /renamed-through-adapter/i.test(n)),
    `rename did not produce the new filename, got ${JSON.stringify(afterRename)}`).toBe(true);
  expect(afterRename.length, 'rename must not leave the old file behind').toBe(1);

  // NOTE: no reload-after-connect step here. Reloading once an OPFS-backed
  // handle has been stored kills the page in this headless Chromium build —
  // verified A/B against a reconstructed pre-refactor copy of index.html,
  // which fails identically, so it is a harness limitation of the OPFS
  // substitution and not app behavior. Real browsers keep a real FSA handle,
  // which is a different code path entirely.

  // Delete: exercises adapter.delete -> .trash move via rename.
  await page.click('.note-item');
  await page.waitForTimeout(600);
  page.once('dialog', d => d.accept());
  await page.click('#deleteNoteBtn');
  await page.waitForTimeout(1500);
  const afterDelete = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    let trashed = [], live = [];
    for await (const [name, h] of root.entries()) {
      if (h.kind === 'file') live.push(name);
      if (h.kind === 'directory' && name === '.trash') {
        for await (const [tn] of h.entries()) trashed.push(tn);
      }
    }
    return { live, trashed };
  });
  expect(afterDelete.live.length, 'deleted note should not remain as a live file').toBe(0);
  expect(afterDelete.trashed.length, 'deleted note should land in .trash').toBe(1);

  expect(errors, 'console/page errors during vault round-trip').toEqual([]);
});
