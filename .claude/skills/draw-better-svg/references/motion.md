# Logo and SVG motion

## Contents

- Scope and deliverables
- Brief: personality to parameters
- Motion-ready structure
- Choreography
- Pattern library
- Character motion
- Implementation rules (measured)
- QA workflow and acceptance

The brief, personality presets, timeline shape, and pattern library are adapted
from [nolangz/pixel2motion](https://github.com/nolangz/pixel2motion) (MIT). The
rules marked *measured* were checked in Chromium for this skill; see
[the effects evaluation](https://github.com/arlinamid/draw-better-svg/blob/main/docs/effects-evaluation.md).

## Scope and deliverables

Motion is a delivery profile on top of a finished static drawing, never a way
to finish it. Verify the static SVG first (geometry, sizes, backgrounds); the
animation must land exactly on that file.

| File | Content |
| --- | --- |
| `logo.svg` | The verified static vector with stable part IDs; no motion required to look right |
| `motion.css` | The choreography, wrapped in `prefers-reduced-motion: no-preference` |
| `logo-motion.html` | `node scripts/preview_html.mjs logo.svg logo-motion.html --mode motion --css motion.css` |
| `motion/strip.png`, `capture.json` | `node scripts/capture_frames.mjs logo-motion.html motion` |
| Motion notes | Personality words, tokens, timeline table, patterns used, known limits |

Use CSS for most logo motion. Use SMIL only when the file must animate as an
`<img>` or CSS background and CSS is not an option; use JavaScript only for
measured pivots, live sequencing, or interaction the page controls.

## Brief: personality to parameters

Write three motion words before choosing numbers (for example "precise, calm,
confident") and a usage context. Derive every duration and easing from them.

| Usage | Duration band |
| --- | --- |
| Splash or intro | 1200–2000 ms |
| Header reveal | 300–800 ms |
| Hover or press | 150–300 ms, ease-out only |
| Loading loop | 1500–3000 ms cycle |
| Idle breathing | 3000–4000 ms cycle, amplitude ≤ 2 % |

Pick the closest preset, then adjust:

| Preset | Reveal | Enter easing | Settle easing | Overshoot | Squash |
| --- | --- | --- | --- | --- | --- |
| Playful | 900 ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` | `cubic-bezier(0.22, 1, 0.36, 1)` | 1.08 | up to 18 % |
| Elegant | 1600 ms | `cubic-bezier(0.4, 0, 0.6, 1)` | `cubic-bezier(0.16, 1, 0.3, 1)` | ≤ 1.02 | none |
| Professional | 700 ms | `cubic-bezier(0, 0, 0.2, 1)` | `cubic-bezier(0.4, 0, 0.2, 1)` | none | none |
| Energetic | 600 ms | `cubic-bezier(0.16, 1, 0.3, 1)` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 1.12 | up to 25 % |
| Calm | 1400 ms | `ease-in-out` | `cubic-bezier(0.4, 0, 0.6, 1)` | none | ≤ 4 % |
| Friendly | 850 ms | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | `cubic-bezier(0.22, 1, 0.36, 1)` | 1.04 | up to 8 % |

Read the mark for evidence: geometric forms suggest engineered motion, organic
curves flowing motion, rounded bright forms soft or playful motion. Words the
user states override visual inference. Check at the end: do three words describing
the finished animation match the brief?

## Motion-ready structure

- One element or `<g>` per moving part with a stable ID (`#mark`, `#dot`,
  `#wordmark`, `#letter-a`). Target IDs or classes, never `:nth-child`.
- Split paths along animation seams: parts that move separately are separate
  elements even when one compound path would render the same.
- A single `<text>` cannot cascade per letter; give staggered letters their own
  elements, or outline them when the font license allows.
- Parts that scale or rotate need `transform-box: fill-box; transform-origin: center`
  (or a deliberate pivot). Check that each part's bounding box makes that pivot sensible.
- Draw-on paths need their start point and direction to match the intended draw.
  Reverse the path data when they do not. `pathLength="1"` normalizes the dash math.
- Keep part-local coordinates simple; baked transforms fight choreography.

Trace-derived art with hundreds of anchors cannot be choreographed or morphed.
Refit it first (see [review-and-repair.md](review-and-repair.md#reference-fits)).

## Choreography

- **Timeline shape** anticipation : action : follow-through = 20 : 50 : 30 of the
  total by default. Draw-on reveals lean on the action (10 : 70 : 20); morphs hold
  the primitive longer (25 : 50 : 25). Record deviations.
- **Stagger** overlapping parts by 10–20 % of a part's own duration. Never start or
  stop all parts on the same frame. Heavier, larger parts move slower; order the
  cascade container → primary mark → letters → accents.
- **Budget** one reveal, at most one idle loop, at most one hover behavior. The
  reveal plays once per page load, not on every route change.
- **Loops** must be seamless (last keyframe equals the first). Stop or decay
  attention-grabbing loops after three to five cycles unless something is loading.
  Rotation loops are the one legitimate use of `linear`.
- **Hover** must return to the exact rest state; give `:focus-visible` the same behavior.
- Animate `transform`, `opacity`, `clip-path`, and `stroke-dashoffset`; use `filter`
  sparingly; never layout properties.

## Pattern library

| Pattern | For | Core |
| --- | --- | --- |
| Draw-on | Monograms, signatures, line marks, rings | Dash offset 1 → 0 on `pathLength="1"` paths; fills fade in over the last 20 % |
| Staggered assembly | Mark + wordmark, multi-part marks | Parts arrive with translate/scale and a small overshoot, 10–20 % stagger |
| Scale-pop | Compact marks, app icons, badges | Coil to ~0.55, overshoot, counter-settle to 1 (20 : 50 : 30 literally) |
| Mask wipe | Wordmarks, premium lockups | `clip-path: inset(0 100% 0 0)` → `inset(0)` in reading direction, 2–4 px drift |
| Morph from primitive | Marks derived from a circle or square | Few-knot paths with identical command structure; cross-fade where `d` animation is unsupported |
| Letter cascade | Type-led brands | 200–300 ms per letter, 30–60 ms stagger, total ≤ 700 ms |
| Breathing loop | Idle | `scale(1 ↔ 1.02)`, 3–4 s, ease-in-out |
| Pulse accent | One part only | Opacity 0.7 ↔ 1 or scale 1 ↔ 1.06, 1.5–2 s |
| Orbit | Loading | A satellite rotates, 1.2–2 s, linear |
| Hover lift / wink / sheen / redraw | Interaction | 150–300 ms, ease-out, exact return |

## Character motion

A logo moves as a mark; a character moves as a body. Apply the classic animation
principles (Thomas and Johnston, *The Illusion of Life*) through structure, not
decoration. Each maps to a concrete SVG technique:

| Principle | In an SVG character |
| --- | --- |
| Solid drawing | Joints stay attached in every frame: solve limbs by two-bone IK at sampled poses (24 per cycle is plenty) and measure the drift between samples |
| Timing, slow in/out | Sample eased curves into keyframes (`(1 − cos 2πu) / 2`) or put a literal `cubic-bezier()` on the animation; keep every period a divisor of one loop |
| Follow-through, overlapping action | Parts arrive at different times: the head lags the torso by 10–20 % of a cycle and counter-rotates; hair and clothing lag further |
| Secondary action | Something the main action causes: wind in hair, a scarf, a bag strap. Small amplitude (≤ 10°), faster period than the main action. It must read as part of something already there: a small detached shape that flaps reads as a foreign object (a review flagged a shirt-tail flap as "what is that?") |
| Squash and stretch | Body masses compress on the power beat (≤ 5 % for realistic, up to 20 % for cartoon); never deform what must stay rigid (a bicycle, a helmet) |
| Anticipation | A counter-move before a big action (crouch before a jump); a steady loop such as pedalling needs none |
| Arcs | Pivot limbs and heads about joints so points travel on arcs; avoid straight-line translation of organic parts |
| Staging | The silhouette reads at the smallest size: limbs separated from the body where the action happens |
| Exaggeration, appeal | Push proportions (a child's larger head, a catch-light in the eye) more than the motion itself |
| Straight ahead vs pose to pose | Pose to pose: define key poses in data, let interpolation fill the rest |

Structure for this: one group per joint with the pivot at its local origin
(`translate(joint)` on an outer group, the animated `rotate` on an inner one).
**A CSS `transform` animation replaces the element's `transform` attribute**, so an
element that is both placed and animated loses its placement. Put the rest pose
in the inner group's attribute, equal to keyframe 0%, so the static file, reduced
motion, and the first frame agree.

**Draw-on across self-intersections** (∞ marks, scripts). A wide reveal stroke on a
self-crossing centerline shows the other branch early. pixel2motion reports a fix:
cut the fill into pieces between crossing passes, give each its own mask spine,
use butt caps, subdivide the easing exactly at the cut fractions (de Casteljau),
and hide the unavoidable paint-under-ink moment with a small glint riding the
centerline. This recipe was not re-tested here; prove it with frames bracketing
each crossing.

## Implementation rules (measured)

1. **Write keyframe easings literally.** In Chromium, `animation-timing-function:
   var(--ease)` inside `@keyframes` is dropped silently: at 500 ms of 1000 ms the
   literal curve gave 24 px, the `var()` version 500 px, the same as linear. Keep
   tokens for the `animation` shorthand and for documentation; write
   `cubic-bezier(...)` inside keyframes with a comment naming the token.
   `preview_html.mjs` warns about this pattern.
2. **Keep motion-only properties out of the rest state.** Put the dash setup and
   clip in the keyframes and use `animation-fill-mode: backwards`, so they vanish
   when the animation ends. A wipe that ended on `clip-path: inset(0 0 0 0)` with
   `fill-mode: both` clipped glyph edges: 806 px differed from the static logo.
3. **Draw-on start state.** Use `stroke-dasharray: 1 2` with `stroke-dashoffset: 1 → 0`.
   It was the only common setup that showed no ink at t = 0 for butt and round caps,
   open and closed paths. `1 1` leaked a sliver at a closed circle's seam (48 px butt,
   851 px round); `0 1 → 1 0` leaked a round-cap dot. Round caps still let the visible
   tip lead the pen by half the stroke width.
4. **`pathLength` is browser-only.** librsvg and resvg ignore it for dashes. Keep all
   dash settings in the motion CSS so the static file renders correctly everywhere.
5. **Reduced motion is the static logo.** Wrap the choreography in
   `@media (prefers-reduced-motion: no-preference)`. With rules 2 and 5, the reduced
   view is the delivered SVG; `capture_frames.mjs` checks this pixel for pixel.
6. **Context.** CSS animation inside an SVG ran when the SVG was shown as `<img>` in
   Chromium; JavaScript does not run there; SMIL ran too. The host page's CSS cannot
   reach into an `<img>`. Test the real embedding and other browsers before promising
   behavior.
7. **Clip scrolling scenes.** Looping backgrounds keep a second tile outside the
   viewBox. A standalone file clips it, but inline SVG with `overflow: visible`
   shows it spilling over the page. Wrap the scene in a group clipped by a rect the
   size of the viewBox.
8. **One clock.** Give parts one shared duration with offsets, or explicit delays from
   one timeline table, so `?t=<ms>` maps directly to the choreography.

## QA workflow and acceptance

```bash
node scripts/preview_html.mjs logo.svg review/logo-motion.html --mode motion --css motion.css
node scripts/capture_frames.mjs review/logo-motion.html review/motion
node scripts/capture_frames.mjs review/logo-motion.html review/motion \
  --times 0,120,480,860,1000,1550 --probe "#ring:stroke-dashoffset"
```

- Capture at least t = 0, end of anticipation, mid-action, peak overshoot, settle,
  and final, **plus bracketing frames around every risk window**: handoffs, crossings,
  occluder entries. Evenly spaced frames hide handoff defects.
- Inspect `strip.png`: anticipation reads, parts cascade rather than move in lockstep,
  overshoot stays within the personality, nothing clips at the viewBox mid-flight.
- Compare probe values with the designed curve. Values on a straight line where you
  designed an ease mean the easing was dropped.
- `finalFrame.pass` and `reducedMotion.pass` must both be true: no *visible* pixel
  differs from `?bare=1`, the SVG without motion. Chromium rasterizes
  transform-animated groups on their own layers, softer and up to a pixel off, so
  `changedPixels` is rarely 0 there; `visiblePixels` blurs by 0.75 CSS px and allows
  one pixel of offset (a 40 ms pose change still shows tens of thousands of pixels).
- For loops, capture the first frame and the frame at the loop length (the least
  common multiple of all periods); they must match. A layer whose period does not
  divide the loop, or a positive `animation-delay`, breaks the seam — offset phases
  with reversed keyframes or a negative delay instead.
- Report the renderer (Chromium only), the frames checked, and what was not tested:
  other engines, `<img>` embedding, performance on low-end devices.
