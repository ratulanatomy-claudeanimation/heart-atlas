# Form, light, and material

## Contents

- When to read this
- Build from simple solids
- Figures: gesture, units, balance
- Cross-contours and foreshortening
- Perspective and depth
- One light, five values
- Shading a tube from the light vector
- Joins, clothing, and draw order
- Colour temperature and palette
- Materials are contrast decisions
- Line weight
- Value and shadow-shape checks

Traditional construction drawing, translated into SVG geometry. Use it for
illustration, characters, still life, and any object that must look solid rather
than flat. Icons, diagrams, and charts rarely need it. The recipes below were
rendered in Chromium, librsvg (sharp), and resvg; the three matched within 0.01 %
of pixels.

## When to read this

Read it in the **Composition** and **Structure** passes when the subject has volume
(a figure, an animal, a head, fruit, a shoe, a gem) and in the **Style** pass before
shading. Read [effects.md](effects.md) for filters and textures; this file decides
*where* light and shadow go, effects.md decides *how* to render a texture.

## Build from simple solids

Every volume starts as a sphere, egg, cylinder, box, cone, or wedge. Draw that solid
in a `construction` group first; detail is placed on it, never instead of it.

| Subject | Underlying solids and guides |
| --- | --- |
| Head | Sphere or egg; a vertical centre line and a horizontal eye line, both curved around the form to show tilt and turn |
| Eye | A sphere in the socket; the lids wrap around it. The upper lid is the dominant arc and cuts across the top of the iris; the lower lid is flatter |
| Neck | A slanted cylinder joining the back of the skull, lower than the chin; the trapezius slopes from it to the shoulders like a tent |
| Torso | Ribcage egg, short waist cylinder, pelvis box; tilt ribcage and pelvis in opposite directions |
| Limbs | Tapered cylinders with a ball at each joint (shoulder, elbow, wrist, hip, knee, ankle) |
| Hand | A palm block plus five fingers as three-segment tubes; the wrist continues the forearm |
| Foot, shoe | A long wedge (sole) and a heel; the toe cap and upper sit on top |
| Fruit, vegetables | Sphere (grape, pumpkin), egg (pear), cone (calla), cylinder chain (banana); ribs and lobes follow the solid |
| Clouds | Stacked spheres lit as spheres |
| Gem | Facet polygons inside one simple silhouette |

Keep the construction group in the source (`display="none"` or about 0.15 opacity
in the delivery copy). It is the fastest way to locate a proportion error later.

## Figures: gesture, units, balance

1. **Line of action first.** One cubic Bézier through head, spine, and the
   supporting leg sets the energy. Head, ribcage, and pelvis hang on it.
2. **Measure in head units.** Store the head height `H` and derive landmarks from
   it. Realistic adults are about 7–8 `H`; fashion figures 9–10 `H` (shoulders at
   2, waist 3, hips 4, knees 7, ankles 10). Legs are about half the height.
3. **Contrapposto.** Tilt the shoulder line and the hip line in opposite
   directions; two level lines look stiff.
4. **Balance.** A vertical from the pit of the neck lands over the supporting foot
   or between the feet. Check it on the rendered pose, not only in the plan.
5. **Same skeleton, many poses.** Rotations and alternate poses keep joint
   heights and limb lengths; only the view or the angles change.
6. **Thumbnail first** for action poses: a small silhouette proves the pose reads
   before the full-size drawing is built.

## Cross-contours and foreshortening

Cross-contours are rings that wrap a form and show which way its surface turns.
They are the most effective single cue for a limb pointing at the viewer.

- A circular cross-section seen at angle θ to the line of sight is an ellipse with
  `rx = r` and `ry = r·cos θ`: almost a circle when the axis points at the viewer,
  almost a line when the axis lies in the picture plane.
- Rings sit closer together where the form recedes and farther apart where it
  faces the viewer. The near end cap is a visible ellipse; the far one is hidden.
- Shading strokes, hatching, stripes, and printed patterns follow the rings.
  A flat `<pattern>` over a curved or folded surface reads as a sticker; compress
  and bend pattern pieces into folds instead.
