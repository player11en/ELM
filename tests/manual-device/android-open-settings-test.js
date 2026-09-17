const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9333');
  const page = browser.contexts().flatMap(c => c.pages())[0];
  await page.evaluate(() => { window.AndroidNative.openAllFilesAccessSettings(); });
  console.log('called');
  await browser.close().catch(() => {});
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
