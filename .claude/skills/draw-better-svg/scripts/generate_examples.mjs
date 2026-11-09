#!/usr/bin/env node
// Original, deterministic recipes. Run from any cwd; output directory is required.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { SVG, registerWindow } from '@svgdotjs/svg.js';
import { createSVGWindow } from 'svgdom';
import paper from 'paper';
import rough from 'roughjs/bundled/rough.cjs.js';
import { line, curveLinear } from 'd3-shape';
import { scaleLinear } from 'd3-scale';
import ELK from 'elkjs/lib/elk.bundled.js';
import { getStroke } from 'perfect-freehand';

const out = process.argv[2];
if (!out) throw new Error('Usage: node generate_examples.mjs OUTPUT_DIRECTORY');
await mkdir(out, { recursive: true });
const NS = 'http://www.w3.org/2000/svg';
const ink = '#18383c', teal = '#36746c', mint = '#8fc4b0', cream = '#f8f2e8', gold = '#d9a254';
const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const fmt = x => Number(x.toFixed(3));
const entries = [];

function wrap(id, width, height, title, desc, body, extra = '') {
  return `<svg xmlns="${NS}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-title ${id}-desc" ${extra}>
<title id="${id}-title">${esc(title)}</title><desc id="${id}-desc">${esc(desc)}</desc>${body}</svg>`;
}
async function save(name, title, subtitle, svg, width=360, height=240) {
  const file = join(out, `${name}.svg`);
  await writeFile(file, svg);
  entries.push({ name, title, subtitle, width, height, file, svg });
}
function canvas(id, title, description) {
  const window = createSVGWindow();
  registerWindow(window, window.document);
  const draw = SVG(window.document.documentElement).size(360, 240).viewbox(0, 0, 360, 240);
  draw.attr({ role: 'img', 'aria-labelledby': `${id}-title ${id}-desc` });
  const titleNode = window.document.createElementNS(NS, 'title');
  titleNode.id = `${id}-title`; titleNode.textContent = title;
  const descNode = window.document.createElementNS(NS, 'desc');
  descNode.id = `${id}-desc`; descNode.textContent = description;
  draw.node.append(titleNode, descNode);
  return draw;
}

// 1. A small icon: optical balance, generous gutters, a deliberate crease.
await save('01-book-icon', 'UI icon', 'Native SVG · 24-unit grid', wrap('book', 24, 24,
  'Open book', 'Two open pages with one center fold.',
  '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5.2 Q7.5 3.5 12 6 Q16.5 3.5 21 5.2 V19 Q16.5 17.3 12 20 Q7.5 17.3 3 19 Z"/><path d="M12 6 V20 M6 8.7 Q8 8.3 9.4 9.1 M14.6 9.1 Q16 8.3 18 8.7"/></g>',
  `color="${ink}"`), 24, 24);

// 2. Paper.js is the geometry engine; its exported shape is placed in our document.
paper.setup(new paper.Size(360, 240));
const outer = new paper.Path.Circle(new paper.Point(172, 120), 80);
const cut = new paper.Path.Circle(new paper.Point(210, 88), 66);
const crescent = outer.subtract(cut);
outer.remove(); cut.remove();
crescent.fillColor = teal;
// pathData works in Node without the DOM required by Paper's exportSVG().
const crescentSVG = `<path d="${esc(crescent.pathData)}" fill="${teal}" fill-rule="evenodd"/>`;
paper.project.clear();
await save('02-boolean-mark', 'Boolean mark', 'Paper.js · real cutout', wrap('mark',360,240,
  'Crescent study', 'A solid crescent with transparent negative space and a separate small circle.',
  `${crescentSVG}<circle cx="224" cy="71" r="13" fill="${gold}"/>`));

