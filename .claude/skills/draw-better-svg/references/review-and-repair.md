# Review and repair

## Contents

- Gates and evidence
- Visual rubric
- Common defects
- Meaningful automated checks
- Reference fits
- Review with the user
- Verification record

## Gates and evidence

Use a structural gate, a visual gate, and a delivery gate. Passing one does not
imply passing the others.

| Gate | Evidence | Cannot prove |
| --- | --- | --- |
| Structural | XML parses; finite viewBox; unique IDs; references resolve | Good anatomy, layout, complete SVG conformance |
| Visual | Inspected raster at actual sizes and relevant backgrounds | Browser interaction, all fonts/renderers, data provenance |
| Delivery | Tested in the actual host/editor and requested states | Universal support in other contexts |

For a new small icon, one target-size sheet and a structural audit are usually
enough. For animation, verify relevant frames and reduced motion in a browser.
For a reference reconstruction, compare aligned crops and semantic landmarks.
For a chart, test source-value-to-mark mapping as well as the raster.

## Visual rubric

Use the following as a heuristic, not a validated aesthetic measurement.
Score each applicable dimension 0 (fails), 1 (weak), 2 (adequate), or 3 (strong),
and attach at least one concrete observation to every score below 2.

| Dimension | What to inspect |
| --- | --- |
| Recognition | Can the intended object/message be identified at target size? |
| Composition | Is there a clear hierarchy and useful negative space? |
| Geometry | Do contours, joins, proportions, and perspective fit the intent? |
| Separation | Are objects, limbs, arrow paths, and cutouts unambiguous? |
| Style | Are stroke weights, corners, palette, and lighting coherent? |
| Form | Do shaded objects read as solid: one light direction, distinct values, cast shadows, near forms larger and in front? |
| Text/data | Are labels, glyphs, values, units, and relationships correct? |
| Portability | Does the artifact behave in its required delivery context? |
| Editability | Can named objects or parameters be changed without reconstructing the file? |

Do not average away a failed required dimension. A gorgeous chart with wrong data
or a logo with a closed counter fails its relevant requirements. Mark inapplicable
dimensions N/A instead of forcing them into a misleading total score.

## Common defects