- Foreshortened parts overlap: the near form cuts across the far one. Trust the
  overlap even when the proportions look wrong.

```js
// Rings for a cylinder from the near end (t = 0) to the far end (t = 1).
function rings(x0, y0, len, rNear, rFar, n) {
  return Array.from({ length: n + 1 }, (_, k) => {
    const t = k / n;
    const y = y0 + len * (1 - (1 - t) ** 1.6);       // spacing tightens with distance
    const r = rNear + (rFar - rNear) * t;            // near parts are larger
    const theta = (70 - 45 * t) * Math.PI / 180;     // near end faces the viewer more
    return { y, r, ry: r * Math.cos(theta) };        // front arc: `A r ry 0 0 0`
  });
}
```

## Perspective and depth

- Give vanishing points explicit coordinates. **Every set of parallel edges goes
  to one vanishing point.** Draw hidden box edges in the construction group.
- Put a difficult figure inside a perspective box. A limb that pokes out of the box
  in an odd direction means the pose does not work in 3D yet.
- Lens: vanishing points close together read as a wide-angle lens (steep, near
  parts dominate); far apart, as a long lens (calm, proportions preserved).
  Choose before drawing.
- High viewpoint: heads large, feet small. Low viewpoint: the reverse.
- Fisheye: a curved grid around a centre; a line bends more the farther it is from
  the centre.
- Use at least three depth cues together: size, overlap, line weight, and
  value or temperature contrast (near is larger, in front, heavier, more contrasted).

## One light, five values

Choose one light direction before any shading and derive every highlight,
gradient focus, and cast shadow from it. Mixed light directions are the most
common reason a shaded SVG looks pasted together.

Each lit form has five value zones: **light, halftone, core shadow, reflected
light, cast shadow**, with a darker contact (occlusion) shadow where the form
touches the ground.

```xml
<!-- Light from the upper left. Move both the centre (cx, cy) and the focus (fx, fy)
     toward the light and make r larger than 50 % so the lit rim stays light and the
     terminator falls on the far side. A centred radial gradient puts a dark ring
     all round the circle and reads as a flat button. -->
<radialGradient id="fl-form" cx="36%" cy="34%" r="78%" fx="30%" fy="28%">
  <stop offset="0"    stop-color="#f7ead8"/> <!-- light -->
  <stop offset="0.30" stop-color="#d9b48f"/> <!-- halftone -->
  <stop offset="0.62" stop-color="#5b4a63"/> <!-- core shadow, cool -->
  <stop offset="0.74" stop-color="#7a6a80"/> <!-- reflected light -->
  <stop offset="0.80" stop-color="#4e4058"/>
</radialGradient>
<radialGradient id="fl-cast" cx="50%" cy="50%" r="50%">
  <stop offset="0" stop-color="#3b3442" stop-opacity=".5"/>
  <stop offset="1" stop-color="#3b3442" stop-opacity="0"/>
</radialGradient>
<filter id="fl-soft" x="-20%" y="-50%" width="140%" height="200%">
  <feGaussianBlur stdDeviation="1.2"/>
</filter>
<!-- cast shadow away from the light, then the contact shadow, then the form -->
<ellipse cx="115" cy="175" rx="63" ry="11" fill="url(#fl-cast)"/>
<ellipse cx="93" cy="175" rx="30" ry="4.4" fill="#2a2430" opacity=".55" filter="url(#fl-soft)"/>
<circle cx="90" cy="120" r="55" fill="url(#fl-form)"/>
```

For a cylinder, use the same five stops in a `linearGradient` across its width.
Ground every object and figure with a cast shadow that is darkest at the contact.

## Shading a tube from the light vector

Limbs, necks, torsos, fingers, and fruit are tubes: two edge polylines sampled at the
same count. Shade them from a 3D light instead of choosing a shadow side per part.

For a cross-section with in-plane normal `n` (pointing to edge A) and the light
`L = (Lx, Ly, Lz)`, with `z` toward the viewer, the surface angle `α` runs from −90°
(edge B) to +90° (edge A) and its brightness is `(n·L) sin α + Lz cos α`:

- brightest at `α₀ = atan2(n·L, Lz)`;
- terminator at `α₀ − 90°` (shadow on edge B) when `α₀ ≥ 0`, else at `α₀ + 90°`
  (shadow on edge A);
- the point at angle `α` lies at `centre + sin α · halfWidth` toward that edge.

Draw five bands between those angles, each blurred and clipped to the tube outline:
light (`α₀ ± 55°`), the saturated transition (22° on the lit side of the terminator),
the shadow shape (terminator to the shadow edge), the core (4–34° past the
terminator; the edge keeps the lighter reflected value), and an optional specular
(`α₀ ± 9°`). The shadow width follows from the geometry: a limb that runs along the
light's direction gets a thin shadow, one across it a wide one.

**Build one continuous band per side.** Where `n·L` changes sign the shadow moves
to the other edge. Cutting the band into runs there leaves cut ends, and the blur
turns every cut into a pale stripe across the limb. Instead, give each side its own
polygon that collapses onto its edge wherever the shadow is on the other side.

**Line weight from the same frame.** A thin band from 80° to 90° on the shadow side
is a contour that tapers by itself; add a hairline outline for the lit side.

Keep the sample count low (a limb needs about 20 cross-sections), drop points closer
than a few pixels before smoothing, write Bézier controls at 0.01 precision, cap
Catmull-Rom handles at about 0.4 of the chord, and make a clean corner where a band
doubles back. Otherwise `path_audit.py` reports hundreds of near-kinks and tiny
segments, and some of them are visible in the outline.

## Joins, clothing, and draw order

- **Bury joins.** Start an arm inside the torso and a hand inside the forearm with a
  rounded start (width 0 rising to full over a few percent of the length) and draw
  no contour along the buried part. A tube that starts at the joint shows a flat cap
  at the shoulder and a ring at the wrist.
- **One tube for neck and torso.** A separate neck under the torso's top edge leaves
  a line across the neck.
- **Clothing is a clip, not a second drawing.** Shade the body once in skin and once
  in the garment palette, then clip the garment copy to a region whose neckline and
  hem are cross-contours (below eye level they bow downward). Leggings end in a
  curved clip at the ankle, not at the tube's flat end.
- **Depth decides draw order.** A knee bent toward the viewer is in front; draw that
  leg after the standing one. Its bones are foreshortened in the picture plane, so
  solve its IK with shorter 2D lengths; full lengths swing the knee sideways across
  the other leg.
- **The head needs planes, not only a gradient.** Add the side plane past the temple
  and cheekbone on the shadow side, light eye-socket shading, a small shadow under
  the lower lip, and the cast shadow of the jaw on the neck.

Tubes stop working at bent joints and turned heads; for those, build the figure in 3D
as in [joints-and-faces.md](joints-and-faces.md).

Light placement changes mood without changing structure: side light splits a face,
top light darkens the eye sockets, light from below throws shadows upward, rim
light from both sides leaves a bright central band, and flat frontal light leaves
only subtle tone changes.

## Colour temperature and palette

- Choose a limited palette per object before drawing: 4–7 values from light to
  dark. Pick one harmony (monochromatic, analogous, complementary, triadic,
  tetradic) and let one colour dominate.
- **Warm light, cool shadow** (or the reverse). Do not shade with black or neutral
  grey; the darkest accents are deep saturated colours (brown, deep red, navy, violet).
- The transition from light to shadow is the most saturated band. On skin it is
  red-pink; a backlit edge of a finger glows orange-yellow.
- Warm advances, cool recedes: cooler colour toward the centre or the back of a
  form, warmer on near and lit parts.
- A small complementary accent in a reflection (green or orange in a violet gem)
  makes the colour vibrate. Cast shadows may carry the object's colour (gems, glass).

## Materials are contrast decisions

The same sphere becomes a different material through edge sharpness and local
contrast, not through more detail.

