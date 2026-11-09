#!/usr/bin/env node
// Interactive review loop between the user and the agent.
//
//   node review_server.mjs art.svg [--css motion.css] [--sizes 24,48] [--title "Logo"]
//                          [--port 0] [--out DIR] [--once] [--open]
//   node review_server.mjs --wait art.svg|DIR [--timeout 1800] [--after N]
//
// Serve mode starts a local page (127.0.0.1, random token) with the preview and
// review tools. When the user presses Send or Approve, the round is written to
// DIR/round-NN/ (default DIR: <svg dir>/.svg-review/<name>/):
//   feedback.json   comments with element labels and frame times, markup, summary
//   annotated.svg   the SVG with the user's pins and marks on top
//   annotated.png   its render (needs sharp)
//   frames/t-<ms>.png  the animated frames the user commented on, with pins
//                   (needs playwright-core and Chrome or Edge)
// and one JSON line is printed to stdout. The page reloads itself when the SVG or
// the CSS changes on disk, so the next round starts from the agent's new version.
// --once exits after the first Send.
//
// Wait mode blocks until a round newer than --after (default: the newest existing
// round) appears, prints it as JSON, and exits 0; exit 2 on timeout. Run it after
// every change you want the user to review.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, readdir, rename } from 'node:fs/promises';
import { watch, existsSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { motionPage, inlineSvg } from './lib/preview-page.mjs';
import { reviewPage, collectChecks, checksSummary } from './lib/review-page.mjs';

const args = process.argv.slice(2);
const has = (name) => { const i = args.indexOf(name); if (i === -1) return false; args.splice(i, 1); return true; };
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  const [value] = args.splice(i, 2).slice(1);
  return value;
};
const defaultOut = (svg) => join(dirname(resolve(svg)), '.svg-review', basename(svg, extname(svg)));
async function rounds(dir) {
  try {
    return (await readdir(dir)).map((n) => /^round-(\d+)$/.exec(n)).filter(Boolean).map((m) => Number(m[1])).sort((a, b) => a - b);
  } catch { return []; }
}
const pad = (n) => String(n).padStart(2, '0');

// ------------------------------------------------------------------ wait mode

