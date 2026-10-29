import { webkit } from 'playwright-core';
const exe = process.env.PW_EXE;
const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now()-t0)/1000).toFixed(1)}s] ${m}`);
try {
  const browser = await webkit.launch({ executablePath: exe, headless: true, timeout: 60000 });
  log(`launched version=${browser.version()}`);
  const ctx = await browser.newContext();
  log('context');
  const page = await ctx.newPage();
  log('page');
  await page.goto('data:text/html,<h1 style="font:40px sans-serif">hello</h1>');
  log('navigated');
  const png = await page.screenshot();
  log(`screenshot ${png.length} bytes`);
  await browser.close();
  log('closed');
  process.exit(0);
} catch (e) { log('ERROR ' + e.message.split('\n').slice(0,6).join(' | ')); process.exit(1); }
