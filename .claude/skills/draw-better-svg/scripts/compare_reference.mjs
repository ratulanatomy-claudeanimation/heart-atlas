#!/usr/bin/env node
// Compare an SVG against a raster reference (trace, reconstruction, logo fit).
// Renders the SVG at the reference's pixel size, builds a silhouette mask for
// each, and reports IoU, missed and extra pixels, centroid offset, and size ratio.
// Writes <prefix>-overlay.png: grey = both, red = only in the reference (the
// vector is missing it), cyan = only in the render (the vector adds it).
//
//   node compare_reference.mjs art.svg reference.png ./review/fit-03 [--mode auto|alpha|luma] [--tolerance 48]
//
// There is no pass threshold. A smooth contour with a slightly lower IoU usually
// beats a jagged trace with a higher one; use the numbers as a trend between
// iterations and inspect the overlay. Static render via sharp/librsvg.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  const [value] = args.splice(i, 2).slice(1);
  return value;
};
const mode = flag('--mode', 'auto');
const tolerance = Number(flag('--tolerance', 48));
const [svgPath, refPath, prefix] = args;
if (!svgPath || !refPath || !prefix || !['auto', 'alpha', 'luma'].includes(mode) || !(tolerance > 0)) {
  throw new Error('Usage: node compare_reference.mjs art.svg reference.png output-prefix [--mode auto|alpha|luma] [--tolerance 48]');
}

const ref = sharp(await readFile(refPath)).ensureAlpha();
const { width: W, height: H } = await ref.metadata();
if (W * H > 16e6) throw new Error('Reference exceeds 16 megapixels; downscale it first.');
const refRaw = await ref.raw().toBuffer();

const svg = await readFile(svgPath);
const meta = await sharp(svg).metadata();
const aspect = { svg: meta.width / meta.height, reference: W / H };
const density = Math.max(1, 72 * Math.max(W / meta.width, H / meta.height));
const rendered = await sharp(svg, { density, limitInputPixels: 64e6 })
  .resize(W, H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .ensureAlpha().png().toBuffer();
const renRaw = await sharp(rendered).raw().toBuffer();

// Reference mask: alpha when the reference is transparent somewhere, else the
// distance from the background color sampled at the four corners.
let transparent = 0;
for (let i = 3; i < refRaw.length; i += 4) if (refRaw[i] < 250) transparent++;
const useAlpha = mode === 'alpha' || (mode === 'auto' && transparent > W * H * 0.01);
const corner = (x, y) => refRaw.subarray((y * W + x) * 4, (y * W + x) * 4 + 3);
const bg = [0, 1, 2].map((c) => [corner(0, 0), corner(W - 1, 0), corner(0, H - 1), corner(W - 1, H - 1)]
  .map((p) => p[c]).sort((a, b) => a - b)[1]);

const N = W * H;
const inRef = new Uint8Array(N), inRen = new Uint8Array(N);
for (let p = 0; p < N; p++) {
  const i = p * 4;
  inRef[p] = useAlpha
    ? refRaw[i + 3] > 127
    : Math.max(Math.abs(refRaw[i] - bg[0]), Math.abs(refRaw[i + 1] - bg[1]), Math.abs(refRaw[i + 2] - bg[2])) > tolerance;
  inRen[p] = renRaw[i + 3] > 127;
}

function stats(mask) {
  let n = 0, sx = 0, sy = 0, x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let p = 0; p < N; p++) {
    if (!mask[p]) continue;
    const x = p % W, y = (p / W) | 0;
    n++; sx += x; sy += y;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return n ? { pixels: n, centroid: [sx / n, sy / n], bbox: [x0, y0, x1 - x0 + 1, y1 - y0 + 1] } : { pixels: 0 };
}

let both = 0, refOnly = 0, renOnly = 0;
const over = Buffer.alloc(N * 3);
for (let p = 0; p < N; p++) {
  const i = p * 3;
  const lum = Math.round(0.2126 * refRaw[p * 4] + 0.7152 * refRaw[p * 4 + 1] + 0.0722 * refRaw[p * 4 + 2]);
  const faded = 200 + Math.round((lum / 255) * 55);
  let c = [faded, faded, faded];
  if (inRef[p] && inRen[p]) { both++; c = [110, 110, 110]; }
  else if (inRef[p]) { refOnly++; c = [220, 38, 38]; }
  else if (inRen[p]) { renOnly++; c = [8, 145, 178]; }
  over[i] = c[0]; over[i + 1] = c[1]; over[i + 2] = c[2];
}

const r = stats(inRef), s = stats(inRen);
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const report = {
  svg: svgPath, reference: refPath, size: [W, H], renderer: 'sharp/librsvg',
  mask: useAlpha ? 'reference alpha' : `distance > ${tolerance} from corner background rgb(${bg.join(',')})`,
  iou: round(both / Math.max(1, both + refOnly + renOnly), 4),
  pixels: { both, onlyReference: refOnly, onlyRender: renOnly },
  recall: round(both / Math.max(1, r.pixels ?? 0), 4),
  precision: round(both / Math.max(1, s.pixels ?? 0), 4),
  centroidOffsetPx: r.pixels && s.pixels ? [round(s.centroid[0] - r.centroid[0]), round(s.centroid[1] - r.centroid[1])] : null,
  sizeRatio: r.pixels && s.pixels ? [round(s.bbox[2] / r.bbox[2], 3), round(s.bbox[3] / r.bbox[3], 3)] : null,
  aspectMismatch: Math.abs(aspect.svg / aspect.reference - 1) > 0.01 ? aspect : undefined,
  note: 'No pass threshold. Compare iterations and inspect the overlay; smoothness and structure outrank IoU.',
};
await mkdir(dirname(prefix), { recursive: true });
await sharp(over, { raw: { width: W, height: H, channels: 3 } }).png().toFile(`${prefix}-overlay.png`);
await writeFile(`${prefix}-render.png`, rendered);
await writeFile(`${prefix}-compare.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
