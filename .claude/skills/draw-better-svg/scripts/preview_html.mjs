#!/usr/bin/env node
// Build a single-file HTML preview to show the user before delivery.
//
//   node preview_html.mjs art.svg preview.html [--css motion.css] [--sizes 24,48,96] [--title "Logo"]
//   node preview_html.mjs art.svg motion.html --mode motion [--css motion.css]
//
// review mode (default): the stage with the construction reveal and, when the SVG
//   or --css animates, a motion timeline; review tools (comments, markup,
//   Send/Approve, frame times); target sizes on transparent/light/dark; checks.
//   Opened as a file, Send downloads the feedback JSON and copies it to the
//   clipboard. For a live loop with the agent use review_server.mjs instead.
// motion mode: only the animation, with QA hooks for capture_frames.mjs
//   (?t=<ms>, ?static=1, ?bare=1, window.__dbsReady).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { motionPage, motionLint } from './lib/preview-page.mjs';
import { reviewPage } from './lib/review-page.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  const [value] = args.splice(i, 2).slice(1);
  return value;
};
const mode = flag('--mode', 'review');
const cssPath = flag('--css', null);
const sizesArg = flag('--sizes', null);
const title = flag('--title', undefined);
const [input, output] = args;
if (!input || !output || !['review', 'motion'].includes(mode)) {
  throw new Error('Usage: node preview_html.mjs art.svg out.html [--mode review|motion] [--css motion.css] [--sizes 24,48,96] [--title "Name"]');
}

const source = await readFile(input, 'utf8');
const motionCss = cssPath ? await readFile(cssPath, 'utf8') : '';
await mkdir(dirname(output), { recursive: true });

if (mode === 'motion') {
  const { animated, warnings } = motionLint(source, motionCss);
  await writeFile(output, motionPage({ source, motionCss, title }));
  for (const w of warnings) console.warn(`warning: ${w}`);
  console.log(JSON.stringify({ output, mode, animated, warnings }, null, 2));
} else {
  const sizes = sizesArg ? sizesArg.split(',').map(Number) : undefined;
  const { html, summary } = reviewPage({ source, input, motionCss, sizes, title });
  await writeFile(output, html);
  for (const w of summary.motionWarnings) console.warn(`warning: ${w}`);
  console.log(JSON.stringify({ output, mode, ...summary }, null, 2));
}