// 3. A simple editorial still life: a single direction of light, semantic groups.
const d = canvas('study', 'Evening reading', 'A desk lamp lights an open book beside a vase with a branch.');
const room = d.group().id('study-room');
room.rect(360,240).fill(cream);
room.circle(192).center(208,105).fill('#eee1c9');
room.path('M0 174 Q160 166 360 179 L360 240 L0 240 Z').fill('#dfd1b5');
const lamp = d.group().id('study-lamp');
lamp.path('M102 186 L124 78 L194 50').fill('none').stroke({color:ink,width:7,linecap:'round',linejoin:'round'});
lamp.path('M174 46 Q196 34 207 55 L223.24 86 L164 86 Z').fill(teal);
lamp.path('M173 85 L133 181 L267 181 L212 85 Z').fill('#e7c580').opacity(.28);
lamp.ellipse(58,12).center(103,189).fill(ink);
lamp.ellipse(56,9).center(192,85).fill(gold);
const book = d.group().id('study-book');
book.path('M114 190 L180 171 L259 192 L190 218 Z').fill(ink);
book.path('M116 185 Q144 169 177 171 L189 210 Q153 197 116 201 Z').fill('#fffdf6');
book.path('M177 171 Q215 168 253 188 L253 204 Q220 198 189 210 Z').fill('#f2e9d7');
book.path('M177 171 L189 210').fill('none').stroke({color:'#a3916e',width:1.5});
for (let i=0;i<4;i++) {
  book.path(`M${127+i*2} ${183+i*4} Q152 ${178+i*5} ${170+i*2} ${182+i*5}`)
    .fill('none').stroke({color:'#b3a88d',width:1.2});
}
const plant = d.group().id('study-plant');
plant.path('M286 163 Q285 124 272 105 M284 143 L305 123').fill('none').stroke({color:teal,width:2.8,linecap:'round'});
plant.path('M276 121 C254 122 250 100 257 96 C273 98 280 106 276 121 Z').fill(teal);
plant.path('M287 141 C300 141 314 128 309 116 C295 117 285 128 287 141 Z').fill(mint);
plant.path('M270 157 Q286 151 301 157 L296 190 Q285 197 274 190 Z').fill('#bd795a');
plant.ellipse(31,7).center(285.5,157).fill('#975b43');
await save('03-editorial-scene','Flat illustration','SVG.js · planned layers',d.svg());

