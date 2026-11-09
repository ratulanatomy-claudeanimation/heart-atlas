# Effects, texture, and theming

## Contents

- Rules before any effect
- Shadows, glow, and bevel
- Texture
- Color grading
- Materials and atmosphere
- Glass
- Gradients that render the same everywhere
- Portability table
- Contrast and dark backgrounds

Every recipe here was rendered in Chromium, librsvg (sharp), and resvg and matched
across all three unless the portability table says otherwise. Recipes are adapted
from [upbrew-tech/svg-creator-skill](https://github.com/upbrew-tech/svg-creator-skill)
(Apache-2.0); several are repaired versions of published ones that failed. Evidence,
rejected recipes, and measurements:
[effects evaluation](https://github.com/arlinamid/draw-better-svg/blob/main/docs/effects-evaluation.md).

## Rules before any effect

- Effects come after geometry and composition pass review. They do not rescue a weak silhouette.
- **Clip textures to the shape.** A filter that blends noise with `SourceGraphic` fills
  the whole filter region; end with `<feComposite in2="SourceAlpha" operator="in"/>`.
- **Size the filter region** for blur and offsets (`x="-20%" y="-20%" width="140%" height="140%"`),
  and use `x="0" y="0" width="100%" height="100%"` for textures that must stop at the edge.
- `color-interpolation-filters` already defaults to `linearRGB`. Set `sRGB` only when you
  want sRGB math (textures multiplied into a flat fill look more predictable in sRGB).
- Decoration must not change data: round caps lengthen donut segments, gradients and
  shadows must not suggest a different value. Use butt caps and computed dash lengths.
- Render at the target sizes on every background the asset will meet; subtle textures
  vanish at small sizes and can be dropped from a small variant.

## Shadows, glow, and bevel

```xml
<filter id="fx-shadow" x="-20%" y="-20%" width="140%" height="140%">
  <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur"/>
  <feOffset in="blur" dx="3" dy="5" result="offset"/>
  <feFlood flood-color="#1e1b4b" flood-opacity="0.3"/>
  <feComposite in2="offset" operator="in" result="shadow"/>
  <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
```

| Variant | stdDeviation | dx, dy | Opacity |
| --- | --- | --- | --- |
| Drop | 4 | 3, 5 | 0.30 |
| Contact (tight, under objects) | 1.5 | 0, 1 | 0.40 |
| Cast (soft, projected) | 6 | 4, 8 | 0.20 |

A tinted flood (deep blue or purple) usually reads better than black. **Glow:** blur
`SourceGraphic` (stdDeviation 8, region ±30 %) and merge the blur under the source;
it only reads on dark backgrounds. **Inner shadow:** invert `SourceAlpha` with
`<feFuncA type="table" tableValues="1 0"/>`, blur, offset, keep it inside with
`operator="in"` against `SourceAlpha`, flood, merge on top of the source.

**Bevel** (replaces the published specular and convolve-emboss recipes, which washed
the shape out or had no visible effect):

```xml
<filter id="fx-bevel" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="bump"/>
  <feSpecularLighting in="bump" surfaceScale="4" specularConstant="0.7" specularExponent="18"
    lighting-color="#ffffff" result="spec"><feDistantLight azimuth="225" elevation="40"/></feSpecularLighting>
  <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>
  <feComposite in="SourceGraphic" in2="specIn" operator="arithmetic" k1="0" k2="1" k3="0.55" k4="0"/>
</filter>
```

Scale `stdDeviation` and `surfaceScale` with the object size; `k3` sets the highlight strength.

## Texture

One grain filter covers paper, grain, wood, and stone; only the noise and the
transfer range change. Transfer `slope`/`intercept` map noise 0–1 into a multiply
factor, so `intercept` near 1 means subtle.

```xml
<filter id="fx-grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="7" stitchTiles="stitch" result="noise"/>
  <feColorMatrix in="noise" type="saturate" values="0" result="mono"/>
  <feComponentTransfer in="mono" result="soft">
    <feFuncR type="linear" slope="0.35" intercept="0.72"/>
    <feFuncG type="linear" slope="0.35" intercept="0.72"/>
    <feFuncB type="linear" slope="0.35" intercept="0.72"/>
  </feComponentTransfer>
  <feBlend in="SourceGraphic" in2="soft" mode="multiply" result="tex"/>
  <feComposite in="tex" in2="SourceAlpha" operator="in"/>
</filter>
```

| Texture | baseFrequency | numOctaves | slope / intercept |
| --- | --- | --- | --- |
| Grain on an object | 0.8 | 3 | 0.35 / 0.72 |
| Paper on a whole canvas | 0.9 | 4 | 0.16 / 0.90 |
| Wood (directional) | `0.015 0.25` | 4 | 0.70 / 0.55 |
| Stone | 0.35 | 4 | 0.90 / 0.45 |

Frequency guide: 0.01–0.05 clouds and terrain, 0.05–0.2 organic (water, marble),
0.2–0.5 coarse grain, 0.5–0.9 fine grain. Two values stretch the noise directionally.
`fractalNoise` is smoother than `turbulence`. Fix `seed` for reproducible output.
Grain detail differs slightly between renderers (≈ 7 % of pixels); the character matches.

## Color grading

Wrap a `<feComponentTransfer>` around a group:

| Grade | Per-channel functions |
| --- | --- |
| Contrast | `linear slope="1.5" intercept="-0.15"` (R, G, B) |
| Warm | R `1.1 / 0.05`, G `0.95 / 0`, B `0.85 / -0.05` (slope / intercept) |
| Cool | R `0.85 / -0.05`, G `0.9 / 0`, B `1.15 / 0.05` |
| Lift midtones | `gamma amplitude="1" exponent="0.7"` |
| Posterize | `discrete tableValues="0 0.25 0.5 0.75 1"` (bands gradients on purpose) |
| Duotone | `feColorMatrix type="saturate" values="0"`, then R `table 0.1 0.9`, G `0 0.6`, B `0.3 0.95` |

All six matched across renderers within 1.4 % of pixels.

## Materials and atmosphere

- **Metal:** a vertical `linearGradient` with 6–7 alternating light/dark grey stops
  (steel) or warm golds (#fff7d1, #ffd700, #daa520, #b8860b, #8b6914); add thin
  near-white edge lines.
- **Vignette:** a full-canvas rect filled with a radial gradient from transparent
  black to ~0.3–0.45 opacity, `mix-blend-mode: multiply`. Start lower on light art.
- **Light rays:** a few thin triangles from one point, `opacity` ≈ 0.12,
  `mix-blend-mode: screen`, on dark scenes.
- **Fog:** a white rect at 0.25 opacity through a mask whose gradient fades both edges.
- **Clouds:** overlapping white ellipses in a group with `feGaussianBlur` 4.
- **Soft backgrounds ("mesh" workaround):** 3–5 full-canvas rects filled with radial
  gradients that fade to `stop-opacity="0"`, over a solid base.
- **Pattern tiles:** `patternUnits="userSpaceOnUse"`; `patternTransform="rotate(45)"`
  for diagonals.
- **Halo text:** `stroke` in the background color, `stroke-width` ≈ 15–20 % of the font
  size, `paint-order="stroke fill"`.

## Glass

SVG filters cannot read what is behind an element, so a blur filter on a panel only
blurs the panel. Frost the backdrop by blurring a clipped copy of it:

```xml
<clipPath id="panel"><rect x="70" y="50" width="180" height="140" rx="16"/></clipPath>
<filter id="frost" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="7"/></filter>
<!-- scene is <g id="art">…</g> -->
<g clip-path="url(#panel)">
  <use href="#art" filter="url(#frost)"/>
  <rect width="100%" height="100%" fill="#ffffff" fill-opacity="0.35"/>
</g>
<rect x="70.5" y="50.5" width="179" height="139" rx="16" fill="none" stroke="#ffffff" stroke-opacity="0.7"/>
```

For a clear glass object, stack a low-opacity tinted body, one angled white highlight
strip, a faint dark edge, and a faint reflected ellipse.

## Gradients that render the same everywhere

`color-interpolation="linearRGB"` on gradients is honored by Chromium and ignored by
librsvg and resvg (43 % of pixels differed). For the brighter linear-light blend in
every renderer, compute it into explicit stops:

```js
const lin = (c) => (c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const srgb = (c) => Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const stops = (a, b, n = 8) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n, c = rgb(a).map((v, k) => srgb(lin(v) * (1 - t) + lin(rgb(b)[k]) * t));
  return `<stop offset="${t.toFixed(3)}" stop-color="rgb(${c})"/>`;
}).join('');
```

## Portability table

| Feature | Chromium | librsvg | resvg | Use |
| --- | --- | --- | --- | --- |
| Filters above, `mix-blend-mode`, masks, patterns, `paint-order` | ✓ | ✓ | ✓ | Anywhere |
| `color-interpolation="linearRGB"` on gradients | ✓ | ignored | ignored | Bake stops instead |
| `vector-effect="non-scaling-stroke"` | ✓ | thinner | ignored | Browser-only |
| `var()` custom properties | ✓ | fallback value | black fill | Browser-only; `currentColor` + `color` works in all three |
| `pathLength` with dashes | ✓ | ignored | ignored | Browser-only; compute dash lengths for static files |
| `feDisplacementMap` distortion | reference | 6 % off | 22 % off | Review in the target renderer |
| `@media (prefers-color-scheme: dark)` inside the SVG | ✓ (follows the embedding `<img>`'s color scheme) | light rules only | not tested | Theme-switching sites |

## Contrast and dark backgrounds

A transparent logo or icon meets every background its host uses. `preview_html.mjs`
checks each painted color against the light and dark previews (text 4.5:1, graphics
3:1, a shape passes through its stronger paint) and shows the count beside each row.
For artwork with its own opaque background only text is checked, against that background.

Fixes, from most to least portable:

1. **A variant per background** (`logo.svg`, `logo-on-dark.svg`). Works in every renderer,
   editor, and embedding.
2. **`currentColor`** for inline SVG: the host sets `color` per theme. External `<img>`
   files do not inherit the page's `color`.
3. **An internal dark rule** such as
   `<style>@media (prefers-color-scheme: dark){#wordmark{fill:#f4f1ea}}</style>`.
   In Chromium it follows the embedding `<img>`'s used color scheme; static renderers
   draw the light rules. It follows the viewer's theme, not the actual background, so
   a dark header on a light-theme page still needs variant 1.
