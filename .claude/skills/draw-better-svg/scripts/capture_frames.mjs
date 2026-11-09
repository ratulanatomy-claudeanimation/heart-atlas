#!/usr/bin/env node
// Deterministic motion evidence from a page built by `preview_html.mjs --mode motion`.
//
//   node capture_frames.mjs motion.html ./review/motion [--times auto|0,300,900] [--scale 2]
//                           [--probe "#mark:stroke-dashoffset,#dot:transform"]
//
// For each time it loads motion.html?t=<ms> (every animation paused and seeked,
// no wall-clock racing) and screenshots the SVG. It then checks:
//   final frame   ?t=<end> equals ?bare=1 (the SVG without the motion CSS):
//                 no visible pixel differs (anti-aliasing tolerated, see diff())
//   reduced motion  the page under prefers-reduced-motion equals ?bare=1
//   probes        computed style values at each time, to compare with the
//                 designed easing (a keyframe easing written as var() runs linearly)
// and writes frames, strip.png, and capture.json. Needs playwright-core and an
// installed Chrome or Edge (or CHROME_BIN).
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { launchBrowser } from './lib/browser.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  const [value] = args.splice(i, 2).slice(1);
  return value;
};
const timesArg = flag('--times', 'auto');
const scale = Number(flag('--scale', 2));
const probeArg = flag('--probe', '');
const [html, outDir] = args;
if (!html || !outDir || !(scale > 0 && scale <= 4)) {
  throw new Error('Usage: node capture_frames.mjs motion.html out-dir [--times auto|0,300,900] [--scale 2] [--probe "#id:property,..."]');
}
const probes = probeArg ? probeArg.split(',').map((p) => {
  const at = p.lastIndexOf(':');
  return { selector: p.slice(0, at), property: p.slice(at + 1) };
}) : [];
const base = pathToFileURL(resolve(html)).href;
await mkdir(outDir, { recursive: true });

const browser = await launchBrowser();
async function shot(query, { reducedMotion = 'no-preference' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, deviceScaleFactor: scale, reducedMotion });
  const page = await ctx.newPage();
  await page.goto(base + query);
  await page.waitForFunction(() => window.__dbsReady === true, null, { timeout: 10000 });
  const duration = await page.evaluate(() => window.__dbsDuration);
  const values = await page.evaluate((list) => list.map(({ selector, property }) => {
    const el = document.querySelector(selector);
    return el ? getComputedStyle(el).getPropertyValue(property) : null;
  }), probes);
  const png = await page.locator('#stage svg').screenshot();
  await ctx.close();
  return { png, duration, values };
}

const bare = await shot('?bare=1');
const first = await shot('?static=1');
const duration = first.duration;
const times = timesArg === 'auto'
  ? [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].map((f) => Math.round(f * duration))
  : timesArg.split(',').map(Number);
if (times.some((t) => !Number.isFinite(t) || t < 0)) throw new Error('--times must be non-negative milliseconds');
if (!duration && timesArg === 'auto') console.warn('warning: no finite animation found; frames will all show the same state.');

const frames = [];
for (const t of times) {
  const f = await shot(`?t=${t}`);
  const file = join(outDir, `frame-${String(t).padStart(5, '0')}.png`);
  await writeFile(file, f.png);
  frames.push({ t, file, probes: Object.fromEntries(probes.map((p, i) => [`${p.selector} ${p.property}`, f.values[i]])) });
}
await writeFile(join(outDir, 'bare.png'), bare.png);
await writeFile(join(outDir, 'static.png'), first.png);
const reduced = await shot('', { reducedMotion: 'reduce' });
await writeFile(join(outDir, 'reduced-motion.png'), reduced.png);
await browser.close();

