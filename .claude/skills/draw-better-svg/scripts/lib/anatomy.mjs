// Anatomical limb and head builders for sdfkit. Each returns sdfkit groups.
// Every primitive is placed on the bone frame, so a joint can bend to any angle
// and its landmarks (olecranon, patella, malleoli, deltoid) travel with it.
import { v3, roundCone, sphere, ellipsoid, roundBox, plane, group, frame, rotYPR } from './sdfkit.mjs';
const { add, sub, mul, norm, cross, lerp } = v3;

// Bone frame: t along the bone (0 at a, 1 at b); f = front, s = side (lateral).
export function boneFrame(a, b, frontHint) {
  const u = norm(sub(b, a));
  let f = sub(frontHint, mul(u, v3.dot(frontHint, u))); f = norm(f);
  const s = cross(u, f);
  const L = v3.len(sub(b, a));
  const at = (t, df = 0, ds = 0) => add(add(add(a, mul(u, t * L)), mul(f, df)), mul(s, ds));
  return { a, b, u, f, s, L, at };
}
// Ellipsoid in a bone frame: radii along the bone, to the front, to the side.
function boneEll(B, t, df, ds, rU, rF, rS) {
  // ellipsoid() takes (long axis u, hint for its 2nd axis); its 2nd axis = rF along f.
  return ellipsoid(B.at(t, df, ds), [rU, rF, rS], B.u, B.f);
}

