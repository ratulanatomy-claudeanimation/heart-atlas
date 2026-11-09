# SVG scripting guide

## Contents

1. Workbench and commands
2. Plan before coordinates
3. Geometry and curves
4. Runnable library recipes
5. Text, definitions, and portability
6. Rendering and optimization
7. Delivery contracts

## 1. Workbench and commands

Use Node for the library recipes and Python 3 for the dependency-free structural
audit. The bundled lockfile records exact dependency resolution. The example
suite was exercised on Node 24.20.0; use a supported Node version compatible with
the dependencies, rather than assuming every older Node version works.

From this skill's directory:

```bash
npm ci --prefix scripts
node scripts/generate_examples.mjs ./review/examples
python3 scripts/audit_svg.py ./review/examples/03-editorial-scene.svg --json
python3 scripts/path_audit.py ./review/examples/03-editorial-scene.svg --svg-out ./review/scene-handles.svg
node scripts/render_review.mjs ./review/examples/03-editorial-scene.svg ./review/scene 180,360,720
node scripts/preview_html.mjs ./review/examples/03-editorial-scene.svg ./review/scene-preview.html
node scripts/optimize_svg.mjs ./review/examples/03-editorial-scene.svg ./review/scene.min.svg
```

| Script | Needs | Job |
| --- | --- | --- |
| `audit_svg.py` | Python 3 | Structure: root, viewBox, IDs, references, active content |
| `path_audit.py` | Python 3 | Contours: near-kinks, staircases, facets, tiny segments, long handles; handle overlay |
| `render_review.mjs` | sharp | PNG previews at chosen widths on transparent, light, dark |
| `preview_html.mjs` | none | Single-file review page: reveal, sizes, checks incl. contrast, motion stage |
| `compare_reference.mjs` | sharp | Raster reference overlay, IoU, centroid offset, size ratio |
| `capture_frames.mjs` | playwright-core, Chrome/Edge | Motion frames, strip, final-frame and reduced-motion checks, style probes |
| `optimize_svg.mjs` | svgo | Conservative delivery copy |
| `generate_examples.mjs` | all libraries | Example suite for the recipes below |

The full suite has optional packages for demonstrating different workflows. For a
separate project install only the packages needed, pin them with `--save-exact`,
and retain the generated lockfile. Do not commit `node_modules`.

| Package | Version used in the bundled examples | Responsibility |
| --- | --- | --- |
| `@svgdotjs/svg.js` | 3.2.8 | Document construction |
| `svgdom` | 0.1.29 | SVG DOM in Node |
| `paper` | 0.12.18 | Curves and boolean geometry |
| `roughjs` | 4.6.6 | Seeded sketch paths |
| `perfect-freehand` | 1.2.3 | Pressure outlines |
| `d3-scale` / `d3-shape` | 4.0.2 / 3.2.0 | Data-to-coordinate mapping |
| `elkjs` | 0.12.0 | Graph layout |
| `sharp` | 0.35.4 | Static rendering through librsvg |
| `playwright-core` | 1.63.0 | Drives an installed Chrome/Edge for motion capture |
| `svgo` | 4.1.0 | Delivery cleanup |

These are tested versions, not a claim that they are always the latest. Check
the project's current requirements before changing them.

The following excerpts explain the executable `scripts/generate_examples.mjs`.
That file is the complete runnable recipe with imports, escaping, file output,
and accessible wrappers. Run it directly before adapting a fragment. An ESM file
must resolve its dependencies relative to its own location, not merely the shell's
current directory; put new recipes in the workbench with their package.json.

## 2. Plan before coordinates

Represent meaning independently from implementation:

```js
const brief = {
  canvas: { width: 360, height: 240, padding: 18 },
  palette: { ink: '#18383c', leaf: '#36746c', paper: '#f8f2e8' },
  subject: 'open book under a lamp',
  groups: ['room', 'lamp', 'book', 'plant'],
  reviewWidths: [180, 360, 720]
};
```

Allocate bounds and anchors in a small scene model. Derive repeated positions from
parameters. If the lamp moves, its shade, stem, and light cone should share a local
coordinate system or a common anchor instead of unrelated magic numbers.

