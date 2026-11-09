# Prompting agents to draw better SVG

## Contents

- The useful prompt structure
- General creation prompt
- Type-specific prompts
- Diagnose and repair an existing SVG
- Visual critique protocol
- Stop conditions

## The useful prompt structure

Describe the visible outcome, its use, and the evidence needed for acceptance.
“Beautiful, premium, detailed SVG” leaves proportions, construction, scale, and
delivery unresolved. More adjectives do not supply missing geometry.

Use this sequence:

**Purpose → subject → composition → geometry/style → constraints → output → review.**

| Weak request | Actionable replacement |
| --- | --- |
| Make it professional | Use one dominant silhouette, consistent curves, deliberate gaps, and inspect at the actual display size |
| Make it detailed | Preserve these three identifying details; omit details that disappear at 32 px |
| Make it hand-drawn | Use a clean underlying contour with restrained seeded stroke variation and sparse hatching |
| Make it realistic | Fix pose, proportion, perspective, overlap, and one light direction before surface detail |
| Make it look 3D | Build each object from a simple solid, wrap it with cross-contours, shade light, halftone, core shadow, reflected light, and a cast shadow from one light |
| Make it shiny | Put the darkest dark against the brightest highlight with hard edges; keep matte parts soft |
| Optimize it | Preserve appearance and required editing/animation hooks; report the actual size change |
| Match the reference | Preserve these landmarks and proportions; state which features cannot be recovered from the reference |

Leave artistic freedom where it helps. Avoid specifying every control point unless
it is a geometric requirement. A good brief constrains recognizable outcomes and
technical compatibility without dictating a clumsy construction.

## General creation prompt

```text
Use @draw-better-svg to create an editable SVG of [subject] for [purpose].

Display context: [standalone file / inline web / external image / editor].
Canvas and actual display sizes: [ratio, viewBox if fixed, sizes in pixels].
Visual language: [flat / outline / organic line art / geometric / other].
Composition: [focal object, placement, pose/viewpoint, reserved negative space].
Must preserve: [recognizable features, exact text, supplied data/reference].
Palette/background: [colors and transparent or opaque].
Construction constraints: [native vectors, text strategy, editability, motion].

First classify the SVG task and state a short drawing plan. Build major shapes
before detail. Choose libraries only where they solve a real geometry or layout
problem. Render the result at the stated sizes and inspect it. Repair visible
problems, then deliver the SVG, useful source script, and a preview. State which
checks were actually completed and any material limitation.
```

If an agent uses a different invocation syntax, use its local skill syntax or ask
it to read the skill's SKILL.md. The substantive brief is portable.

## Type-specific prompts

### 1. Consistent UI icon family

```text
Create three original outline icons: book, bookmark, and reading lamp.
Use a 24×24 viewBox and a coherent 1.75-unit stroke with round caps and joins.
They must read at 20 and 24 CSS pixels. Use currentColor for inline HTML.
Keep generous internal gaps and match optical weight, not just bounding boxes.
Use native SVG paths/primitives, no gradients, raster images, or decorative dots.
Deliver separate named SVGs and inspect them together at their actual sizes.
```

The stroke is a starting constraint, not a guarantee of optical equality. Ask for
a micro variant if the design cannot retain its essential gaps at a smaller size.

### 2. Brand mark with genuine negative space

```text
Create a geometric mark combining a crescent and a leaf, using one coherent
silhouette. It must work in one color at 24 px and at 256 px on both light and
dark backgrounds. Use real transparent cutouts, not background-colored patches.
Show two distinct silhouette concepts before refining one. Keep editable
geometry and create a monochrome SVG delivery version. Review the counters and
optical centering at small size. Do not add a wordmark or generic shine effects.
```

This prompt requests alternatives explicitly; do not create multiple concepts by
default when the user asked for a straightforward edit. Recognition and brand
appropriateness remain human judgments, not automatic logo certification.

### 3. Editorial illustration with an actual composition

```text
Draw an open book under a desk lamp, with a small vase on the right, as an
editable 3:2 SVG illustration. The book is the focal object; its two pages and
center fold must be clear at 180 px width. Use a restrained warm-paper, dark-teal,
and ochre palette. Keep the upper-right area quiet. Use named groups for room,
lamp, book, and plant. Establish the lamp's geometry and light direction before
adding page details. Render at 180, 360, and 720 px and fix unclear overlaps.
```

### 4. Organic character with believable structure

```text
Create a side-view SVG illustration of a fox curled around its tail.
Build a readable sleeping silhouette with clear ear, muzzle, shoulder, hip,
and tail attachment. Use flowing Bézier contours and a limited three-color
palette, without a uniform thick cartoon outline. The tail must overlap the
body plausibly and the muzzle must remain distinguishable at 160 px.
Start from gesture and major masses, inspect the silhouette, then add the few
features needed for recognition. Keep the head, body, tail, and near leg grouped.
Render at 160 and 640 px; inspect joins and anatomy before delivery.
```

Do not demand a fixed maximum path count if it forces worse anatomy. Ask for a
purposeful contour count and meaningful groups instead.

### 5. Botanical sketch without indiscriminate noise