// ------------------------------------------------------------------ arm
// side = +1 when the lateral direction is +s. Returns items for one group.
export function arm({ sh, el, wr, front, lateral = 1, scale = 1, hand = null, name = '' }) {
  const k = scale;
  const U = boneFrame(sh, el, front), F = boneFrame(el, wr, front);
  const lat = lateral;
  const items = [
    // upper arm: humerus mass, deltoid cap (V insertion at mid-humerus), biceps front, triceps back
    { prim: roundCone(sh, el, 15 * k, 11 * k), part: name + 'upper' },
    { prim: boneEll(U, 0.16, 1 * k, lat * 4 * k, 30 * k, 19 * k, 20 * k), k: 10 * k, part: name + 'upper' },
    { prim: boneEll(U, 0.58, 6 * k, 0, 36 * k, 12 * k, 12 * k), k: 9 * k, part: name + 'upper' },
    { prim: boneEll(U, 0.45, -6 * k, lat * 2 * k, 40 * k, 12 * k, 13 * k), k: 9 * k, part: name + 'upper' },
    // elbow: olecranon (back), epicondyles (sides) — small blend radius keeps them bony
    { prim: sphere(U.at(1, -8 * k, 0), 7 * k), k: 4 * k, part: name + 'upper' },
    { prim: sphere(U.at(0.98, -1 * k, lat * 11 * k), 5 * k), k: 4 * k, part: name + 'upper' },
    { prim: sphere(U.at(0.98, -1 * k, -lat * 10 * k), 5.5 * k), k: 4 * k, part: name + 'upper' },
    // forearm: widest in the upper third (flexor/extensor masses), flat at the wrist
    { prim: roundCone(el, wr, 13 * k, 7.5 * k), k: 6 * k, part: name + 'fore' },
    { prim: boneEll(F, 0.24, 1 * k, lat * 3 * k, 38 * k, 15 * k, 19 * k), k: 9 * k, part: name + 'fore' },
    // the wrist is a box, about twice as wide as it is deep
    { prim: roundBox(F.at(0.95), [9 * k, 6 * k, 12 * k], 4 * k, F.u, F.f), k: 5 * k, part: name + 'fore' },
  ];
  if (hand) items.push(...handItems(F, wr, hand, k, lat).map((it) => ({ ...it, part: name + 'hand' })));
  return items;
}
// Hand: a palm block, four fingers of three phalanges each (lengths 1 : 0.65 : 0.5),
// curling by `curl` degrees per joint toward the palm, and a thumb from the palm's base.
function handItems(F, wr, { bend = 15, length = 70, curl = 12, spread = 4, twist = 0 }, k, lat) {
  const rad = (d) => (d * Math.PI) / 180;
  const rot = (v, axis, a) => { // Rodrigues
    const c = Math.cos(a), s = Math.sin(a), d = v3.dot(axis, v);
    return add(add(mul(v, c), mul(cross(axis, v), s)), mul(axis, d * (1 - c)));
  };
  const s0 = norm(rot(F.s, F.u, rad(twist))), f0 = norm(rot(F.f, F.u, rad(twist)));
  const dir = norm(rot(F.u, s0, -rad(bend)));          // wrist flexion toward the palm (f0)
  const palmFront = norm(cross(s0, dir));               // palm normal
  const L = length * k, palmL = L * 0.46, base = add(wr, mul(dir, 3 * k));
  const knuckles = add(base, mul(dir, palmL));
  const items = [
    // the palm is a box; the thenar pad (thumb ball) softens its radial side
    { prim: roundBox(lerp(base, knuckles, 0.5), [palmL * 0.5, 5 * k, 14 * k], 4.5 * k, dir, palmFront), k: 4 * k, part: 'hand' },
    { prim: ellipsoid(add(lerp(base, knuckles, 0.3), add(mul(s0, -lat * 8 * k), mul(palmFront, 3 * k))), [12 * k, 6 * k, 8 * k], dir, palmFront), k: 4 * k, part: 'hand' },
  ];
  const lens = [0.92, 1.0, 0.95, 0.78];
  for (let n = 0; n < 4; n++) {
    const off = (n - 1.5) * 7.4 * k * lat;
    let p = add(add(knuckles, mul(s0, off)), mul(dir, -2 * k));
    let d = norm(rot(dir, palmFront, rad((n - 1.5) * spread * lat)));
    const fl = L * 0.5 * lens[n], seg = [fl * 0.45, fl * 0.3, fl * 0.25], rr = [4.2, 3.7, 3.2, 2.7].map((x) => x * k * (n === 3 ? 0.85 : 1));
    for (let q = 0; q < 3; q++) {
      d = norm(rot(d, s0, rad(curl) * lat));
      const p2 = add(p, mul(d, seg[q]));
      items.push({ prim: roundCone(p, p2, rr[q], rr[q + 1]), k: 1.6 * k, part: 'hand' });
      p = p2;
    }
  }
  // thumb: from the palm base on the radial side, angled out and toward the palm
  const tb = add(add(base, mul(dir, palmL * 0.2)), mul(s0, -lat * 12 * k));
  const td = norm(add(add(mul(dir, 0.75), mul(s0, -lat * 0.45)), mul(palmFront, 0.45)));
  const t1 = add(tb, mul(td, 18 * k)), t2 = add(t1, mul(norm(add(td, mul(dir, 0.4))), 14 * k));
  items.push({ prim: roundCone(tb, t1, 7 * k, 4.6 * k), k: 4 * k, part: 'hand' }, { prim: roundCone(t1, t2, 4.6 * k, 3.4 * k), k: 1.6 * k, part: 'hand' });
  return items;
}

