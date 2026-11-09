#!/usr/bin/env node
// Conservative static-delivery copy. Keep the editable original and rerender both.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { optimize } from 'svgo';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node optimize_svg.mjs source.svg delivery.svg');
if (resolve(input) === resolve(output)) throw new Error('Keep the editable original: use a different output path.');
const source = await readFile(input, 'utf8');
const result = optimize(source, {
  path: input,
  multipass: false,
  // Explicit list avoids changing preset defaults and preserves IDs, groups, titles, viewBox.
  plugins: ['removeDoctype', 'removeXMLProcInst', 'removeComments', 'cleanupAttrs', 'sortAttrs'],
});
await mkdir(dirname(output), { recursive: true });
await writeFile(output, result.data);
console.log(JSON.stringify({ inputBytes: Buffer.byteLength(source), outputBytes: Buffer.byteLength(result.data), output }));
