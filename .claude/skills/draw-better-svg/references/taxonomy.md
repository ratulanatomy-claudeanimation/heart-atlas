# Classify the SVG before drawing

## Contents

- Three classification axes
- Subject-specific workflows
- Inspect an existing file
- Complexity and renderer choices
- Choosing what to preserve

## Three classification axes

An SVG is an XML graphics document. “Icon SVG”, “illustration SVG”, and “animated
SVG” are use cases, not separate official file formats or SVG versions. Classify
all three axes before selecting tools.

| Axis | Questions | Example |
| --- | --- | --- |
| Meaning | What must the viewer recognize or understand? | A fox, quarterly revenue, a network connection |
| Construction | What is in the file? | Primitives, compound paths, live text, symbols, masks, filters, raster images |
| Delivery | Where must it work? | Standalone file, inline HTML, React component, external img, print editor, animation |

A botanical illustration can consist of native stroked paths, pressure outlines,
or traced polygons. All may look botanical, but editing and generation workflows
differ. A logo may be mostly typography. A diagram may use an illustration style
while still requiring exact connectivity.

## Subject-specific workflows

| Type | What makes it good | Build strategy | Typical failure | Review at |
| --- | --- | --- | --- | --- |
| UI icon / pictogram | Immediate recognition, clear gaps, consistent optical weight | Primitives and few paths on the target grid | Tiny detail, uneven strokes, blurry edges | 16, 20, 24, 32 px as relevant |
| Logo / brand mark | Distinct silhouette, intentional negative space, monochrome version | Geometric construction, boolean operations, optical correction | Complexity or a fake background-colored hole | Smallest brand use and large display |
| Flat editorial illustration | Readable focal object, balanced masses, clear overlaps | Named groups, flat blockout, custom contours | Unrelated shapes without a focal object | Thumbnail and final layout size |
| Organic character / animal | Gesture, proportions, believable attachment and overlap | Landmark skeleton, masses, few Bézier contours | Circle-and-stick anatomy, tangent collisions, ambiguous limbs | Silhouette thumbnail, full detail, key crops |
| Line art / botanical / sketch | Contour rhythm, controlled line hierarchy | Centerlines, fitted curves, optional seeded roughness | Uniform jitter, spiky joins, too many anchors | Actual size and enlarged joins |
| Technical diagram / flow | Correct connections, reading order, legible text | Node/port model, measured labels, ELK | Connectors through labels, wrong arrow endpoints | Reading size and compact overview |
| Chart / quantitative figure | Faithful values, scale, units, uncertainty, source | D3 or chart library; separate data | Invented data, decorative distortion, misleading axes | Publication size and label crops |
| Map / thematic geography | Suitable projection and topology | GeoJSON and D3 Geo; simplify at target scale | Arbitrary longitude/latitude x/y, lost islands | Overview and dense regions |
| Pattern / ornament | Rhythm, phase, seamless boundaries | Repeated symbols or pattern tiles | Tile seams or accidental density changes | Multi-tile repeat and target scale |
| Isometric / technical object | Consistent projection, aligned attachments | Compute 3D-to-2D coordinates and surface order | Mixed perspective, disconnected parts | Whole object and junctions |
| Lettering / wordmark | Correct glyphs, spacing, stable font delivery | Licensed font shaping; optional outlined copy | Missing accents, generic tracking, substitution | Small use and spacing review |
| Motion / interaction | Clear static design with purposeful state changes | Stable groups; browser-tested CSS/SMIL/JS ([motion.md](motion.md)) | Hidden start, broken transforms, poor reduced motion | Start/middle/end and actual host |
| Trace / hybrid | Honest fidelity target and manageable paths | Complexity ladder; refit traces ([reference fits](review-and-repair.md#reference-fits)) | Noisy polygons or bitmap wrapped in svg | Reference overlay and intended use |

These review sizes are examples, not universal thresholds. Do not silently alter
requested dimensions. A large illustration may need a simpler small variant.

## Inspect an existing file

Preserve the original. Parse namespace, viewBox, dimensions, element counts, IDs
and references. Inventory fonts, images, filters, gradients, masks, clips,
symbols, external links, CSS, and animation.

Run the bundled audit to collect structural evidence. Its feature labels describe
markup, not semantic understanding. A thousand paths might be a careful technical
map, an outlined paragraph, or a poor automatic trace. Render before deciding.

Inspect four views:

1. Full canvas: focal point, balance, margins, accidental cropping.
2. Target size: recognition, labels, internal gaps, contrast.
3. Close-ups: Bézier joins, overlaps, arrow tips, font glyphs.
4. Alternate background: holes, halos, white patches, theme assumptions.

Produce a diagnostic such as:

> Semantic type: logo. Construction: 14 paths, one mask, no raster image.
> Delivery: transparent standalone SVG. At 24 px the central counter closes;
> at 256 px the top join has a kink. Widen the counter and align the handles.

Do not claim that “14 paths” proves good editability. Named objects, grouping,
shape purpose, source parameters, and path complexity are stronger evidence.

## Complexity and renderer choices

Use primitives when they express the shape cleanly, and custom paths where the
contour carries identity. Avoid turning every circle into a long path or forcing
every organic contour into circles and rounded rectangles.

Choose a rendering authority for the deliverable and a second only when the
target warrants it. Static library rendering suits ordinary shapes and many
effects. Browser CSS, host fonts, interaction, and animation require browser
review. An SVG displayed as an image has different restrictions from inline SVG;
scripts and external resources cannot be assumed to work.

A static PNG proves a frame, not motion. An apparently empty image may contain
white artwork on a white viewer, a broken reference, or actually empty geometry.
Check both source and image.

## Choosing what to preserve

For generated art, keep data and named parameters. For editor art, keep meaningful
groups and an editable master. For type, keep original text and font provenance.
For animation, preserve stable selectors. For charts and maps, preserve data and
the relevant coordinate system.

Photorealism and dense textures often become impractically complex vectors. Offer
a deliberate simplified treatment or explicitly labeled hybrid if appropriate;
never quietly change the required format or call embedded pixels native vectors.
