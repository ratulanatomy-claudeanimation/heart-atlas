# Joints, faces, and implicit figures

## Contents

- When to read this
- Four stages for every limb
- Joints: landmarks that must survive the bend
- Rhythm: straight against curve
- The head: Loomis construction
- The implicit method (3D skeleton → vector)
- Building blocks and parameters
- Pitfalls found while building it
- Checks

Read [form-and-light.md](form-and-light.md) first for solids, cross-contours, and light.
This file covers the two places where 2D tubes fail: the bend of a joint and the face
seen at any angle. The engine is `scripts/lib/sdfkit.mjs` and its anatomy builders
`scripts/lib/anatomy.mjs`.

## When to read this

A figure, an animal, a hand, or a head that must look solid, especially when a joint is
bent, a limb points at the viewer, or the head is turned. For flat icons, outline
characters, and diagrams this is unnecessary.

## Four stages for every limb

Teaching sheets build an arm or a leg the same way, and the method mirrors it:

| Stage | Drawing | Implicit method |
| --- | --- | --- |
| 1. Bone and gesture | Bone lines, a circle at every joint | 3D joint positions; two-bone IK with a pole vector |
| 2. Basic shapes | Cylinders and boxes, joint circles, the hand as a box, the foot as a wedge | Round cones, rounded boxes, ellipsoids placed in each bone's frame |
| 3. Muscle forms and tendons | Masses that overlap the bone line; tendons at wrist, knee, ankle | Muscle ellipsoids and tendon round cones, joined with a smooth union |
| 4. Shading and detail | Value, line weight, small features | Light, AO and shadows sampled per pixel, then vector bands and lines |

## Joints: landmarks that must survive the bend

A joint reads as a joint when its bony landmarks keep their shape while the soft masses
fold. Put the landmarks in the bone frame so they travel with it, and give them a
small blend radius so they stay hard.

| Joint | Landmarks and masses | What happens when it bends |
| --- | --- | --- |
| Shoulder | Ball of the humerus in its socket; deltoid as a cap that wraps it and inserts in a V at mid-humerus; trapezius slope; clavicle | Raising the arm lifts the acromion and bunches the deltoid; the armpit folds between chest and back |
| Elbow | Olecranon (back point), two epicondyles; biceps front, triceps back; forearm widest in its upper third | The olecranon becomes the sharp outer corner; the forearm mass overlaps the biceps on the inside with a short crease |
| Wrist and hand | The wrist is a box about twice as wide as it is deep; the palm a box with the thumb pad on one side; fingers in three phalanges (1 : 0.65 : 0.5), middle finger longest | Fingers curl toward the palm joint by joint; the knuckles stay on an arc |
| Hip | Iliac crest, greater trochanter; hip flank (gluteus medius) continues into the outer thigh | The pelvis tilts with the weight; the standing hip rises |
| Knee | A box: condyles and tibial plateau, patella on its front plane; vastus medialis low on the inside | The patella stays a flat lozenge; the front becomes a hard plane, the back a soft fold |
| Ankle and foot | Inner malleolus higher than the outer; Achilles tendon straight from calf to heel; the foot a wedge, high at the instep | The tendon keeps the back of the ankle straight; the wedge foreshortens toward the viewer |

Proportion checks for a hanging arm: elbow at the waist, wrist at the hip or crotch,
fingertips at mid-thigh. The knee sits about halfway between hip and sole.

## Rhythm: straight against curve

The two contours of a limb are never mirror curves. Along a leg they alternate, so a
curve on one side faces a straighter line on the other:

- front view: outer thigh curves, inner thigh straight; at the calf the inner side
  curves, the outer is straighter; everything narrows toward a thin ankle;
- side view: the shin front is nearly straight (tibia), the calf behind is curved; on a
  female figure the glute is round and the front of the thigh flatter;
- arm: the deltoid and biceps curve where the opposite contour runs straighter, then the
  forearm's outer swell faces a straight inner line.

Male and female builds differ in the same places: bulkier thigh, prominent kneecap,
larger calf and a relatively thinner ankle on a male; wider hip-to-thigh, rounder
glute and smoother contours on a female. Change the muscle radii, not the skeleton.

## The head: Loomis construction

Work in head-local units with the cranium radius 1, then rotate the whole frame
(yaw, pitch, roll); every feature follows.

- Ball with flat sides (cut at |x| ≈ 0.78): the ear sits on the side plane, behind the
  centre, between the brow line and the nose base.
- Thirds: hairline −T, brow 0, nose base +T, chin +2T with T ≈ 0.68.
- Eyes on the eye line just below the middle of the head (y ≈ 0.22), one eye-width apart,
  set back in shallow sockets under the brow.
- The face hangs from the ball as **one jaw mass** that narrows to the chin; add soft
  brow, cheekbones, muzzle, and chin on it. Separate jaw "wings" show as notches.
- The nose is a **wedge attached along its whole length**: a bridge round cone plus a
  filling ellipsoid down to the face, a tip sphere and two wings. A rod-shaped nose
  leaves a hole beside it in profile.