// 4. Rough.js emits SVG paths without requiring a browser DOM.
const rg = rough.generator();
let roughBody = '';
// Rough.js emits zero-length segments (every point equal to the current point);
// drop them so the geometry audit stays clean.
function dropZeroSegments(d) {
  const out = [];
  let cur = null;
  for (const m of d.matchAll(/([MLC])([^MLC]*)/g)) {
    const nums = (m[2].match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
    const end = nums.slice(-2);
    if (m[1] !== 'M' && cur && nums.every((v, i) => Math.abs(v - cur[i % 2]) < 1e-6)) continue;
    out.push(m[0].trim());
    cur = end;
  }
  return out.join(' ');
}
function roughPaths(drawable) {
  return rg.toPaths(drawable).map(p => `<path d="${esc(dropZeroSegments(p.d))}" fill="${esc(p.fill || 'none')}" stroke="${esc(p.stroke)}" stroke-width="${p.strokeWidth}"/>`).join('');
}
roughBody += roughPaths(rg.path('M166 214 Q191 143 173 37', {seed:51,roughness:.6,stroke:ink,strokeWidth:2.2}));
for (const [i,shape] of [
  'M178 81 C143 81 125 53 127 35 C157 33 181 54 178 81 Z',
  'M180 104 C213 98 233 73 225 53 C196 56 178 78 180 104 Z',
  'M181 145 C143 145 120 122 121 100 C155 99 182 121 181 145 Z',
  'M175 180 C214 177 242 151 234 131 C204 132 179 150 175 180 Z',
].entries()) roughBody += roughPaths(rg.path(shape,{seed:52+i,roughness:.7,stroke:teal,strokeWidth:1.6,fill:mint,fillStyle:'hachure',hachureGap:7,hachureAngle:-35}));
await save('04-rough-botanical','Sketch texture','Rough.js · fixed seeds',wrap('rough',360,240,'Botanical sketch','Four leaves on a gently curved stem, drawn with deterministic hatching.',roughBody));

// 5. D3 computes coordinates from data. These are labeled illustrative values.
const data = [24,46,40,68,63,88].map((v,i)=>({x:i+1,y:v}));
const xs = scaleLinear().domain([1,6]).range([45,329]);
const ys = scaleLinear().domain([0,100]).range([196,30]);
let chart = '';
for (const tick of [0,25,50,75,100]) {
  chart += `<path d="M45 ${ys(tick)} H329" stroke="#d7e0dc"/><text x="34" y="${ys(tick)+4}" text-anchor="end" font-size="11">${tick}</text>`;
}
for (const p of data) chart += `<text x="${xs(p.x)}" y="218" text-anchor="middle" font-size="11">${p.x}</text>`;
chart += `<path d="${line().x(p=>xs(p.x)).y(p=>ys(p.y)).curve(curveLinear)(data)}" fill="none" stroke="${teal}" stroke-width="3" stroke-linejoin="round"/>`;
chart += data.map(p=>`<circle cx="${xs(p.x)}" cy="${ys(p.y)}" r="4" fill="${cream}" stroke="${teal}" stroke-width="2"/>`).join('');
await save('05-data-chart','Data chart','D3 · coordinates from values',wrap('chart',360,240,'Illustrative observations','Sample observations 1 to 6 have values 24, 46, 40, 68, 63, and 88. Vertical axis runs from zero to one hundred.',`<g fill="${ink}" font-family="DejaVu Sans, sans-serif">${chart}</g>`));

// 6. ELK computes a branching graph; text dimensions are supplied before layout.
const elk = new ELK();
const labels = {brief:'Brief',vector:'Geometry',type:'Type',review:'Review'};
const graph = await elk.layout({ id:'root',layoutOptions:{'elk.algorithm':'layered','elk.direction':'RIGHT','elk.edgeRouting':'ORTHOGONAL','elk.spacing.nodeNode':'26','elk.layered.spacing.nodeNodeBetweenLayers':'35'},
  children:Object.keys(labels).map(id=>({id,width:85,height:42})),
  edges:[['brief','vector'],['brief','type'],['vector','review'],['type','review']].map(([a,b],i)=>({id:`e${i}`,sources:[a],targets:[b]}))});
let diagram = '<defs><marker id="flow-arrow" markerWidth="7" markerHeight="7" refX="7" refY="3.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L7 3.5 L0 7 Z" fill="#36746c"/></marker></defs>';
for (const edge of graph.edges) for (const s of edge.sections || []) {
  const points=[s.startPoint,...(s.bendPoints || []),s.endPoint];
  diagram += `<path d="${points.map((p,i)=>`${i?'L':'M'}${fmt(p.x)} ${fmt(p.y)}`).join(' ')}" fill="none" stroke="${teal}" stroke-width="1.5" marker-end="url(#flow-arrow)"/>`;
}
for (const n of graph.children) diagram += `<g id="flow-${n.id}"><rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="8" fill="${n.id==='review'?ink:'#e5eee7'}"/><text x="${n.x+n.width/2}" y="${n.y+n.height/2+4}" font-family="DejaVu Sans, sans-serif" font-size="12" text-anchor="middle" fill="${n.id==='review'?cream:ink}">${labels[n.id]}</text></g>`;
const gw=graph.width, gh=graph.height;
await save('06-layout-diagram','Branching diagram','ELK · computed routing',wrap('flow',gw,gh,'Drawing review workflow','A brief branches into geometry and type, and both feed review.',diagram),gw,gh);

// 7. Explicit pressure yields reproducible variable-width ink, not a constant SVG stroke.
const samples=[];
for (let i=0;i<=60;i++) {
  const t=i/60;
  samples.push([42+276*t,120-62*Math.sin(t*Math.PI*2),.2+.65*Math.sin(t*Math.PI)]);
}
const outline = getStroke(samples,{size:16,thinning:.75,smoothing:.55,streamline:.4,simulatePressure:false,last:true})
  .filter((p, i, all) => i === 0 || Math.hypot(p[0] - all[i - 1][0], p[1] - all[i - 1][1]) >= 2); // dense cap points read as noisy anchors
// Quadratic curves through the midpoints between outline points (the approach the
// perfect-freehand README documents); straight L segments make the ink faceted.
const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
const inkPath=`M${fmt(outline[0][0])} ${fmt(outline[0][1])} `+outline.map((p,i)=>{
  const m=mid(p,outline[(i+1)%outline.length]);
  return `Q${fmt(p[0])} ${fmt(p[1])} ${fmt(m[0])} ${fmt(m[1])}`;
}).join(' ')+' Z';
await save('07-pressure-ink','Variable-width ink','Perfect Freehand · pressure',wrap('ink',360,240,'Pressure stroke study','A flowing curve whose ink width follows explicit pressure values.',`<path d="${inkPath}" fill="${ink}"/>`));

// 8. Pattern repetition is declarative; spacing and phase live in the tile.
await save('08-repeat-pattern','Repeat pattern','Native SVG · reusable tile',wrap('pattern',360,240,'Leaf repeat','A regular two-color botanical repeat with a fixed sixty-unit tile.',`
<defs><pattern id="leaf-tile" patternUnits="userSpaceOnUse" width="60" height="60"><path d="M10 43 C7 24 20 12 32 12 C35 27 23 42 10 43 Z" fill="${mint}"/><path d="M39 54 C35 41 42 31 54 29 C58 43 49 53 39 54 Z" fill="${teal}"/></pattern><clipPath id="pattern-frame"><rect x="29" y="20" width="302" height="200" rx="16"/></clipPath></defs><g clip-path="url(#pattern-frame)"><rect x="29" y="20" width="302" height="200" fill="${cream}"/><rect x="29" y="20" width="302" height="200" fill="url(#leaf-tile)"/></g>`));

// Comparison atlas: SVG images are embedded as nested vector elements, never raster previews.
const cellW=346, cellH=300, pad=26, gap=18, atlasW=1490, atlasH=804;
let atlas=`<rect width="${atlasW}" height="${atlasH}" fill="#eeeae1"/><g font-family="DejaVu Sans, sans-serif" fill="${ink}"><text x="${pad}" y="53" font-size="31" font-weight="bold">One format. Different drawing problems.</text><text x="${pad}" y="84" font-size="15">Eight original SVG studies · geometry, style, layout, and rendering are separate decisions</text>`;
for (const [i,item] of entries.entries()) {
  const x=pad+(i%4)*(cellW+gap), y=116+Math.floor(i/4)*(cellH+gap);
  atlas+=`<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="13" fill="#fffdf7"/>`;
  let w=cellW-26,h=208, px=x+13,py=y+12;
  if (item.name==='01-book-icon') { w=h=96; px=x+(cellW-w)/2;py=y+62; }
  const nested=item.svg.replace(/<svg\b[^>]*>/,m=>m.replace(/\s(?:width|height)="[^"]*"/g,'').replace('> ', '>').replace(/>$/,` x="${px}" y="${py}" width="${w}" height="${h}">`));
  atlas+=nested+`<text x="${x+20}" y="${y+250}" font-size="18" font-weight="bold">${esc(item.title)}</text><text x="${x+20}" y="${y+274}" font-size="12" fill="#5b706f">${esc(item.subtitle)}</text>`;
}
atlas+='</g><text x="26" y="773" font-family="DejaVu Sans, sans-serif" font-size="13" fill="#5b706f">Draw Better SVG · editable paths and shapes · chart data is illustrative</text>';
await writeFile(join(out,'svg-types-atlas.svg'),wrap('atlas',atlasW,atlasH,'SVG drawing types','Eight vector examples: icon, boolean mark, flat illustration, sketch, chart, diagram, pressure ink, and repeat pattern.',atlas));
const versions=JSON.parse(await readFile(new URL('./package.json',import.meta.url),'utf8')).dependencies;
await writeFile(join(out,'examples-manifest.json'),JSON.stringify({output:resolve(out),dependencies:versions,examples:entries.map(({svg,...rest})=>rest)},null,2));
console.log(`Generated ${entries.length} SVG studies and svg-types-atlas.svg in ${resolve(out)}`);