// ------------------------------------------------------------------ leg
export function leg({ hip, knee, ankle, front, lateral = 1, scale = 1, foot = true, toe = null, name = '', footMat }) {
  const k = scale, lat = lateral;
  const T = boneFrame(hip, knee, front), S = boneFrame(knee, ankle, front);
  const items = [
    // thigh: femur mass, quadriceps front, vastus medialis teardrop low on the inside, hamstrings back
    { prim: roundCone(hip, knee, 30 * k, 15 * k), part: name + 'thigh' },
    { prim: boneEll(T, 0.42, 7 * k, lat * 2 * k, 80 * k, 20 * k, 24 * k), k: 12 * k, part: name + 'thigh' },
    { prim: boneEll(T, 0.82, 4 * k, -lat * 10 * k, 30 * k, 13 * k, 13 * k), k: 9 * k, part: name + 'thigh' },
    { prim: boneEll(T, 0.5, -8 * k, 0, 75 * k, 18 * k, 22 * k), k: 12 * k, part: name + 'thigh' },
    // knee: patella in front (a flattened lozenge), condyles at the sides — box-like, not round
    // the knee is a box (condyles + tibial plateau) with the patella on its front plane
    { prim: roundBox(T.at(0.99, 2 * k, 0), [14 * k, 11 * k, 14 * k], 6 * k, T.u, T.f), k: 7 * k, part: name + 'thigh' },
    { prim: ellipsoid(T.at(0.98, 12 * k, 0), [9 * k, 4.5 * k, 8.5 * k], T.u, T.f), k: 3.5 * k, part: name + 'thigh' },
    { prim: sphere(T.at(0.97, -1 * k, lat * 10 * k), 7 * k), k: 7 * k, part: name + 'thigh' },
    { prim: sphere(T.at(0.97, -1 * k, -lat * 11 * k), 7.5 * k), k: 7 * k, part: name + 'thigh' },
    // hip flank (gluteus medius / tensor) and adductors: the thigh continues the hip line and meets its pair
    { prim: boneEll(T, 0.06, -2 * k, lat * 16 * k, 46 * k, 24 * k, 22 * k), k: 16 * k, part: name + 'thigh' },
    { prim: boneEll(T, 0.16, 2 * k, -lat * 10 * k, 46 * k, 15 * k, 12 * k), k: 12 * k, part: name + 'thigh' },
    // shin: tibia front edge, calf (inner head lower than outer), narrow above the ankle
    { prim: roundCone(knee, ankle, 14 * k, 8 * k), k: 6 * k, part: name + 'shin' },
    { prim: boneEll(S, 0.28, -11 * k, lat * 5 * k, 46 * k, 18 * k, 14 * k), k: 10 * k, part: name + 'shin' },
    { prim: boneEll(S, 0.35, -11 * k, -lat * 6 * k, 50 * k, 18 * k, 14 * k), k: 10 * k, part: name + 'shin' },
    // Achilles tendon: a straight line from the calf down to the heel keeps the ankle narrow
    { prim: roundCone(S.at(0.55, -10 * k, 0), S.at(1.04, -11 * k, 0), 6 * k, 4.5 * k), k: 6 * k, part: name + 'shin' },
    // ankle: inner malleolus higher, outer lower and further back
    { prim: sphere(S.at(0.97, 0, -lat * 9 * k), 5.5 * k), k: 3.5 * k, part: name + 'shin' },
    { prim: sphere(S.at(1.02, -2 * k, lat * 9 * k), 5.5 * k), k: 3.5 * k, part: name + 'shin' },
  ];
  if (foot) {
    const fwd = toe ? norm(sub(toe, ankle)) : norm(S.f);
    const heel = add(ankle, add(mul(S.u, 6 * k), mul(fwd, -14 * k)));
    const ball = add(add(ankle, mul(S.u, 12 * k)), mul(fwd, 46 * k));
    const tip = add(ball, mul(fwd, 22 * k));
    items.push(
      { prim: roundCone(heel, ball, 11 * k, 9 * k), k: 7 * k, part: name + 'foot', mat: footMat },
      // the foot is a wedge: high at the instep, thin at the toes
      { prim: roundBox(lerp(heel, ball, 0.55), [26 * k, 7 * k, 13 * k], 5 * k, sub(ball, heel), S.u), k: 6 * k, part: name + 'foot', mat: footMat },
      { prim: ellipsoid(lerp(ankle, ball, 0.5), [28 * k, 9 * k, 13 * k], sub(ball, ankle), S.s), k: 6 * k, part: name + 'foot', mat: footMat },
      { prim: roundCone(ball, tip, 10 * k, 6 * k), k: 5 * k, part: name + 'foot', mat: footMat },
    );
  }
  return items;
}

// ------------------------------------------------------------------ head (Loomis construction)
// Head-local units: cranium radius 1; x to the figure's left (viewer's right in front view),
// y down, z forward (the face). Brow line y = 0, nose base y = T, chin y = 2T, hairline y = −T.
export const LOOMIS = { T: 0.68, eyeY: 0.22, eyeX: 0.34, eyeR: 0.13, mouthY: 0.92, chinY: 1.36 };