Separate data, layout, geometry, rendering, and export functions. Keep stable IDs
for objects that will be edited or animated. Use a fixed random seed for any
texture so a revision changes the intended geometry, not the whole drawing.

For a diagram, make label dimensions part of node dimensions before running the
layout engine. For a chart, compute scales from validated data before drawing.
For a character, establish a gesture curve and shoulder/hip/limb landmarks before
building closed contours. Texture is the final pass.

## 3. Geometry and curves

### Coordinate policy

SVG's usual root coordinates increase rightward and downward. Use a viewBox that
matches the art's proportions. A rectangle at x=0 with a centered stroke extends
beyond the left edge; padding must include that painted area.

Put an object in a group with its own local origin. A clear transform hierarchy is
useful for editing; flattening every transform is not inherently better. Know
whether stroke widths should scale with the object. Use non-scaling strokes only
when that visual behavior is intentional and supported by the target.

### Cubic Bézier construction

For control points P0, P1, P2, P3:

```text
B(t) = (1-t)^3 P0 + 3(1-t)^2 t P1 + 3(1-t)t^2 P2 + t^3 P3
start tangent = 3(P1-P0)
end tangent   = 3(P3-P2)
```

At a smooth join J, align the incoming and outgoing tangent directions. Collinear
handles pointing along the same travel direction provide tangent continuity.
Equal derivative vectors provide C1 continuity under the same parameterization.
Neither condition alone proves an attractive curve: inspect curvature and scale.

Use a small number of intentional anchors near meaningful turns and extrema.
Add an anchor only when it gives needed shape control. Jagged outlines usually
need better handles or fewer points, not more decimals. Use `S` only when its
reflected control point gives the intended join. Use `Q` for simple bows and `A`
for genuine elliptical arcs.

Closed filled shapes create real silhouettes. Open decorative curves need
`fill="none"`; otherwise SVG can fill the implicit closing region. Set line caps
and joins deliberately. Very sharp miter joins can create spikes.

### Overlap and optical correction

Avoid accidental tangencies: separate shapes clearly or overlap them enough to
communicate depth. Keep holes as true negative space. A white covering shape only
works on white and is not a transparent cutout.

An icon can be mathematically centered but optically unbalanced. Review its mass
at actual size. Adjust heavy lobes and inner gaps before changing the viewBox.
Do not apply a blanket half-pixel offset: the useful alignment depends on the
stroke width, viewBox-to-CSS scale, and device pixel ratio. Alignment is most
useful for axis-aligned edges, not arbitrary curves.

### Isometric construction

For a simple isometric projection with z increasing upward:

```js
function iso(x, y, z, scale = 1) {
  return [scale * (x-y) * Math.cos(Math.PI/6),
          scale * ((x+y) * Math.sin(Math.PI/6) - z)];
}
```

Add a screen origin after projection. Generate connected surfaces from shared
3D vertices. Choose a depth/occlusion strategy; projecting vertices alone does
not solve hidden surfaces or complex intersecting objects.

## 4. Runnable library recipes

### A. SVG.js and svgdom: structured illustration

```js
import { SVG, registerWindow } from '@svgdotjs/svg.js';
import { createSVGWindow } from 'svgdom';
const window = createSVGWindow();
registerWindow(window, window.document);
const draw = SVG(window.document.documentElement).size(360, 240).viewbox(0, 0, 360, 240);
const book = draw.group().id('scene-book');
book.path('M55 100 Q110 82 170 110 L170 190 Q110 165 55 180 Z').fill('#f8f2e8');
const serialized = draw.svg();
```

Use the full example's title and description wrapper before delivery. SVG.js
provides document operations; it does not design a composition or infer anatomy.
SVG DOM font measurements require the actual fonts to be configured. Do not
treat a fallback font's bounding box as proof of the target font's fit.

### B. Paper.js: actual boolean cutouts

```js
import paper from 'paper';
paper.setup(new paper.Size(360, 240));
const disk = new paper.Path.Circle(new paper.Point(172, 120), 80);
const cutter = new paper.Path.Circle(new paper.Point(210, 88), 66);
const result = disk.subtract(cutter);
disk.remove(); cutter.remove();
const pathData = result.pathData;
// Write pathData as an escaped d attribute in an SVG path, then clear the project.
paper.project.clear();
```