| Material | Decision |
| --- | --- |
| Matte (stone, skin, cloth) | Soft gradients, moderate contrast, a soft blurred highlight; texture may break the edge slightly |
| Chrome, polished metal | Reflect the environment: light sky gradient above a sharp horizon, dark ground below; the darkest dark directly against the brightest light; one hard-edged specular |
| Satin, metallic fabric | Gradient inside every fold from dark to light; long reflection bands that follow the form; sharp contrast only on the ridges |
| Iridescent, holographic | Hue shifts from fold to fold (teal, violet, pink); deep navy or violet in creases; white on the sharpest ridges |
| Glass | Mostly the background showing through; a dark rim; bright hard highlights; distorted shapes inside; a bright caustic spot inside the cast shadow |
| Foil | Flat base, darker puffed edges, crimp marks along the seam, pastel reflection patches, crisp white highlights |
| Gem, crystal | Each facet one tone; dark-to-light along the stone; white along facet edges; a tinted, glowing cast shadow |
| Hair, fur | Short strokes along the growth direction, frayed silhouette, denser on the shadow side |

```xml
<!-- Chrome: the ball reflects a sky above a sharp horizon and a dark ground below. -->
<clipPath id="fl-ball"><circle cx="510" cy="120" r="45"/></clipPath>
<linearGradient id="fl-sky" x1="0" x2="0" y1="0" y2="1">
  <stop offset="0" stop-color="#5f6f82"/><stop offset="1" stop-color="#e8eef5"/>
</linearGradient>
<linearGradient id="fl-ground" x1="0" x2="0" y1="0" y2="1">
  <stop offset="0.5" stop-color="#0d1117"/><stop offset="1" stop-color="#3a3530"/>
</linearGradient>
<radialGradient id="fl-rim" cx="50%" cy="50%" r="50%">
  <stop offset="0.82" stop-color="#000" stop-opacity="0"/>
  <stop offset="1" stop-color="#000" stop-opacity=".55"/>
</radialGradient>
<g clip-path="url(#fl-ball)">
  <rect x="465" y="75" width="90" height="90" fill="url(#fl-ground)"/>
  <path d="M465 75 H555 V122 Q510 136 465 122 Z" fill="url(#fl-sky)"/>
</g>
<circle cx="510" cy="120" r="45" fill="url(#fl-rim)"/>
<ellipse cx="492" cy="96" rx="9" ry="5.5" fill="#fff" transform="rotate(-35 492 96)"/>
```

Soft blending alone reads as satin or matte. Shine needs sharp edges and extreme
local contrast; keep hard highlights as separate unblurred shapes.

## Line weight

- Heavier lines on near edges, at overlaps, and on the shadow side; lighter lines
  on far and lit edges. Uniform `stroke-width` across a drawing looks mechanical.
- Vary the width per contour, or draw the contour as a filled tapered outline
  (offset a centre line by a width that changes along its length), or use
  Perfect Freehand ([scripting-guide.md](scripting-guide.md#d-perfect-freehand-variable-width-ink)).
- Round caps and joins for drawn line work; butt caps only for data marks.

## Value and shadow-shape checks

Run these on the rendered PNG during the Review pass, in addition to the target-size
sheet from `render_review.mjs`.

```js
import sharp from 'sharp';
await sharp('review/drawing-256.png').grayscale().toFile('review/value.png');
await sharp('review/drawing-256.png').grayscale().threshold(110).toFile('review/two-tone.png');
await sharp('review/drawing-256.png').resize(64).toFile('review/thumb.png');
```

| Check | Pass when |
| --- | --- |
| Value (greyscale) | Light, halftone, core shadow, and cast shadow are distinct; colour was not doing the work of value |
| Two-tone shadow shapes | The black shapes alone describe the forms and agree with one light direction. One global threshold turns dark materials (chrome, dark leggings) mostly black and light skin mostly white; threshold each material at its own halftone value instead |
| Thumbnail | The silhouette and pose read at 64 px |
| Light consistency | Every highlight, terminator, and cast shadow agrees with the chosen light |
| Construction overlay | With the construction group shown, landmarks sit on head-unit lines and on the line of action |
| Depth | Near forms are larger, overlap far ones, and carry heavier lines |

Fix the earliest failing stage first (construction, then shadow shapes, then colour,
then detail). Detail does not repair a wrong form.
