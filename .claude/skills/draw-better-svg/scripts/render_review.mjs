#!/usr/bin/env node
// Static PNG review with sharp/librsvg. Does not execute CSS/SMIL animation.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';

const [input, prefix, widthsArg = '320,960'] = process.argv.slice(2);
if (!input || !prefix) throw new Error('Usage: node render_review.mjs input.svg output-prefix [widths: 320,960]');
const widths = widthsArg.split(',').map(Number);
if (!widths.length || widths.some(w => !Number.isInteger(w) || w < 1 || w > 8192)) {
  throw new Error('Widths must be integers between 1 and 8192.');
}
const svg = await readFile(input);
await mkdir(dirname(prefix), { recursive: true });
const original = await sharp(svg).metadata();
const summary = { input, renderer: 'sharp/librsvg', versions: sharp.versions, images: [] };
for (const width of widths) {
  const height = Math.max(1, Math.round(width * original.height / original.width));
  if (!Number.isFinite(height) || width * height > 64000000) throw new Error('Raster size exceeds review budget.');
  // Increase SVG input density as well as output size, avoiding enlarged low-resolution rasters.
  const density = Math.max(72, 72 * width / original.width);
  for (const [name, background] of [['transparent', null], ['light', '#f8f5ee'], ['dark', '#17242b']]) {
    let pipeline = sharp(svg, { density, limitInputPixels: 64000000 }).resize(width, height);
    if (background) pipeline = pipeline.flatten({ background });
    const output = `${prefix}-${width}-${name}.png`;
    await pipeline.png().toFile(output);
    summary.images.push({ output, width, height, background });
  }
}
await writeFile(`${prefix}-render.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary.images, null, 2));
