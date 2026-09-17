// Drives the REAL running elm.exe through the real vault-connect flow,
// against a real folder on disk. The only thing stubbed is the native OS
// file-picker itself (window.__TAURI__.dialog.open) — CDP can't see or
// click a native Windows dialog, it's not part of the webview DOM. Every
// other function (connectVault, grant_vault_scope, tauriVaultAdapter,
// dbSettingPut/Get) is the real, unmodified app code.
const { chromium } = require('playwright');
const assert = require('assert');
const fs = require('fs');

const VAULT_PATH = 'C:\\Users\\fairy\\Documents\\Zina\\WebdevStuff\\tauri-test-vault';

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9333');
  const page = browser.contexts().flatMap(c => c.pages())[0];

  // Stub only the native picker to return our real test folder path.
  await page.evaluate((vaultPath) => {
    window.__TAURI__.dialog.open = async () => vaultPath;
  }, VAULT_PATH);

  await page.click('#vaultSetupBtn');
  await page.waitForTimeout(2000);

  const afterConnect = await page.evaluate(() => ({
    storageMode, vaultPath, hasVault: hasVault(),
    status: document.getElementById('vaultStatus').textContent.trim(),
  }));
  console.log('after connect:', JSON.stringify(afterConnect));
  assert.strictEqual(afterConnect.storageMode, 'files');
  assert.strictEqual(afterConnect.vaultPath, VAULT_PATH);
  assert(afterConnect.status.includes('Vault') && !afterConnect.status.includes('Reconnect'));

  // Create a real note through the real UI.
  await page.click('#newNoteBtn');
  await page.waitForFunction(() => document.activeElement?.id === 'noteTitleInput');
  await page.fill('#noteTitleInput', 'Real Desktop Note');
  await page.fill('#editorTextarea', '# Real Desktop Note\n\nWritten by the actual Tauri build to actual disk.');
  await page.locator('#editorTextarea').blur();
  await page.waitForTimeout(1800);

  // Check the REAL filesystem — not the app's in-memory index — via Node's
  // own fs, completely independent of anything the app itself reports.
  const files = fs.readdirSync(VAULT_PATH).filter(f => f.endsWith('.md'));
  console.log('real files on real disk:', JSON.stringify(files));
  assert.strictEqual(files.length, 1, 'expected exactly one .md file written to the real vault folder');
  const content = fs.readFileSync(`${VAULT_PATH}\\${files[0]}`, 'utf8');
  assert(content.includes('Written by the actual Tauri build to actual disk.'), 'note content did not reach the real file');
  console.log('=== REAL VAULT WRITE VERIFIED (independent fs check) ===');

  await browser.close().catch(() => {});
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
