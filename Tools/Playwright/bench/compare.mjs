#!/usr/bin/env node
// Side-by-side report of two bench runs + pixel diff of their screenshots.
//   node compare.mjs stock lean
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const here = dirname(fileURLToPath(import.meta.url));
const [a = 'stock', b = 'lean'] = process.argv.slice(2);
const load = (l) => JSON.parse(readFileSync(join(here, 'out', `${l}.json`), 'utf8'));
const A = load(a), B = load(b);

const pct = (x, y) => (y === 0 ? 'n/a' : `${(((y - x) / x) * 100).toFixed(0)}%`);
const row = (name, x, y, unit = 'ms') => console.log(`${name.padEnd(28)} ${String(x).padStart(10)} ${String(y).padStart(10)}  ${pct(x, y).padStart(7)}`);

console.log(`\n${''.padEnd(28)} ${a.padStart(10)} ${b.padStart(10)}  ${'delta'.padStart(7)}`);
console.log(`${'webkit version'.padEnd(28)} ${A.webkitVersion.padStart(10)} ${B.webkitVersion.padStart(10)}`);
row('launch -> first page (ms)', A.launch_ms, B.launch_ms);
row('rss after launch (MB)', A.rss_after_launch.totalMb, B.rss_after_launch.totalMb);
row('processes after launch', A.rss_after_launch.procs.length, B.rss_after_launch.procs.length);
for (const p of Object.keys(A.projects)) {
  console.log(`-- ${p}`);
  for (const m of ['nav_ms', 'settle_ms', 'shot_ms', 'total_ms']) row(`  ${m} p50`, A.projects[p][m].p50, B.projects[p][m].p50);
  row(`  total_ms p95`, A.projects[p].total_ms.p95, B.projects[p].total_ms.p95);
  row(`  rss_mb p50`, A.projects[p].rss_mb.p50, B.projects[p].rss_mb.p50);
}
row('4 parallel desktop (ms)', A.parallel4_desktop_ms, B.parallel4_desktop_ms);

console.log('\n-- render parity (pixelmatch, threshold 0.1)');
for (const p of ['desktop', 'tablet', 'mobile']) {
  const fa = join(here, 'out', `${a}-${p}.png`), fb = join(here, 'out', `${b}-${p}.png`);
  if (!existsSync(fa) || !existsSync(fb)) { console.log(`  ${p}: missing screenshot`); continue; }
  const ia = PNG.sync.read(readFileSync(fa)), ib = PNG.sync.read(readFileSync(fb));
  if (ia.width !== ib.width || ia.height !== ib.height) { console.log(`  ${p}: size mismatch ${ia.width}x${ia.height} vs ${ib.width}x${ib.height}`); continue; }
  const diff = new PNG({ width: ia.width, height: ia.height });
  const n = pixelmatch(ia.data, ib.data, diff.data, ia.width, ia.height, { threshold: 0.1 });
  writeFileSync(join(here, 'out', `diff-${p}.png`), PNG.sync.write(diff));
  console.log(`  ${p.padEnd(8)} ${ia.width}x${ia.height}: ${n} differing pixels (${((n / (ia.width * ia.height)) * 100).toFixed(3)}%) -> out/diff-${p}.png`);
}