export function head({ center, R, yaw = 0, pitch = 0, roll = 0, eyes = 'closed', female = true }) {
  const M = rotYPR(yaw, pitch, roll), Fm = frame(center, M, R);
  const W = (p) => Fm.toWorld(p), r = (x) => x * R;
  const L = LOOMIS;
  const ell = (c, rad, u, vh) => ellipsoid(W(c), rad.map(r), Fm.dir(u), Fm.dir(vh));
  const items = [
    // cranium ball with flattened sides (Loomis side planes)
    { prim: sphere(W([0, 0, 0]), r(1)), part: 'head' },
    { prim: plane(Fm.dir([1, 0, 0]), v3.dot(Fm.dir([1, 0, 0]), W([0.78, 0, 0]))), op: 'int', k: r(0.25), part: 'head' },
    { prim: plane(Fm.dir([-1, 0, 0]), v3.dot(Fm.dir([-1, 0, 0]), W([-0.78, 0, 0]))), op: 'int', k: r(0.25), part: 'head' },
    // one jaw mass hangs from the ball and narrows to the chin (no separate jaw "wings")
    { prim: ell([0, 0.62, 0.3], [0.6, 0.78, 0.62], [1, 0, 0], [0, 1, 0]), k: r(0.3), part: 'head' },
    // soft landmarks on that mass: brow ridge, cheekbones, muzzle, chin
    { prim: ell([0, -0.02, 0.74], [0.55, 0.14, 0.22], [1, 0, 0], [0, 1, 0]), k: r(0.16), part: 'head' },
    { prim: ell([0.48, 0.36, 0.6], [0.2, 0.14, 0.22], [1, 0, 0], [0, 1, 0]), k: r(0.2), part: 'head' },
    { prim: ell([-0.48, 0.36, 0.6], [0.2, 0.14, 0.22], [1, 0, 0], [0, 1, 0]), k: r(0.2), part: 'head' },
    { prim: ell([0, 0.88, 0.62], [0.3, 0.26, 0.3], [1, 0, 0], [0, 1, 0]), k: r(0.2), part: 'head' },
    { prim: sphere(W([0, 1.22, 0.6]), r(0.15)), k: r(0.16), part: 'head' },
    // shallow eye sockets under the brow, eyeballs bulging from them (lids closed: skin)
    { prim: ell([L.eyeX, L.eyeY - 0.02, 0.96], [0.17, 0.1, 0.09], [1, 0, 0], [0, 1, 0]), op: 'sub', k: r(0.1), part: 'head' },
    { prim: ell([-L.eyeX, L.eyeY - 0.02, 0.96], [0.17, 0.1, 0.09], [1, 0, 0], [0, 1, 0]), op: 'sub', k: r(0.1), part: 'head' },
    { prim: sphere(W([L.eyeX, L.eyeY, 0.74]), r(L.eyeR)), k: r(0.05), part: 'head' },
    { prim: sphere(W([-L.eyeX, L.eyeY, 0.74]), r(L.eyeR)), k: r(0.05), part: 'head' },
    // nose: bridge → tip, two wings
    { prim: roundCone(W([0, 0.08, 0.9]), W([0, 0.55, 1.13]), r(0.05), r(0.07)), k: r(0.08), part: 'head' },
    { prim: sphere(W([0, 0.59, 1.11]), r(0.08)), k: r(0.05), part: 'head' },
    // the nose is a wedge attached along its whole length, not a rod: fill bridge → face
    { prim: ell([0, 0.42, 0.98], [0.085, 0.24, 0.11], [1, 0, 0], [0, 0.89, 0.45]), k: r(0.1), part: 'head' },
    { prim: sphere(W([0.1, 0.62, 0.98]), r(0.065)), k: r(0.05), part: 'head' },
    { prim: sphere(W([-0.1, 0.62, 0.98]), r(0.065)), k: r(0.05), part: 'head' },
    // lips
    // upper lip as two tilted halves: the dip between them is the cupid's bow
    { prim: ell([0.075, L.mouthY - 0.032, 0.885], [0.11, 0.034, 0.055], [1, 0.18, 0], [0, 1, 0]), k: r(0.03), part: 'head', mat: 'lip' },
    { prim: ell([-0.075, L.mouthY - 0.032, 0.885], [0.11, 0.034, 0.055], [1, -0.18, 0], [0, 1, 0]), k: r(0.03), part: 'head', mat: 'lip' },
    { prim: ell([0, L.mouthY + 0.04, 0.865], [0.13, 0.036, 0.055], [1, 0, 0], [0, 1, 0]), k: r(0.04), part: 'head', mat: 'lip' },
    // ears on the side planes, between brow line and nose base, behind the centre
    { prim: ell([0.8, 0.36, -0.12], [0.07, 0.3, 0.17], [1, 0, 0], [0, 1, 0]), k: r(0.05), part: 'ear' },
    { prim: ell([-0.8, 0.36, -0.12], [0.07, 0.3, 0.17], [1, 0, 0], [0, 1, 0]), k: r(0.05), part: 'ear' },
  ];
  const hair = [
    { prim: ellipsoid(W([0, -0.06, -0.04]), [r(1.04), r(1.03), r(1.06)], Fm.dir([1, 0, 0]), Fm.dir([0, 1, 0])), part: 'hair' },
    // the hair hugs the side planes too, then the hairline cuts it over the forehead and above the ears
    { prim: plane(Fm.dir([1, 0, 0]), v3.dot(Fm.dir([1, 0, 0]), W([0.86, 0, 0]))), op: 'int', k: r(0.25), part: 'hair' },
    { prim: plane(Fm.dir([-1, 0, 0]), v3.dot(Fm.dir([-1, 0, 0]), W([-0.86, 0, 0]))), op: 'int', k: r(0.25), part: 'hair' },
    { prim: plane(Fm.dir([0, 0.45, 0.89]), v3.dot(Fm.dir([0, 0.45, 0.89]), W([0, -0.55, 0.62]))), op: 'int', k: r(0.12), part: 'hair' },
    { prim: plane(Fm.dir([0, 1, 0.25]), v3.dot(Fm.dir([0, 1, 0.25]), W([0, 0.12, 0]))), op: 'int', k: r(0.12), part: 'hair' },
    { prim: sphere(W([0, -1.02, -0.38]), r(0.4)), k: r(0.15), part: 'hair' },
  ];
  return { items, hair, frame: Fm, M };
}