This Node route uses Paper for geometry and the workbench for XML. It avoids the
DOM needed by Paper's `exportSVG()`. A browser or suitably configured DOM can use
the full export method. Do not mix PaperScript's operator overloads with ordinary
JavaScript; use its vector methods or numeric arithmetic.

For a union or subtraction, remove intermediate operands when exporting a whole
project; otherwise invisible construction work can accidentally remain visible.
For several closed contours, verify winding and `fill-rule` at both scales.

### C. Rough.js: sketch effects after shape design

```js
import rough from 'roughjs/bundled/rough.cjs.js';
const generator = rough.generator();
const shape = generator.path('M30 110 C25 60 65 25 115 25 C120 75 80 112 30 110 Z', {
  seed: 42, roughness: 0.7, stroke: '#36746c', strokeWidth: 1.6,
  fill: '#8fc4b0', fillStyle: 'hachure', hachureGap: 7
});
const svgPaths = generator.toPaths(shape);
// Each record supplies d, stroke, strokeWidth, and fill; serialize those attributes.
```

Use separate fixed seeds per shape. Preserve the underlying contour and layout.
Increasing roughness cannot repair a poorly proportioned object. Avoid roughening
every text glyph or tight diagram connector; hatching density must survive the
final display size.

### D. Perfect Freehand: variable-width ink

```js
import { getStroke } from 'perfect-freehand';
const points = [[20,80,.2], [50,40,.5], [90,35,.8], [130,70,.4]];
const outline = getStroke(points, {
  size: 10, thinning: .7, smoothing: .5,
  simulatePressure: false, last: true
});
// Quadratic curves through midpoints; `L` segments would make the ink faceted.
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const d = `M${outline[0].join(' ')} ` + outline.map((p, i) =>
  `Q${p.join(' ')} ${mid(p, outline[(i + 1) % outline.length]).join(' ')}`).join(' ') + ' Z';
```

The returned shape is a filled outline, not a stroke-width modifier on the
original centerline. Supply enough input samples for the desired curvature.
Use explicit pressure for reproducibility or deliberately choose simulated
pressure. The bundled example uses a dense smooth centerline; sparse arbitrary
points can produce abrupt geometry. Preserve the centerline as source data.

### E. D3: values determine geometry

```js
import { scaleLinear } from 'd3-scale';
import { line, curveLinear } from 'd3-shape';
const values = [24,46,40,68,63,88]; // Illustrative data, not measurements.
const x = scaleLinear().domain([0, values.length-1]).range([45,329]);
const y = scaleLinear().domain([0,100]).range([196,30]);
const d = line().x((v,i) => x(i)).y(v => y(v)).curve(curveLinear)(values);
```

Generate ticks, markers, and labels from the same scales. Validate nulls, units,
category order, outliers, and domains. Bar lengths normally need a zero baseline.
Do not smooth a line merely for decoration when the implied intermediate values
matter. Label fabricated demonstration data as illustrative.

For maps, use a suitable D3 Geo projection and geographic path generator; do not
reuse this Cartesian chart mapping for geographic data without justification.

### F. ELK: diagram coordinates and routing

```js
import ELK from 'elkjs/lib/elk.bundled.js';
const elk = new ELK();
const result = await elk.layout({
  id: 'root',
  layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': 'RIGHT' },
  children: [{ id:'a', width:85, height:42 }, { id:'b', width:85, height:42 }],
  edges: [{ id:'ab', sources:['a'], targets:['b'] }]
});
```

The full example uses a branch and convergence. Read returned node positions and
edge sections, including bend points. Draw background regions, then ordinary
edges, then nodes and labels. Routing still needs inspection when ports, nested
groups, edge labels, or crossing constraints matter. Label text must fit the
dimensions supplied to ELK; layout engines do not infer arbitrary SVG font metrics.

## 5. Text, definitions, and portability

### Text

