#!/usr/bin/env node
// Magpie-shaped WebKit benchmark.
//
//   node bench.mjs --label stock                      # Playwright's bundled webkit-<rev>
//   node bench.mjs --label lean --executable ../../../WebKitBuild/cmake-mac/Release/pw_run.sh
//   node bench.mjs --label lean --executable ... --iterations 20 --rows 60
//
// What it measures (per label, written to out/<label>.json and printed as a table):
//   launch_ms        webkit.launch() -> first page ready (cold process tree start)
//   nav_ms           page.goto(fixture) incl. network idle
//   settle_ms        document.fonts.ready + 2 rAF (what Magpie waits for before capturing)
//   shot_ms          page.screenshot() (viewport PNG)
//   total_ms         context+page create -> screenshot bytes in hand
//   rss_mb           sum of RSS over the browser's process tree (UI + Networking + GPU + WebContent)
// for each of Magpie's three WebKit projects: desktop (1920x1080, DPR 1), tablet (iPad gen 7,
// 768x1024, DPR 1, touch) and mobile (iPhone 14, 390x844, device DPR, touch), mirroring
// playwright.config.ts in //libraries/javascript/magpie.
//
// The desktop screenshot of the first iteration is saved as out/<label>-desktop.png so
// compare.mjs can pixel-diff two labels for render parity.

import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webkit, devices } from 'playwright-core';
import { renderPage } from './fixtures/page.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]]);
    return acc;
  }, []),
);
const label = args.label ?? 'stock';
const executablePath = args.executable ? join(process.cwd(), args.executable).replace(/^\/+/, '/') : undefined;
const iterations = Number(args.iterations ?? 10);
const rows = Number(args.rows ?? 60);
const outDir = join(here, 'out');
mkdirSync(outDir, { recursive: true });

const POLARIS_CSS = readFileSync(join(here, 'node_modules/@shopify/polaris/build/esm/styles.css'));
const PAGE_HTML = Buffer.from(renderPage({ rows }));

// Same viewport matrix as Magpie's webkit-desktop / webkit-tablet / webkit-mobile projects.
const PROJECTS = {
  desktop: { ...devices['Desktop Safari'], viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  tablet: { ...devices['iPad (gen 7)'], viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1 },
  mobile: { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } },
};

const server = createServer((req, res) => {
  if (req.url === '/polaris.css') {
    res.writeHead(200, { 'content-type': 'text/css', 'cache-control': 'no-store' });
    return res.end(POLARIS_CSS);
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(PAGE_HTML);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

function processTreeRss(rootPid, installDirHint) {
  // XPC services are launchd children, not ours, so match on executable path instead of ppid.
  const ps = execFileSync('ps', ['-axo', 'pid=,ppid=,rss=,command='], { encoding: 'utf8' });
  let total = 0;
  const procs = [];
  for (const line of ps.split('\n')) {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/);
    if (!m) continue;
    const [, pid, ppid, rss, cmd] = m;
    if (Number(pid) === rootPid || Number(ppid) === rootPid || (installDirHint && cmd.includes(installDirHint))) {
      total += Number(rss);
      procs.push({ pid: Number(pid), rssMb: +(Number(rss) / 1024).toFixed(1), cmd: cmd.split(' ')[0].split('/').slice(-1)[0] });
    }
  }
  return { totalMb: +(total / 1024).toFixed(1), procs };
}

const now = () => performance.now();
const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: s.length, mean: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(1), p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), min: +s[0].toFixed(1) };
};

console.error(`[bench] label=${label} executable=${executablePath ?? '(playwright default)'} iterations=${iterations} rows=${rows}`);

const tLaunch0 = now();
const browser = await webkit.launch({ executablePath, headless: true });
const warmCtx = await browser.newContext(PROJECTS.desktop);
const warmPage = await warmCtx.newPage();
await warmPage.goto('about:blank');
const launchMs = now() - tLaunch0;
const browserProcess = browser.process?.();
const rootPid = browserProcess?.pid;
const installDirHint = executablePath ? dirname(executablePath) : 'ms-playwright/webkit-';
const rssAfterLaunch = processTreeRss(rootPid, installDirHint);
await warmPage.close();
await warmCtx.close();

const results = { label, executablePath: executablePath ?? null, webkitVersion: browser.version(), iterations, rows, launch_ms: +launchMs.toFixed(1), rss_after_launch: rssAfterLaunch, projects: {} };

for (const [name, device] of Object.entries(PROJECTS)) {
  const nav = [], settle = [], shot = [], total = [], rssPeak = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = now();
    const context = await browser.newContext(device);
    const page = await context.newPage();
    const t1 = now();
    await page.goto(url, { waitUntil: 'networkidle' });
    const t2 = now();
    await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
    const t3 = now();
    const png = await page.screenshot({ type: 'png' });
    const t4 = now();
    if (i === 0) writeFileSync(join(outDir, `${label}-${name}.png`), png);
    rssPeak.push(processTreeRss(rootPid, installDirHint).totalMb);
    await context.close();
    nav.push(t2 - t1); settle.push(t3 - t2); shot.push(t4 - t3); total.push(t4 - t0);
  }
  results.projects[name] = { nav_ms: stats(nav), settle_ms: stats(settle), shot_ms: stats(shot), total_ms: stats(total), rss_mb: stats(rssPeak) };
  console.error(`[bench] ${name.padEnd(8)} total p50 ${results.projects[name].total_ms.p50}ms  nav ${results.projects[name].nav_ms.p50}  settle ${results.projects[name].settle_ms.p50}  shot ${results.projects[name].shot_ms.p50}  rss p50 ${results.projects[name].rss_mb.p50}MB`);
}

// Concurrency: Magpie runs WEBKIT_STATIC_WORKERS=4 browsers; approximate with 4 contexts in flight.
{
  const t0 = now();
  await Promise.all(Array.from({ length: 4 }, async () => {
    const context = await browser.newContext(PROJECTS.desktop);
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.screenshot({ type: 'png' });
    await context.close();
  }));
  results.parallel4_desktop_ms = +(now() - t0).toFixed(1);
  console.error(`[bench] 4 parallel desktop captures: ${results.parallel4_desktop_ms}ms`);
}

await browser.close();
server.close();

writeFileSync(join(outDir, `${label}.json`), JSON.stringify(results, null, 2));
console.log(JSON.stringify({ label, webkit: results.webkitVersion, launch_ms: results.launch_ms, rss_after_launch_mb: rssAfterLaunch.totalMb, procs: rssAfterLaunch.procs.length, ...Object.fromEntries(Object.entries(results.projects).map(([k, v]) => [k, { total_p50: v.total_ms.p50, shot_p50: v.shot_ms.p50, rss_p50: v.rss_mb.p50 }])), parallel4_ms: results.parallel4_desktop_ms }, null, 2));
