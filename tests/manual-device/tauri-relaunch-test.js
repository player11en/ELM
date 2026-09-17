// THE test this entire plan exists for: after a full quit and fresh
// relaunch of the real elm.exe, is the vault reconnected automatically,
// with zero permission prompt and zero "Reconnect vault" button? This is
// the actual bug being fixed — a real user closing and reopening the app.
const { chromium } = require('playwright');
const assert = require('assert');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9333');
  const page = browser.contexts().flatMap(c => c.pages())[0];
  await page.waitForTimeout(1500); // let initVault() finish its own async work

  const state = await page.evaluate(() => ({
    storageMode,
    vaultPath,
    vaultLocked,
    hasVault: hasVault(),
    statusText: document.getElementById('vaultStatus').textContent.trim(),
    statusHTML: document.getElementById('vaultStatus').innerHTML,
    titles: [...document.querySelectorAll('.ni-title')].map(e => e.textContent),
  }));
  console.log('STATE ON FRESH RELAUNCH (no clicks, no interaction):', JSON.stringify(state, null, 2));

  assert.strictEqual(state.storageMode, 'files', 'expected files mode restored automatically');
  assert.strictEqual(state.vaultLocked, false, 'vault must NOT be locked — that would mean a prompt is needed');
  assert(state.hasVault, 'expected hasVault() true after relaunch, no interaction');
  assert(!state.statusHTML.includes('Reconnect'), 'THE BUG THIS PLAN FIXES: a Reconnect button means the prompt-on-restart problem is NOT solved');
  assert(state.statusText.includes('Vault'), 'expected the connected-vault status');
  assert(state.titles.some(t => t.includes('Real Desktop Note')), 'the note created last run should just be there, no reconnect needed');

  console.log('=== ZERO-PROMPT RELAUNCH VERIFIED — THE FIX WORKS ===');
  await browser.close().catch(() => {});
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
