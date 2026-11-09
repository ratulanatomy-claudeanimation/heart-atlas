---
name: draw-better-svg
description: >-
  Plan, create, inspect, animate, and repair well-drawn editable SVG graphics
  with type-specific geometry, library selection, and rendered visual review.
  Use for SVG illustrations, icons, logos, logo animation, organic line art,
  diagrams, charts, patterns, maps, vector assets, filters and textures,
  tracing a raster reference into clean vectors, SVG quality problems, and SVG
  prompting or scripting guidance. Distinguish real vectors from raster images
  in SVG wrappers and static assets from interactive web SVG.
license: MIT
metadata:
  version: "1.3.0"
  repository: https://github.com/arlinamid/draw-better-svg
---

# Draw Better SVG

Improve the drawing before compressing the markup. Treat valid XML, geometric
correctness, and visual quality as separate requirements.

## Route the task

1. Read [taxonomy.md](references/taxonomy.md) to classify the subject, construction,
   and delivery context. SVG is one format; the categories are practical workflows.
2. For an existing file, run `python3 scripts/audit_svg.py INPUT.svg --json` and
   `python3 scripts/path_audit.py INPUT.svg` from this skill directory, then render
   it. Report structural and geometric facts separately from visual judgments. Do
   not infer the subject from element counts alone.