if (has('--wait')) {
  const target = args[0];
  const timeout = Number(flag('--timeout', 1800)) * 1000;
  if (!target) throw new Error('Usage: node review_server.mjs --wait art.svg|DIR [--timeout 1800] [--after N]');
  const dir = target.toLowerCase().endsWith('.svg') ? defaultOut(target) : resolve(target);
  const existing = await rounds(dir);
  const after = Number(flag('--after', existing.at(-1) ?? 0));
  const started = Date.now();
  process.stderr.write(`waiting for review round > ${after} in ${dir}\n`);
  for (;;) {
    const next = (await rounds(dir)).find((n) => n > after);
    const file = next && join(dir, `round-${pad(next)}`, 'feedback.json');
    if (file && existsSync(file)) {
      const feedback = JSON.parse(await readFile(file, 'utf8'));
      console.log(JSON.stringify(feedback, null, 2));
      process.exit(0);
    }
    if (Date.now() - started > timeout) {
      process.stderr.write('timed out without feedback\n');
      process.exit(2);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

// ------------------------------------------------------------------ serve mode

const cssPath = flag('--css', null);
const sizesArg = flag('--sizes', null);
const title = flag('--title', undefined);
const port = Number(flag('--port', 0));
const once = has('--once');
const open = has('--open');
const svgArg = args[0];
if (!svgArg) throw new Error('Usage: node review_server.mjs art.svg [--css motion.css] [--sizes 24,48] [--port 0] [--out DIR] [--once] [--open]');
const svgPath = resolve(svgArg);
const out = resolve(flag('--out', defaultOut(svgArg)));
const token = randomBytes(16).toString('hex');
const sizes = sizesArg ? sizesArg.split(',').map(Number) : undefined;
await mkdir(out, { recursive: true });

const readInputs = async () => ({
  source: await readFile(svgPath, 'utf8'),
  motionCss: cssPath ? await readFile(cssPath, 'utf8') : '',
});

// Optional renderers, loaded only when a round needs them.
async function optional(name) { try { return (await import(name)).default ?? (await import(name)); } catch { return null; } }

async function renderPng(svgText, file) {
  const sharp = await optional('sharp');
  if (!sharp) return 'sharp is not installed (npm ci --prefix scripts)';
  const meta = await sharp(Buffer.from(svgText)).metadata();
  const width = Math.max(1200, meta.width || 0);
  await sharp(Buffer.from(svgText), { density: Math.min(2400, 72 * (width / (meta.width || width))) })
    .resize({ width }).flatten({ background: '#ffffff' }).png().toFile(file);
  return null;
}

// The frames the user commented on, with that frame's pins and marks drawn in.
async function captureFrames(fb, inputs, dir) {
  if (!fb.times?.length) return { files: [] };
  let chromium;
  try { ({ chromium } = await import('playwright-core')); } catch { return { skipped: 'playwright-core is not installed (npm ci --prefix scripts)' }; }
  const { launchBrowser } = await import('./lib/browser.mjs');
  let browser;
  try { browser = await launchBrowser(chromium); } catch (e) { return { skipped: e.message.split('\n')[0] }; }
  const pageFile = join(dir, 'motion.html');
  await writeFile(pageFile, motionPage({ ...inputs, title: basename(svgPath) }));
  await mkdir(join(dir, 'frames'), { recursive: true });
  const files = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    for (const t of fb.times) {
      await page.goto(`${pathToUrl(pageFile)}?t=${t}`);
      await page.waitForFunction(() => window.__dbsReady === true, null, { timeout: 10000 });
      await page.evaluate(({ markup, pins, t }) => {
        const svg = document.querySelector('#stage svg');
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.innerHTML = markup + pins;
        // Keep marks from this frame and untimed ones; drop marks made on other frames.
        for (const n of g.querySelectorAll('[data-t]')) { const v = n.getAttribute('data-t'); if (v !== '' && v !== String(t)) n.remove(); }
        svg.append(g);
      }, { markup: fb.markup?.svg ?? '', pins: fb.pins ?? '', t });
      const file = join(dir, 'frames', `t-${String(t).padStart(5, '0')}.png`);
      await page.locator('#stage svg').screenshot({ path: file });
      files.push({ t, file });
    }
    await ctx.close();
  } finally {
    await browser.close();
  }
  return { files };
}
const pathToUrl = (p) => `file:///${p.replace(/\\/g, '/').replace(/^\/+/, '')}`;

async function saveRound(fb) {
  const inputs = await readInputs();
  const round = ((await rounds(out)).at(-1) ?? 0) + 1;
  const dir = join(out, `round-${pad(round)}`);
  const tmp = join(out, `.round-${pad(round)}.tmp`);
  await mkdir(tmp, { recursive: true });
  const overlay = `<g id="dbs-review" data-note="review round ${round}">${fb.markup?.svg ?? ''}${fb.pins ?? ''}</g>`;
  const annotated = inlineSvg(inputs.source).replace(/<\/svg>\s*$/i, `${overlay}</svg>`);
  await writeFile(join(tmp, 'annotated.svg'), annotated);
  const pngError = await renderPng(annotated, join(tmp, 'annotated.png')).catch((e) => e.message);
  const frames = await captureFrames(fb, inputs, tmp).catch((e) => ({ skipped: e.message.split('\n')[0] }));
  // Re-run the checks on the file as it is now, so the agent sees what is still open.
  const fresh = collectChecks({ ...inputs, input: svgPath });
  const checks = { issues: fresh.issues, groups: fresh.groups.map(({ name, source, items }) => ({ name, source, items })) };
  const record = {
    ...fb,
    summary: [fb.summary, checksSummary(checks)].filter(Boolean).join('\n'),
    checks,
    round,
    svg: svgPath,
    css: cssPath ? resolve(cssPath) : null,
    sha256: createHash('sha256').update(inputs.source).digest('hex'),
    receivedAt: new Date().toISOString(),
    files: {
      annotatedSvg: join(dir, 'annotated.svg'),
      annotatedPng: pngError ? null : join(dir, 'annotated.png'),
      frames: frames.files?.map((f) => ({ t: f.t, file: f.file.replace(tmp, dir) })) ?? [],
    },
    notes: [pngError && `annotated.png skipped: ${pngError}`, frames.skipped && `frames skipped: ${frames.skipped}`].filter(Boolean),
  };
  await writeFile(join(tmp, 'feedback.json'), JSON.stringify(record, null, 2));
  await rename(tmp, dir); // the round appears complete or not at all
  return record;
}

// Live reload: tell open pages when the SVG or CSS changes.
const clients = new Set();
let debounce;
for (const file of [svgPath, cssPath && resolve(cssPath)].filter(Boolean)) {
  watch(dirname(file), (_, name) => {
    if (name && basename(file) !== name) return;
    clearTimeout(debounce);
    debounce = setTimeout(() => { for (const res of clients) res.write('event: changed\ndata: {}\n\n'); }, 200);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const authorized = url.searchParams.get('k') === token || req.headers['x-dbs-token'] === token;
  if (!authorized) { res.writeHead(403).end('forbidden'); return; }
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      const inputs = await readInputs();
      const next = ((await rounds(out)).at(-1) ?? 0) + 1;
      const { html } = reviewPage({
        ...inputs, input: svgPath, sizes, title,
        review: { endpoint: `/feedback?k=${token}`, token, events: `/events?k=${token}`, round: next, file: basename(svgPath) },
      });
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(html);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write(': connected\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/feedback') {
      if (!String(req.headers['content-type']).startsWith('application/json')) { res.writeHead(415).end('json only'); return; }
      let size = 0;
      const chunks = [];
      for await (const c of req) {
        size += c.length;
        if (size > 5 * 1024 * 1024) { res.writeHead(413).end('too large'); return; }
        chunks.push(c);
      }
      const fb = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (fb.schema !== 'draw-better-svg/review@1' || !['changes', 'approved'].includes(fb.status)) { res.writeHead(400).end('bad payload'); return; }
      const record = await saveRound(fb);
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ round: record.round }));
      console.log(JSON.stringify({ event: 'feedback', round: record.round, status: record.status, dir: dirname(record.files.annotatedSvg), summary: record.summary }));
      if (once) setTimeout(() => process.exit(0), 100);
      return;
    }
    res.writeHead(404).end('not found');
  } catch (e) {
    res.writeHead(500).end(String(e.message));
  }
});

server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/?k=${token}`;
  console.log(JSON.stringify({
    event: 'ready', url, svg: svgPath, out,
    wait: `node "${resolve(process.argv[1])}" --wait "${out}"`,
  }));
  if (open) {
    const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref();
  }
});
