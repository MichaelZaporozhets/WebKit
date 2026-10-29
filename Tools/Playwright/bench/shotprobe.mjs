import { webkit, devices } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { renderPage } from './fixtures/page.mjs';
const css = readFileSync('node_modules/@shopify/polaris/build/esm/styles.css'); const html = Buffer.from(renderPage({ rows: 60 }));
const srv = createServer((q, r) => { if (q.url === '/polaris.css') { r.writeHead(200, {'content-type':'text/css'}); return r.end(css);} r.writeHead(200, {'content-type':'text/html'}); r.end(html); });
await new Promise(r => srv.listen(0, '127.0.0.1', r)); const url = `http://127.0.0.1:${srv.address().port}/`;
const b = await webkit.launch({ executablePath: process.env.PW_EXE || undefined, headless: true });
const ctx = await b.newContext({ ...devices['Desktop Safari'], viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await ctx.newPage(); await page.goto(url); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
async function probe(label, opts) { const t = []; for (let i = 0; i < 8; i++) { const t0 = performance.now(); await page.screenshot(opts); t.push(performance.now() - t0); } t.sort((a,b)=>a-b); console.log(`${process.env.LABEL} ${label.padEnd(26)} p50 ${t[4].toFixed(1)}  min ${t[0].toFixed(1)}`); }
await probe('png 1920x1080', { type: 'png' });
await probe('jpeg q80 1920x1080', { type: 'jpeg', quality: 80 });
await probe('png clip 400x300', { type: 'png', clip: { x: 0, y: 0, width: 400, height: 300 } });
await probe('png clip 1920x100', { type: 'png', clip: { x: 0, y: 0, width: 1920, height: 100 } });
await b.close(); srv.close();
