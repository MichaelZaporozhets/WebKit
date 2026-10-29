// Launch-time microbench: N cold launches of webkit.launch()+newContext()+newPage()+goto(about:blank).
import { webkit } from 'playwright-core';
const exe = process.env.PW_EXE || undefined; const n = Number(process.argv[2] || 8);
const times = [];
for (let i = 0; i < n; i++) {
  const t0 = performance.now();
  const b = await webkit.launch({ executablePath: exe, headless: true });
  const c = await b.newContext(); const p = await c.newPage(); await p.goto('about:blank');
  times.push(performance.now() - t0); await b.close();
}
times.sort((a, b) => a - b);
console.log(JSON.stringify({ label: process.env.LABEL || 'launch', n, p50: +times[Math.floor(n / 2)].toFixed(0), min: +times[0].toFixed(0), max: +times[n - 1].toFixed(0) }));
