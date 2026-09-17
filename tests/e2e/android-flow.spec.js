// The Android vault flow can't be run for real without a device, but the
// parts that CAN be checked now: that the Android branch is correctly
// inert on desktop/browser, and that the path-prompt modal itself behaves
// (prefill, confirm, cancel, Enter/Escape, no listener leaks) when driven
// directly. Migrated from pw-test/android-flow-test.js — same assertions.
const { test, expect } = require('@playwright/test');

test('Android path is inert on desktop, and the path-prompt modal behaves correctly', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(900);

  // 1. In a normal browser, the Android path must be completely inert.
  const flags = await page.evaluate(() => ({
    isTauri: IS_TAURI,
    isAndroid: IS_ANDROID,
    defaultPath: ANDROID_DEFAULT_VAULT,
    modalHidden: getComputedStyle(document.getElementById('vaultPathBackdrop')).display === 'none',
  }));
  expect(flags.isAndroid, 'IS_ANDROID must be false in a desktop browser').toBe(false);
  expect(flags.modalHidden, 'the Android path modal must not be showing by default').toBe(true);

  // 2. Drive the prompt directly: prefill + confirm returns the typed path.
  const confirmed = await page.evaluate(async () => {
    const p = promptForVaultPath();
    await new Promise(r => setTimeout(r, 100));
    const prefilled = document.getElementById('vaultPathInput').value;
    document.getElementById('vaultPathInput').value = '/storage/emulated/0/Documents/MyVault';
    document.getElementById('vaultPathConfirm').click();
    return { prefilled, result: await p };
  });
  expect(confirmed.prefilled, 'should prefill the shared-storage default').toBe('/storage/emulated/0/Documents/ELM_Data');
  expect(confirmed.result, 'confirm should resolve the typed path').toBe('/storage/emulated/0/Documents/MyVault');
  expect(await page.$eval('#vaultPathBackdrop', el => getComputedStyle(el).display === 'none'),
    'modal should close on confirm').toBe(true);

  // 3. Cancel resolves null (so connectVault quietly does nothing).
  const cancelled = await page.evaluate(async () => {
    const p = promptForVaultPath();
    await new Promise(r => setTimeout(r, 100));
    document.getElementById('vaultPathCancel').click();
    return await p;
  });
  expect(cancelled, 'cancel must resolve null, not an empty string').toBeNull();

  // 4. Escape cancels, Enter confirms.
  const viaKeys = await page.evaluate(async () => {
    const esc = promptForVaultPath();
    await new Promise(r => setTimeout(r, 80));
    document.getElementById('vaultPathInput').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const escResult = await esc;

    const ent = promptForVaultPath();
    await new Promise(r => setTimeout(r, 80));
    document.getElementById('vaultPathInput').value = '/some/typed/path';
    document.getElementById('vaultPathInput').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return { escResult, entResult: await ent };
  });
  expect(viaKeys.escResult, 'Escape should cancel').toBeNull();
  expect(viaKeys.entResult, 'Enter should confirm').toBe('/some/typed/path');

  // 5. Listeners must not accumulate across repeated opens.
  const noLeak = await page.evaluate(async () => {
    for (let i = 0; i < 5; i++) {
      const p = promptForVaultPath();
      await new Promise(r => setTimeout(r, 30));
      document.getElementById('vaultPathCancel').click();
      await p;
    }
    // If handlers leaked, one click would resolve several stale promises and
    // the next confirm would return a stale value.
    const p = promptForVaultPath();
    await new Promise(r => setTimeout(r, 30));
    document.getElementById('vaultPathInput').value = '/final/path';
    document.getElementById('vaultPathConfirm').click();
    return await p;
  });
  expect(noLeak, 'stale listeners from earlier opens are interfering').toBe('/final/path');

  expect(errors).toEqual([]);
});