| Symptom | Likely cause | Repair |
| --- | --- | --- |
| Organic art looks assembled from toys | Primitive masses never became purposeful contours | Refine silhouette and connections before texture |
| A profile face reads as a ball with dots | Circle head; eye, mouth, ear placed on the circle | One contour with brow, nose, lips, chin, and jaw; eye just below the head's middle and set back from the profile; ear behind the jaw hinge; features never cross the cheek |
| Head floats above the body | Neck stops short of the head, or starts at the chin | Run the neck from the collar into the nape, under the head, long enough for any head motion |
| Feet look stuck on like blobs | The ankle was pinned to the contact point (pedal, floor, rung) | Pin the contact part (ball of the foot, palm) and solve the limb to the offset joint; let the foot pitch with the action; draw the shoe over the shin end |
| Shaded sphere looks like a flat button | Radial gradient centred on the shape, so a dark ring circles it | Move the gradient centre and focus toward the light, r ≈ 75–80 % ([form-and-light.md](form-and-light.md#one-light-five-values)) |
| Shaded objects look pasted together | Each object lit from a different direction | Choose one light; rederive every highlight, terminator, and cast shadow from it |
| Object floats | No cast or contact shadow | Add a cast shadow away from the light, darkest at the contact |
| Shadows look dirty | Shading with black or neutral grey | Use a deeper, cooler (or warmer) version of the local colour |
| Gloss reads as plastic or satin | Soft blends only, highlight blurred | Hard-edged specular, darkest dark against brightest light, reflected horizon for chrome |
| A limb toward the viewer looks short, not near | Outline only, no overlap or ellipses | Enlarge the near end, overlap the far forms, add cross-contour ellipses |
| Pattern looks like a sticker | Flat `<pattern>` over folds | Bend and compress pattern pieces with the folds |
| Pale stripes across a shaded limb | Shading polygon cut where the shadow changes sides; blur exposes the cuts | One continuous band per side ([form-and-light.md](form-and-light.md#shading-a-tube-from-the-light-vector)) |
| Flat cap at a shoulder, ring at a wrist | Limb tube starts exactly at the joint | Start it inside the parent with a rounded start and no contour there |
| Bent elbow or knee looks like a rubber hose | Width profile only; no bony landmarks | Olecranon, patella box, malleoli in the bone frame with a small blend radius ([joints-and-faces.md](joints-and-faces.md#joints-landmarks-that-must-survive-the-bend)) |
| Both contours of a limb mirror each other | No straight-against-curve rhythm | Alternate: curved outer thigh against a straight inner, straight shin against a curved calf |
| Face falls apart when the head turns | Features drawn flat on a 2D oval | Loomis ball in a rotated frame; features projected onto the surface and depth-tested |
| Garment shows blotches over the bust and waist | Fabric follows every hollow of the body | Model the garment as an inflated, smoothly blended shell |
| Kink at curve join | Misaligned handles | Align tangents; inspect curvature and handle lengths |
| Wobbly contour | Excess anchors or noisy trace | Simplify with a controlled tolerance and compare silhouette |
| Shapes almost touch | Accidental tangent | Add a deliberate gap or overlap |
| Fill appears under an open curve | Implicit closing fill | Set fill to none for line work |
| Tiny icon looks muddy | Insufficient negative space or too much detail | Enlarge gaps; create a simpler small variant |
| Shadow clipped | Filter region too small | Expand bounds and rerender |
| White patch on transparency | Background-colored fake cutout | Use proper boolean geometry, clip, or mask |
| Mask behaves backward | Alpha/luminance confusion | Declare mask semantics and inspect opaque/transparent areas |
| Diagram arrows cross labels | Geometry generated before text sizing | Measure nodes, relayout, reroute and inspect |
| Text differs across computers | Missing or substituted font | Bundle/outline if permitted, or design for a verified fallback |
| Colors change in a web page | CSS inheritance, collision, or currentColor assumptions | Inspect actual embedding; scope styling and IDs |
| Wordmark vanishes on a dark page | Transparent logo drawn for one background only | Preview on light and dark; ship a variant per background or a tested dark rule ([effects.md](effects.md#contrast-and-dark-backgrounds)) |
| Animation ends slightly off the logo | Motion-only property (clip, dash) kept at rest by `fill-mode: both` | Keep it in keyframes with `backwards` fill ([motion.md](motion.md#implementation-rules-measured)) |
| Two inline SVG copies break | Duplicate definition IDs | Prefix every instance and update all references |
| Optimized art loses behavior | Removed IDs, groups, metadata, or selectors | Keep master; disable destructive transforms and retest |
| Chart trend looks wrong | Wrong domain/order or decorative interpolation | Recompute from source data using a faithful mapping |
| Empty animation preview | Hidden initial state or static renderer | Provide visible static state and browser-test motion |

## Meaningful automated checks

Use automated checks for concrete failure classes: invalid roots, broken
references, duplicate IDs, missing required labels, wrong edge counts, numeric
data mismatch, nonfinite values, and accidental raster dependencies.

`audit_svg.py` covers structure only. It does not perform computed-style
evaluation, validate all CSS/SMIL references, calculate collisions, recognize
objects, or certify sanitization.

`path_audit.py` covers contour geometry: malformed path data (as an error),
near-kinks (joins turning more than 3° but less than 20° where a curve is
involved), pixel staircases, faceted polylines standing in for curves, tiny
segments, and handles much longer than their chords. `--svg-out` draws every
segment, its handles, and the findings circled. It measures local coordinates and
ignores stroke outlines; a deliberate shallow corner is reported as a near-kink,
and a data line chart is legitimately "faceted". Treat findings as places to look.

Use a real XML parser rather than regex as the document parser. Small regex checks
are useful for particular attributes but not complete SVG correctness. Use
appropriate sanitization and isolation for untrusted active SVG in an application;
this authoring skill is not a replacement for that application boundary.

Compare optimized and original renders at matching sizes and backgrounds. Exact
pixel equality is useful for a conservative cleanup with the same renderer.
Across renderers, antialiasing and fonts can legitimately differ; inspect the
differences instead of using an unexplained universal pixel threshold.

For bounds, don't assume a local geometry rectangle covers the painted result:
strokes, joins, markers, filters, clipping, and transforms need context. A nonempty
alpha bounding box detects emptiness, not good composition. A high path count can
be justified. File size is a delivery constraint, not an aesthetic measure.

## Reference fits

For a trace, a reconstruction, or a raster logo turned vector, climb a complexity
ladder and stop at the first rung that explains the source:

1. primitives (circles, rects, lines, arcs) and transforms;
2. a few primitives combined by boolean geometry, clips, or masks;
3. few-curve paths for swooshes, leaves, shields, and letter-like marks;
4. smoothed outlines with extra anchors only where the source really turns;
5. trace-derived paths, as a measurement aid to refit, never as final art.

Compare each iteration with `compare_reference.mjs art.svg source.png review/fit-NN`
and inspect the overlay (red: the vector misses it, cyan: the vector adds it).
The report's centroid offset and size ratio separate "shifted" and "scaled" from
"wrong shape". There is **no IoU pass threshold**: a smooth contour with slightly
lower IoU beats a stair-stepped trace with higher IoU. Run `path_audit.py` on the
candidate; staircases, faceted curves, and near-kinks fail a smooth source even
at high IoU.

Budget about ten geometry iterations. Stop at the first accepted fit, or ship the
best candidate ranked by: smoothness, no structural mismatch (center, endpoints,
width profile, negative space), IoU and residuals, fewest audit findings, overlay
verdict, lowest complexity. Record why a lower-IoU candidate won, and keep the
fitting script and parameters so the work can resume.

## Review with the user

Before handing over finished artwork, run a review round with the user. The
page is one screen: the drawing on a canvas with a light, dark, or transparent
background; a small toolbar (Comment, Draw, Arrow, color, Undo; keys C, D, A);
one timeline that plays the motion, or the construction for a static drawing;
and a Notes panel with **Send to agent** and **Approve**. Checks and target sizes
open on demand. On the motion timeline every note keeps its frame time and shows
as a marker on the timeline.

```bash
node scripts/review_server.mjs art.svg [--css motion.css] [--open]   # keep running; prints {"event":"ready","url":…}
node scripts/review_server.mjs --wait art.svg [--timeout 1800]      # blocks until the next Send/Approve
```

Run the server in the background (Claude Code: a background command; other
agents: a second terminal or `&`) and give the user the URL. Run `--wait` after
each change; it prints the round's `feedback.json`:

- `summary`: one line per comment and mark, ready to act on;
- `comments[]`: text, `x`/`y` in viewBox units, `t` (ms on the motion timeline,
  `null` on a static stage), and `target` — `label` as `path_audit.py` names it,
  a CSS `selector`, ancestor IDs, computed `fill`/`stroke`, `bbox`, and the
  elements `below` the click;
- `markup.items[]`: kind (`pen` or `arrow`), color, bbox, `t`; `markup.svg` is the raw layer;
- `checks`: the structural, geometry, contrast, and motion findings, re-run on the
  file when the round is saved; `summary` ends with the open ones;
- `files.annotatedPng` and `files.frames[]`: look at these images; each frame is
  the animation at a commented time with that frame's pins and marks drawn in.

Edit the SVG; the open page reloads itself and the next Send becomes the next
round. Stop when `status` is `approved`. Rounds are kept in
`<svg dir>/.svg-review/<name>/round-NN/` (change with `--out`; keep it out of
version control). The server listens on 127.0.0.1 only and requires the token in
its URL.

Without a shell that can keep a server running, build the static page with
`preview_html.mjs`; its Send downloads `<name>.review.json` and copies it to the
clipboard, so ask the user to hand the file or its text back. The reveal is a
construction preview, not the delivered animation.

## Verification record

Use a short record with:

```text
Output: reading.svg
Type: flat illustration / native vectors / standalone static file
Structural check: implemented audit rules pass
Visual review: 180, 360, 720 px; light background; key contour crop
Renderer: sharp/librsvg, recorded versions
Fixed: page overlap, lamp alignment
Not checked: animation (not present); print-editor round-trip
Remaining issue: none affecting the requested static web use
```

Only record checks actually performed. Optional unperformed checks do not need
to become blocking gates when they are irrelevant to the request.