3. Read [scripting-guide.md](references/scripting-guide.md) for implementation,
   [prompting-guide.md](references/prompting-guide.md) for briefs and revision prompts,
   and [review-and-repair.md](references/review-and-repair.md) for acceptance checks
   and reference fits (tracing or reconstructing a raster source).
   **For any subject with volume (figure, animal, head, object, still life), read
   [form-and-light.md](references/form-and-light.md)** before blocking in: build
   from simple solids, wrap them with cross-contours, and fix one light direction
   and its five values before colour or detail. For bent joints, hands, and faces
   at any angle, also read [joints-and-faces.md](references/joints-and-faces.md):
   landmarks per joint, Loomis head, and the implicit 3D-skeleton method.
   Read [effects.md](references/effects.md) before adding filters, textures,
   gradients, or theming, and [motion.md](references/motion.md) for logo or other
   SVG animation. **Before animating a character or an animal, read its
   [Character motion](references/motion.md#character-motion) section** and plan
   the principles (solid drawing, timing, follow-through, secondary action, arcs,
   appeal) before writing keyframes; a body that moves as one rigid piece is the
   default failure.
4. Read [ecosystem.md](references/ecosystem.md) only when choosing a library,
   comparing existing skills, or checking primary sources.

## Establish a brief

Extract the subject, intended audience, target sizes, every background the asset
will sit on (light and dark for a transparent logo or icon), visual style,
exact text/data, required editability, and output environment. Use
`assets/brief-template.json` as a planning example, not a fixed design prescription.
State useful assumptions and proceed; ask only when the answer changes the
meaning, required geometry, or delivery format.

Choose a target-size family, not just a large viewBox. A 24 px icon and a 960 px
illustration need different detail budgets. Keep source data separate from
coordinates. Preserve the user's references and existing artwork constraints.

## Draw in passes

1. **Composition:** allocate bounds, negative space, dominant silhouette, and
   layer order. For figures, place gesture and anatomical landmarks first. For
   diagrams, measure text and calculate node layout before routing connectors.
2. **Structure:** draw the major masses in flat tones, built from simple solids
   (sphere, egg, cylinder, box) kept in a `construction` group. Use local
   coordinates and named groups. Render this pass when structure or subject
   recognition is uncertain.
3. **Geometry:** refine a small set of purposeful Bézier segments, joins, cutouts,
   overlaps, and perspective. Prefer computed geometry to guessed path strings.
4. **Style:** apply a limited palette, consistent line hierarchy, and a defined
   light direction. Shade in two tones first (lit plane, shadow shape), then add
   the five values; warm light pairs with cool shadow, never black or grey. Make
   gloss with sharp edges and local contrast, not with more detail. Add texture
   only when it serves the requested style.
5. **Review:** render at the intended display sizes; inspect the image. Run the
   path audit on hand-built or traced contours. For shaded art, also inspect a
   greyscale and a two-tone render ([value checks](references/form-and-light.md#value-and-shadow-shape-checks)). Fix the highest-impact visible
   defect in geometry or composition before adding detail.
6. **Review with the user:** before handing over finished artwork, start
   `review_server.mjs` in the background, give the user its URL, and block on
   `review_server.mjs --wait`. The page shows the construction reveal, the motion
   timeline, target sizes on light and dark, and the checks; the user pins
   comments, draws marks, and presses Send or Approve. Each comment names the
   element, its coordinates, and on animations the frame time. Apply the round,
   let the page reload, and wait again until the status is `approved`. See
   [review-and-repair.md](references/review-and-repair.md#review-with-the-user).
7. **Delivery:** keep an editable source, generate an optimized copy only when
   useful, and rerender the copy. Report what was actually checked.

Keep visual changes local during repair. Translate criticism into a visible
defect, its cause, and a concrete edit. Do not claim that a file is visually
verified merely because XML parsing or an automated check passed.

## Choose the smallest useful toolkit

| Need | Default |
| --- | --- |
| Small icon or simple symbol | Native SVG primitives and short paths |
| Repeated objects, structured illustration | SVG.js; add svgdom for headless Node |
| Boolean shapes, curve editing | Paper.js geometry; serialize pathData in headless Node |
| Sketch surface | Rough.js with a fixed seed |
| Pressure ink | Perfect Freehand with explicit pressure points |
| Quantitative chart | D3 scales/shapes or an established chart tool |
| Branching diagram | ELK layout, then SVG rendering |
| Shadows, textures, grading, glass | Native filters from [effects.md](references/effects.md), clipped to the shape |
| Fit to a raster reference | Complexity ladder + `compare_reference.mjs` overlay + `path_audit.py` |
| Logo animation | CSS keyframes per [motion.md](references/motion.md); `capture_frames.mjs` for evidence |
| Shaded figure, bent joints, a face at any angle | 3D skeleton + implicit anatomy (`scripts/lib/sdfkit.mjs`, `anatomy.mjs`) rendered to vector bands and lines per [joints-and-faces.md](references/joints-and-faces.md) |
| Character animation | Joint groups, IK solved at sampled poses, the principles in [Character motion](references/motion.md#character-motion); review key frames with the user |
| Preview | sharp/librsvg or resvg; use a browser for browser-specific behavior |
| Delivery optimization | SVGO after visual approval |

Do not install the whole toolkit for one small icon. The bundled example suite
uses all dependencies to demonstrate them; ordinary tasks should select a subset.
Respect host instructions for image tools. A raster reference or traced bitmap
does not establish that the final result is clean, editable vector artwork.

## Apply precise SVG rules

- Set the standalone SVG namespace and a finite positive `viewBox`. Preserve
  aspect ratio unless intentional stretching is part of the brief.
- Reserve room for strokes, markers, and filters; geometry bounds alone are not
  always painted bounds. Use SVG paint order deliberately.
- Name groups by objects; prefix definition IDs. Repeated inline instances need
  instance-unique IDs as well as file prefixes.
- Use `fill="none"` for open line work. Define clipping/masking coordinate
  systems deliberately; choose alpha versus luminance mask semantics explicitly.
- Choose `currentColor` for themeable inline assets; external SVG images do not
  inherit their host page's CSS color. Test the actual embedding mode.
- Keep text live when editing or selection matters; outline a delivery copy only
  when needed and when the font license permits. Keep accessible naming and the
  original text. Verify Hungarian accents when present: á é í ó ö ő ú ü ű.
- Keep animation and interaction as an explicit delivery profile. Provide a
  meaningful static state and reduced-motion behavior; test them in a browser.
- Keep vector deliverables free of raster placeholders unless hybrid output is
  requested. Do not substitute a background-colored shape for a transparent hole.

## Use the bundled scripts

Run from this skill directory, or use its absolute path. Install optional Node
dependencies with `npm ci --prefix scripts` only when using the example/render
tools. The Python audit has no third-party dependencies; where `python3` is
missing (common on Windows), run the same commands with `python`.

```bash
python3 scripts/audit_svg.py drawing.svg --json
python3 scripts/path_audit.py drawing.svg --svg-out ./review/drawing-handles.svg
node scripts/render_review.mjs drawing.svg ./review/drawing 24,48,256
node scripts/review_server.mjs drawing.svg --open        # background; prints the URL
node scripts/review_server.mjs --wait drawing.svg        # blocks until Send/Approve
node scripts/preview_html.mjs drawing.svg ./review/drawing-preview.html
node scripts/compare_reference.mjs drawing.svg source.png ./review/fit-01
node scripts/preview_html.mjs logo.svg ./review/logo-motion.html --mode motion --css motion.css
node scripts/capture_frames.mjs ./review/logo-motion.html ./review/motion
node scripts/optimize_svg.mjs drawing.svg drawing.min.svg
node scripts/generate_examples.mjs ./review/examples
```

`preview_html.mjs` and `review_server.mjs` need no dependencies (the server
adds a PNG and animation frames to each round when sharp and playwright-core are
installed); `compare_reference.mjs` and the
renderers need sharp; `capture_frames.mjs` needs playwright-core and an installed
Chrome or Edge (or `CHROME_BIN`).

Select meaningful raster widths for the artwork. `render_review.mjs` creates
transparent, light, and dark static previews. Fixed backgrounds inside the SVG
remain fixed. Neither it nor the audits verify animation, full SVG conformance,
text collisions, appearance, accessibility behavior, or safety of untrusted files.
Use the web audit profile only for intentional web/hybrid features; review its
warnings. Treat optimization as optional and preserve the editable master.

## Finish

Deliver the requested SVG and, where useful, its generator and a preview. State
the target sizes and renderer actually inspected; distinguish unresolved browser,
font, or motion checks. Use the host's persistent file-saving workflow. Do not
promise recognition, aesthetic quality, or cross-renderer fidelity without evidence.