Write UTF-8. An XML declaration is optional for ordinary UTF-8 standalone SVG;
non-ASCII characters do not inherently require one. Escape `&`, `<`, and other
XML-sensitive content rather than concatenating untrusted labels into markup.

SVG text does not offer universally portable HTML-like wrapping. Use measured
lines and tspans with explicit baselines. Wait for fonts to load in browser
measurements; check the exact weight and glyph set. Test ő and ű for Hungarian
text. A font family fallback is not identical visual output.

Keep an editable live-text master. Outline text only for a delivery need, using
the real font and a shaping-capable workflow for its script. An outlined word is
no longer searchable text, so preserve original strings and accessible metadata.
Do not invent glyph paths or assume letter-by-letter positioning handles every
writing system.

### Definitions, IDs, masks

Use a per-file prefix such as `reading-lamp-gradient`. If the same SVG is inserted
twice into one DOM, give each instance a unique prefix too. A file-level prefix
alone does not prevent collisions between copies. Preserve references in
`url(#...)`, `href`, CSS, animation, and ARIA when renaming.

Use `clipPathUnits="userSpaceOnUse"` when clip coordinates are in your scene.
For masks, specify coordinate units and alpha/luminance semantics intentionally.
Opaque black hides in a luminance mask but remains opaque in an alpha mask; those
are different operations. Check the target renderer's support.

For filters, expand the filter region enough to include the visible effect.
About three standard deviations is a useful initial Gaussian-blur margin, not a
universal proof against clipping. Inspect the raster output at actual size.

### Bounds and access

`getBBox()` ordinarily returns geometry in local user coordinates and does not
automatically include ancestor transforms or all painted extents. Default stroke
and marker handling is not a substitute for a rendered bounds check. Map bounds
into the common coordinate system before collision reasoning.

An informative inline SVG can use a title and description with unique referenced
IDs. A decorative inline SVG can be hidden from the accessibility tree. An
external `<img>` needs the appropriate `alt` on the host element; internal SVG
metadata is not a substitute for that host contract.

## 6. Rendering and optimization

Use three independent checks:

1. Structural audit: parse, viewBox, references, prohibited profile features.
2. Rendered inspection: recognition, layout, text, overlaps, gaps, clipping.
3. Actual-host behavior: styling, accessibility, fonts, motion, interaction.

The audit's success means no implemented error rule fired. It does not validate
all path syntax, calculate intersections, sanitize SVG, or certify appearance.
The static renderer uses sharp/librsvg and does not execute animation. Use a real
browser for motion and HTML embedding. Do not open untrusted active content as
though an XML check had made it safe; use the host's normal isolation rules.

Render each requested size at adequate input density. Increasing a low-resolution
PNG after rasterization cannot demonstrate vector quality. The bundled renderer
adjusts input density and creates transparent, light, and dark previews. Inspect
the transparent artwork on the actual target background too.

The bundled optimizer deliberately uses a small plugin list. It preserves IDs,
groups, titles, descriptions, dimensions, and viewBox. It may save little space;
it is a conservative delivery step, not a maximum compression recipe.

For stronger SVGO optimization, choose plugins for the actual context and version.
Preserve accessible descriptions, selectors, animation targets, and editability.
ID cleanup can cause inline conflicts; reproducible prefixing can help, but
repeated instances still need unique IDs. Compare pre/post renders at the same
dimensions. A pixel difference is a diagnostic, not a universal aesthetic score.

## 7. Delivery contracts

| Output | Include | Check |
| --- | --- | --- |
| Static file | Namespace, viewBox, self-contained assets, editable groups | Opens in intended renderer |
| Inline UI asset | Theme behavior, deliberate accessible role | Host CSS and multiple instances |
| External image | Correct intrinsic ratio and host alt | No assumed host color inheritance |
| Editor/print | Supported effects and font strategy | Open in intended editor; proof export |
| Motion | Stable selectors, useful static frame, reduced-motion state | Browser timeline and host behavior |
| Chart/map | Data, units, source, coordinate/scaling choices | Numerical and visual correctness |

Return the source generator when it materially improves future editing. Record
dependencies and any reference provenance. Never present a generated PNG preview
as the editable SVG deliverable.