- Lips: the upper lip as two tilted halves (the dip is the cupid's bow), a smaller lower
  lip. Mouth corners turn up slightly, or the face reads as sad.
- Features are curves **on the surface**: define them in head-local units, project each
  point onto the surface along the ray from the head centre, and keep only the stretches
  whose depth matches the visible surface. Closed lids curve down; brows follow the brow ridge.

Planes that make a face read: the side plane past the temple and cheekbone, the shadow
side of the nose and its cast shadow, the eye sockets, the plane under the lower lip,
and the jaw's shadow on the neck. A light that is too frontal flattens all of them; a
key light about 45° to the side (for example `(−0.68, −0.6, 0.42)`) brings them out.

## The implicit method (3D skeleton → vector)

1. **Skeleton.** Joint positions in 3D (x right, y down, z toward the viewer). Knees and
   elbows from two-bone IK with a pole vector; a knee bent toward the viewer gets real
   depth, so it foreshortens without hand-tuned bone lengths.
2. **Primitives in bone frames.** Round cones for bone masses, ellipsoids for muscles,
   rounded boxes for knee, wrist, palm, and foot, spheres for bony points.
3. **Smooth union.** `smin(a, b, k) = min(a, b) − h²k/4`, `h = max(k − |a − b|, 0)/k`
   (quadratic smooth minimum). Large `k` for soft tissue (12–40 px), small `k` for
   landmarks (3–7 px), `smax` with a negative primitive to carve sockets, `smax` with a
   half-space to cut planes and hems.
4. **Render fields.** An orthographic ray march per pixel gives depth, normal (central
   differences), part, and material; ambient occlusion along the normal darkens creases;
   a soft-shadow march toward the light gives cast shadows (jaw on neck, arm on torso).
5. **Tone.** Lit points: Lambert × shadow × AO. Points in shadow: a negative value from a
   bounce light on the opposite side, so the core shadow is darkest and the edge keeps a
   reflected value.
6. **Vectorize.** Marching squares on the tone field gives one even-odd path per tone
   level per material, clipped to a material mask; simplify (Ramer-Douglas-Peucker) and
   fit Catmull-Rom curves; a light blur softens the steps.
7. **Lines.** Trace each part's outline and keep the stretches where the neighbour across
   the edge is background or lies more than a few pixels behind (occlusion); weight from
   the light at that point, smoothed along the line. Seams where two materials meet on a
   continuous surface (necklines, hems).
8. **Detail passes.** Render the head and hands again at 0.5 px with the full scene (for
   occlusion and shadows), keep only their parts, and draw them on top.

The SVG is a generated asset: edit the generator (skeleton, primitives, palette), not the
paths. Expect a few hundred kilobytes for a full figure.

## Building blocks and parameters

```js
import { group, render, bands, lines, seams, featureCurve, onSurface, ik3, config } from './scripts/lib/sdfkit.mjs';
import { arm, leg, head, headFeatures } from './scripts/lib/anatomy.mjs';
config.minGap = 0.0024 * Math.hypot(viewW, viewH);          // no segments path_audit calls tiny
const knee = ik3(hip, ankle, 222, 210, poleInFront);          // 3D two-bone IK
const scene = [
  group('body', bodyMat, [...torso, ...leg({ hip, knee, ankle, front: [0, 0, 1], lateral: 1, name: 'R-' })]),
  group('head', 'skin', head({ center, R: 43, yaw: -8, pitch: 10, roll: -9 }).items),
];
const F = render(scene, { x0, y0, w, h, step: 1, key, bounce });
const svg = bands(F, 'skin', ramp, { blur: 'soft', prefix: 'fig-' }) + lines(F, { jump: 5, prefix: 'fig-' });
```

- One group per surface that should blend: torso, legs, and arms together (the deltoid
  must melt into the trapezius); head and hair apart. A hand's small `k` keeps it a
  separate form where it rests on the hip.
- Name parts per limb (`L-thigh`, `R-thigh`): occlusion lines are found between parts,
  so two limbs with one name never get a line where one crosses the other.
- `prefix` every call: clip-path IDs repeat otherwise, and a second figure on the page
  silently uses the first one's clip.

## Pitfalls found while building it

| Symptom | Cause | Fix |
| --- | --- | --- |
| A white hole beside the nose in profile | Rod nose attached only at the bridge | Fill the wedge between bridge and face |
| Notch at the eye in profile | Socket carved too deep and too wide | Shallow, small socket; the eyeball fills it |
| Jaw "wings" and gaps under the mouth | Jaw as separate round cones | One narrowing jaw ellipsoid with a large blend |
| Camouflage blotches on a top | Fabric follows every hollow of the body | Garment as a shell: torso primitives inflated 2 px, blended with k ≈ 45, cut by neckline, armholes, and hem |
| Arms look plugged in at the shoulder | Arms in their own group (hard union) | Arms in the body group |
| Wobbly outlines | Contours traced on a binary mask | Blur the mask (σ ≈ 1 px) before contouring |
| Hundreds of near-kinks | A corner decided per segment, not per node | Decide corners per node (turn > 120°) |
| Short or missing feature lines | Min-gap filter compared consecutive raw points | Compare with the last kept point |
| Ray misses through thin parts | Culling without the blend radius, or too few steps | Grow bounds by `k`; 500 steps at 0.8 × distance |
| A sad face | Mouth corners lower than its centre | Lift the corners slightly |

## Checks

Run the usual audits and renders, plus:

- greyscale and two-tone renders of the figure (each material at its own halftone);
- the joint sheet: each joint at 0°, 50°, 100°, 140° keeps its landmark, crease, and width;
- the head at yaw 0°, 35°, 75°: thirds and eye line stay on the ball, the nose reads in
  every view, features disappear behind the face instead of floating over it.