```text
Create a 400×600 SVG ink drawing of a sprig with five narrow leaves.
Use a curved stem, varied leaf angles, and thinner veins than outlines.
Apply restrained seeded Rough.js variation after the clean contours are built;
keep the leaf tips sharp and leave ample paper between hatching lines.
Use transparent background and one dark ink color. Preserve the clean geometry
and random seeds in the generator. Inspect at the final 200 px display width.
```

### 6. Accurate branching diagram

```text
Create an SVG of this workflow: intake branches into validation and enrichment;
both feed review; review either publishes or returns to intake.
Preserve all six relationships, including the return edge. Use measured text
boxes and a layout engine where useful. Route edges outside unrelated nodes,
keep arrowheads clear, and label the review outcomes. Use readable 16 px text
at the intended 900 px display width. Deliver editable labels and inspect all
connections visually. Do not silently remove edges to simplify the drawing.
```

The six relationships are intake→validation, intake→enrichment,
validation→review, enrichment→review, review→publish, and review→intake.
Use exact node and edge counts for such prompts; they are testable requirements.

### 7. Quantitative chart

```text
Create an SVG bar chart using exactly these illustrative values:
A=12, B=18, C=9, D=24. Label them as illustrative data.
Use a zero baseline, uniform category spacing, and a y-axis labeled 'Count'.
Compute bars and ticks from one scale. Keep labels live and readable at 640 px.
Use one neutral color and emphasize D with a single accent. Include the values
in an accessible description. Check the bar heights against the data and inspect
the rendered chart for clipping and label collisions.
```

### 8. Map with defensible geography

```text
Using the supplied GeoJSON, draw a labeled SVG map of [region] for a 1000 px
wide document. Choose and state the projection. Preserve island and boundary
topology at this scale. Keep the input data separate from projected paths.
Do not invent missing geographic data or place labels by longitude/latitude
without projection. Inspect dense label regions and provide source attribution.
```

### 9. Repeat pattern

```text
Create a seamless two-color botanical SVG pattern with an explicit 80-unit tile.
Use two related leaf shapes and deliberately varied orientation. The pattern
must have consistent density at all tile boundaries. Build repeated geometry
with pattern or symbol definitions; keep IDs unique. Preview a 5×5 tile area
at actual scale and inspect seams. Deliver the tile and a filled rectangle demo.
```

### 10. Motion with a usable static state

```text
Create an inline SVG reading-lamp illustration. Animate the light appearing
over 600 ms after an explicit user action, then leave it on. Keep the illustration
legible before and after the animation. Use stable named groups and an explicit
transform origin. Respect prefers-reduced-motion by switching directly to the
end state. Test the actual browser embedding, keyboard-triggered control, start
and end states, and two instances in one page. Include a static SVG export.
```

### 11. Technical/isometric object

```text
Draw an isometric SVG cutaway of a simple desktop computer case.
Use one projection derived from shared 3D corner coordinates. The motherboard,
power supply, and fan must occupy distinct coherent planes; use the supplied
component arrangement rather than inventing technical specifications.
Separate front, side, and top surfaces into editable groups. Use one light
direction and label only the requested components. Check aligned edges and
occlusion at 960 px, then inspect readability at 480 px.
```

### 12. Hungarian lettering

```text
Create an SVG wordmark containing exactly 'Őrzött történetek'.
Use the supplied licensed font. Keep a live-text master and, if supported by
the font license and available tooling, an outlined delivery copy.
Check ő, ö, and é, optical spacing, and clipping at 240 and 960 px.
Preserve the original text in accessible metadata. Do not approximate missing
glyphs by removing their accents or drawing guessed replacements.
```

## Diagnose and repair an existing SVG

```text
Inspect the attached SVG before editing. Classify its subject, construction,
and intended delivery. Report the five highest-impact visible problems, with
locations and evidence from a rendered preview. Separate structural errors
from aesthetic judgments. Preserve the subject, palette, and named groups.

Repair the most important geometry and layout defects first. Keep an original
copy, then provide the revised SVG and before/after previews at the same scale.
Do not claim improvement solely from smaller file size or fewer paths.
```

For a narrow edit, name the invariant and the local change:

```text
Keep the fox's pose, palette, and overall bounds. Fix only the neck-to-shoulder
join: it currently has a visible kink at the upper-left contour. Adjust the
two adjoining handles, keep the ear shape unchanged, and compare at 160/640 px.
```

## Visual critique protocol

Ask the agent for observations in this format:

| Location | Visible defect | Likely cause | Specific change | Verification |
| --- | --- | --- | --- | --- |
| Inner book fold | Pages merge at 20 px | Gap is too narrow | Widen the fold opening | Inspect 20 px preview |
| Arrow at review node | Tip enters label | Endpoint and padding disagree | Move endpoint to node edge | Inspect node crop |
| Logo cutout | White rectangle on dark background | Opaque patch used as hole | Use boolean cutout or correct mask | Render on dark background |

Use descriptions that can be checked in the image. A scalar “quality 9/10”
without supporting defects, criteria, and target context is not useful evidence.

## Stop conditions

Finish when explicit constraints pass, required content is correct, the subject
reads at target size, major visible defects are resolved, and delivery behavior
has been checked in the available target. Do not keep adding optional decoration
after these conditions are met. If a missing font or browser prevents a check,
state that specific limitation rather than marking it passed.