// changedPixels counts any difference. visiblePixels ignores rasterization: both
// images are blurred by 0.75 CSS px, then a pixel counts only when nothing within
// one pixel in the other image is within 24 levels of it (checked both ways).
// Chromium rasterizes transform-animated groups on their own layers, softer and
// up to a pixel off, so a first frame can differ from the static file along every
// edge without anything having moved. Measured on a bicycle scene: frame 0 vs the
// static file 2958 → 0 visible pixels, while a 40 ms pose change still showed 25585.
const TOLERANCE = { blurCssPx: 0.75, radiusPx: 1, levels: 24 };
async function diff(a, b) {
  const blur = TOLERANCE.blurCssPx * scale;
  const [raw1, raw2] = await Promise.all([a, b].map((p) => sharp(p).removeAlpha().raw().toBuffer()));
  let changed = 0;
  for (let i = 0; i < raw1.length; i++) if (raw1[i] !== raw2[i]) { changed++; i += 2 - (i % 3); }
  const [x, y] = await Promise.all([a, b].map((p) => sharp(p).removeAlpha().blur(blur).raw().toBuffer({ resolveWithObject: true })));
  if (x.info.width !== y.info.width || x.info.height !== y.info.height) return { comparable: false };
  const { width: w, height: h } = x.info;
  const near = (p, q, i) => Math.max(Math.abs(p[i] - q[i]), Math.abs(p[i + 1] - q[i + 1]), Math.abs(p[i + 2] - q[i + 2]));
  const matchesAround = (p, q, px, py, i) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = (ny * w + nx) * 3;
        if (Math.max(Math.abs(p[i] - q[j]), Math.abs(p[i + 1] - q[j + 1]), Math.abs(p[i + 2] - q[j + 2])) <= 24) return true;
      }
    }
    return false;
  };
  let visible = 0;
  for (let py = 0, i = 0; py < h; py++) {
    for (let px = 0; px < w; px++, i += 3) {
      if (near(x.data, y.data, i) > TOLERANCE.levels && (!matchesAround(x.data, y.data, px, py, i) || !matchesAround(y.data, x.data, px, py, i))) visible++;
    }
  }
  return { comparable: true, changedPixels: changed, visiblePixels: visible };
}
const endFrame = frames.find((f) => f.t >= duration) ?? frames.at(-1);
const { readFile } = await import('node:fs/promises');
const finalCheck = await diff(await readFile(endFrame.file), bare.png);
const finishedCheck = await diff(first.png, bare.png);
const reducedCheck = await diff(reduced.png, bare.png);

// Film strip with time labels.
const thumbs = await Promise.all(frames.map((f) => sharp(f.file).resize({ height: 220 }).png().toBuffer({ resolveWithObject: true })));
const pad = 8, labelH = 26;
const width = thumbs.reduce((s, t) => s + t.info.width + pad, pad);
const composites = [];
let x = pad;
for (const [i, t] of thumbs.entries()) {
  composites.push({ input: t.data, left: x, top: pad });
  composites.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${t.info.width}" height="${labelH}"><text x="4" y="18" font-family="Arial" font-size="14" fill="#1f2a30">${frames[i].t} ms</text></svg>`), left: x, top: pad + 220 });
  x += t.info.width + pad;
}
await sharp({ create: { width, height: 220 + labelH + pad * 2, channels: 3, background: '#ffffff' } }).composite(composites).png().toFile(join(outDir, 'strip.png'));

const report = {
  html, durationMs: duration, scale, frames,
  tolerance: TOLERANCE,
  finalFrame: { frame: endFrame.t, vsBare: finalCheck, finishedVsBare: finishedCheck,
    pass: finalCheck.comparable && finalCheck.visiblePixels === 0 && finishedCheck.visiblePixels === 0 },
  reducedMotion: { vsBare: reducedCheck, pass: reducedCheck.comparable && reducedCheck.visiblePixels === 0 },
  strip: join(outDir, 'strip.png'),
  limits: 'Chromium only; inspect the strip for staging, overlap, clipping, and personality. Probe values against the designed curve.',
};
await writeFile(join(outDir, 'capture.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.finalFrame.pass && report.reducedMotion.pass ? 0 : 1;