// Feature curves in head-local units (world points after Fm.toWorld). Closed eyes,
// brows, lip line, nostrils. Depth-tested by featureCurve().
export function headFeatures(Fm, eyes = 'closed') {
  const L = LOOMIS, out = {};
  const arc = (f, n = 24) => Array.from({ length: n + 1 }, (_, i) => Fm.toWorld(f(i / n)));
  out.lids = [1, -1].map((s) => arc((t) => {
    const a = (t - 0.5) * 2.0; // −1..1 across the eye
    return [s * L.eyeX + a * 0.15, L.eyeY + 0.02 + 0.055 * (1 - a * a), 0.74 + Math.sqrt(Math.max(0, 0.155 ** 2 - (a * 0.15) ** 2))];
  }));
  out.creases = [1, -1].map((s) => arc((t) => {
    const a = (t - 0.5) * 1.8;
    return [s * L.eyeX + a * 0.14, L.eyeY - 0.08 - 0.02 * (1 - a * a), 0.74 + Math.sqrt(Math.max(0, 0.15 ** 2 - (a * 0.14) ** 2))];
  }));
  out.brows = [1, -1].map((s) => arc((t) => [s * (0.14 + t * 0.34), -0.1 - 0.06 * Math.sin(t * Math.PI * 0.85), 0.93 - 0.25 * t * t]));
  out.mouth = [arc((t) => { const a = (t - 0.5) * 2; return [a * 0.19, L.mouthY + 0.012 - 0.018 * a * a, 0.95 - 0.12 * a * a]; })];
  out.nostrils = [1, -1].map((s) => arc((t) => [s * (0.04 + 0.07 * t), 0.66 + 0.02 * Math.sin(t * Math.PI), 1.06 - 0.09 * t], 10));
  return out;
}
