// sdfkit — draw organic forms as vectors from a 3D implicit model.
//
//   skeleton + primitives (round cones, ellipsoids) → smooth union per body part
//   → orthographic ray march (depth, normal, part, material, light, AO)
//   → marching squares on the tone field → simplified, smoothed SVG paths
//   → occlusion / silhouette lines with light-dependent weight
//   → feature curves (lids, brows, lips) projected with a depth test.
//
// Coordinates: x right, y down, z toward the viewer (pixels). No dependencies.

// minGap: shortest Bézier segment written (px). path_audit flags segments under 0.2 % of the
// viewBox diagonal, so set it from the canvas: config.minGap = 0.0024 * diagonal.
export const config = { minGap: 3 };

// ------------------------------------------------------------------ vectors
export const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};
const { add, sub, mul, dot, cross, len, norm } = v3;

// Rotation matrix from yaw (about y), pitch (about x), roll (about z), degrees.
export function rotYPR(yaw = 0, pitch = 0, roll = 0) {
  const [a, b, c] = [yaw, pitch, roll].map((d) => (d * Math.PI) / 180);
  const Ry = [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]];
  const Rx = [[1, 0, 0], [0, Math.cos(b), -Math.sin(b)], [0, Math.sin(b), Math.cos(b)]];
  const Rz = [[Math.cos(c), -Math.sin(c), 0], [Math.sin(c), Math.cos(c), 0], [0, 0, 1]];
  const m = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  return m(Rz, m(Ry, Rx));
}
export const apply = (M, p) => [0, 1, 2].map((i) => M[i][0] * p[0] + M[i][1] * p[1] + M[i][2] * p[2]);

// A local frame: origin, rotation, scale. Maps head-local units to world pixels.
export function frame(origin, M, s) {
  return { origin, M, s, toWorld: (p) => add(origin, mul(apply(M, p), s)), dir: (d) => apply(M, d) };
}

// Two-bone IK in 3D: joint between a and c, bones l1, l2, bending toward `pole`.
export function ik3(a, c, l1, l2, pole) {
  const ac = sub(c, a), d = Math.min(len(ac), l1 + l2 - 0.01), u = norm(ac);
  const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const pv = sub(pole, a), side = norm(sub(pv, mul(u, dot(pv, u))));
  return add(add(a, mul(u, x)), mul(side, h));
}

// ------------------------------------------------------------------ primitives (exact or bounded SDFs)
// Round cone between a (radius r1) and b (radius r2): Inigo Quilez, "distance functions".
export function roundCone(a, b, r1, r2) {
  const ba = sub(b, a), l2 = dot(ba, ba), rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const [ax, ay, az] = a, [bx, by, bz] = ba;
  const d = (x, y, z) => {
    const px = x - ax, py = y - ay, pz = z - az;
    const yv = px * bx + py * by + pz * bz, zv = yv - l2;
    const qx = px * l2 - bx * yv, qy = py * l2 - by * yv, qz = pz * l2 - bz * yv;
    const x2 = qx * qx + qy * qy + qz * qz, y2 = yv * yv * l2, z2 = zv * zv * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zv) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
    if (Math.sign(yv) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
    return (Math.sqrt(x2 * a2 * il2) + yv * rr) * il2 - r1;
  };
  return { d, c: v3.lerp(a, b, 0.5), R: Math.sqrt(l2) / 2 + Math.max(r1, r2) };
}
export const sphere = (c, r) => ({ d: (x, y, z) => Math.hypot(x - c[0], y - c[1], z - c[2]) - r, c, R: r });

// Ellipsoid with semi-axes r along an orthonormal frame (u, v, w); bounded approximation (IQ).
export function ellipsoid(c, r, u = [1, 0, 0], vHint = [0, 1, 0]) {
  u = norm(u); const w = norm(cross(u, vHint)); const v = cross(w, u);
  const [r0, r1, r2] = r;
  const d = (x, y, z) => {
    const px = x - c[0], py = y - c[1], pz = z - c[2];
    const lx = px * u[0] + py * u[1] + pz * u[2], ly = px * v[0] + py * v[1] + pz * v[2], lz = px * w[0] + py * w[1] + pz * w[2];
    const k0 = Math.hypot(lx / r0, ly / r1, lz / r2), k1 = Math.hypot(lx / (r0 * r0), ly / (r1 * r1), lz / (r2 * r2));
    return k1 === 0 ? -Math.min(r0, r1, r2) : (k0 * (k0 - 1)) / k1;
  };
  return { d, c, R: Math.max(r0, r1, r2) };
}
// Ellipsoid aligned to a bone: long axis from a to b, depth axis toward `face` direction.
export function boneEllipsoid(a, b, t, rAlong, rSide, rDepth, offset = [0, 0, 0]) {
  const c = add(v3.lerp(a, b, t), offset);
  return ellipsoid(c, [rAlong, rSide, rDepth], sub(b, a), [0, 0, 1]);
}
// Rounded box (IQ): half extents b along an orthonormal frame (u, v, w), edge radius r.
// Use it where a drawing teacher says "box": knee, wrist, palm, the wedge of the foot.
export function roundBox(c, b, r, u = [1, 0, 0], vHint = [0, 1, 0]) {
  u = norm(u); const w = norm(cross(u, vHint)); const v = cross(w, u);
  const d = (x, y, z) => {
    const px = x - c[0], py = y - c[1], pz = z - c[2];
    const qx = Math.abs(px * u[0] + py * u[1] + pz * u[2]) - b[0] + r, qy = Math.abs(px * v[0] + py * v[1] + pz * v[2]) - b[1] + r, qz = Math.abs(px * w[0] + py * w[1] + pz * w[2]) - b[2] + r;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
  };
  return { d, c, R: Math.hypot(b[0], b[1], b[2]) };
}
// Half-space n·p ≤ h (unbounded): used with 'int' to cut a primitive.
export const plane = (n, h) => { n = norm(n); return { d: (x, y, z) => n[0] * x + n[1] * y + n[2] * z - h, c: [0, 0, 0], R: Infinity }; };

// ------------------------------------------------------------------ blending (IQ quadratic smooth min)
export const smin = (a, b, k) => {
  if (k <= 0) return a < b ? a : b;
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
export const smax = (a, b, k) => -smin(-a, -b, k);

// ------------------------------------------------------------------ scene
// A group blends its items: { prim, op: 'add' | 'sub' | 'int', k, part, mat }.
// Groups combine with a hard min. `mat` may be a function of the hit point.
export function group(name, mat, items) { return { name, mat, items }; }

// Items whose bounding sphere (grown by its blend radius) can touch the ray at (x, y).
// A 2D bin index makes this cheap enough for AO and shadow rays.
const INDEX = new WeakMap();
const BIN = 16;
function relevant(scene, x, y) {
  let idx = INDEX.get(scene);
  if (!idx) { idx = new Map(); INDEX.set(scene, idx); }
  const bi = Math.floor(x / BIN), bj = Math.floor(y / BIN), key = bi * 100003 + bj;
  let cand = idx.get(key);
  if (!cand) {
    const cx = (bi + 0.5) * BIN, cy = (bj + 0.5) * BIN, half = BIN * 0.7072;
    cand = [];
    for (const g of scene) {
      const items = g.items.filter((it) => it.prim.R === Infinity || it.op === 'int' ||
        Math.hypot(cx - it.prim.c[0], cy - it.prim.c[1]) <= it.prim.R + (it.k || 0) + 2 + half);
      if (items.some((it) => it.op !== 'sub' && it.op !== 'int')) cand.push({ g, items });
    }
    idx.set(key, cand);
  }
  return cand;
}

function evalGroup(gi, x, y, z, info) {
  let d = Infinity, best = Infinity, bestItem = null;
  for (const it of gi.items) {
    const di = it.prim.d(x, y, z);
    if (it.op === 'sub') d = smax(d, -di, it.k || 0);
    else if (it.op === 'int') d = smax(d, di, it.k || 0);
    else { d = smin(d, di, it.k || 0); if (di < best) { best = di; bestItem = it; } }
  }
  if (info) info.item = bestItem;
  return d;
}
function evalScene(rel, x, y, z, info) {
  let d = Infinity, gBest = null, iBest = null;
  const tmp = {};
  for (const gi of rel) {
    const dg = evalGroup(gi, x, y, z, tmp);
    if (dg < d) { d = dg; gBest = gi; iBest = tmp.item; }
  }
  if (info) { info.g = gBest; info.item = iBest; }
  return d;
}

// ------------------------------------------------------------------ render fields
// Light: key (to the light), bounce (from the floor, opposite side); both unit vectors.
export function render(scene, opts) {
  const { x0, y0, w, h, step = 1, key, bounce, ao = true, shadows = true, specPow = 40 } = opts;
  const W = Math.ceil(w / step) + 1, H = Math.ceil(h / step) + 1, N = W * H;
  const F = {
    W, H, x0, y0, step,
    hit: new Uint8Array(N), depth: new Float32Array(N).fill(-1e9), tone: new Float32Array(N).fill(-9),
    key: new Float32Array(N), spec: new Float32Array(N), part: new Int16Array(N).fill(-1), mat: new Array(N).fill(null),
    parts: [], partIndex: new Map(),
  };
  const halfV = norm(add(key, [0, 0, 1]));
  const info = {};
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = x0 + i * step, y = y0 + j * step;
      const rel = relevant(scene, x, y);
      if (!rel.length) continue;
      let zTop = -Infinity, zBot = Infinity;
      for (const r of rel) for (const it of r.items) if (it.prim.R !== Infinity && it.op !== 'sub' && it.op !== 'int') {
        zTop = Math.max(zTop, it.prim.c[2] + it.prim.R + (it.k || 0)); zBot = Math.min(zBot, it.prim.c[2] - it.prim.R - (it.k || 0));
      }
      let z = zTop, hitZ = null;
      for (let s = 0; s < 500 && z > zBot; s++) {
        const d = evalScene(rel, x, y, z);
        if (d < 0.02) { hitZ = z; break; }
        z -= Math.max(d * 0.8, 0.02);
      }
      if (hitZ === null) continue;
      const k = j * W + i;
      evalScene(rel, x, y, hitZ, info);
      const e = 0.35;
      const n = norm([
        evalScene(rel, x + e, y, hitZ) - evalScene(rel, x - e, y, hitZ),
        evalScene(rel, x, y + e, hitZ) - evalScene(rel, x, y - e, hitZ),
        evalScene(rel, x, y, hitZ + e) - evalScene(rel, x, y, hitZ - e),
      ]);
      // ambient occlusion along the normal (IQ): creases, armpits, the inside of a bent joint
      let occ = 1;
      if (ao) {
        let o = 0, sca = 1;
        for (let a = 1; a <= 5; a++) {
          const hh = 1.5 + 3.5 * a, p = add([x, y, hitZ], mul(n, hh));
          o += (hh - evalScene(relevant(scene, p[0], p[1]), p[0], p[1], p[2])) * sca; sca *= 0.8;
        }
        occ = Math.max(0, Math.min(1, 1 - (opts.aoStrength ?? 0.016) * o));
      }
      // soft shadow toward the key light (IQ): the jaw on the neck, an arm on the torso
      let sh = 1;
      if (shadows) {
        let t = 3;
        for (let s = 0; s < 48 && t < 260; s++) {
          const p = add([x, y, hitZ], mul(key, t));
          const d = evalScene(relevant(scene, p[0], p[1]), p[0], p[1], p[2]);
          sh = Math.min(sh, (8 * d) / t);
          if (sh < 0.02) { sh = 0; break; }
          t += Math.max(d, 1.5);
        }
        sh = Math.max(0, sh);
      }
      const kd = dot(n, key), bd = Math.max(0, dot(n, bounce));
      const lit = Math.max(0, kd) * (0.25 + 0.75 * sh) * (0.55 + 0.45 * occ);
      // tone > 0 lit (0..1); tone < 0 in shadow, more negative = more reflected light
      F.tone[k] = lit > 0.004 ? lit : -bd * occ;
      F.key[k] = kd;
      F.spec[k] = Math.pow(Math.max(0, dot(n, halfV)), specPow) * sh;
      F.hit[k] = 1; F.depth[k] = hitZ;
      const it = info.item, g = info.g.g;
      const m = it?.mat ?? g.mat;
      F.mat[k] = typeof m === 'function' ? m([x, y, hitZ]) : m;
      const pname = `${g.name}/${it?.part ?? g.name}`;
      if (!F.partIndex.has(pname)) { F.partIndex.set(pname, F.parts.length); F.parts.push(pname); }
      F.part[k] = F.partIndex.get(pname);
    }
  }
  return F;
}

// ------------------------------------------------------------------ marching squares
// Closed loops of {field >= level} on a W×H grid (border padded outside).
export function contours(field, W, H, level) {
  const at = (i, j) => (i < 0 || j < 0 || i >= W || j >= H ? -1e9 : field[j * W + i]);
  const segs = new Map(); // edge key -> [segment ids]
  const S = [];
  const pt = (key) => {
    const [t, i, j] = key.split(':'); const a = +i, b = +j;
    if (t === 'h') { const va = at(a, b), vb = at(a + 1, b); return [a + (level - va) / (vb - va), b]; }
    const va = at(a, b), vb = at(a, b + 1); return [a, b + (level - va) / (vb - va)];
  };
  const push = (e1, e2) => {
    const id = S.length; S.push([e1, e2]);
    for (const e of [e1, e2]) { if (!segs.has(e)) segs.set(e, []); segs.get(e).push(id); }
  };
  for (let j = -1; j < H; j++) for (let i = -1; i < W; i++) {
    const tl = at(i, j) >= level, tr = at(i + 1, j) >= level, br = at(i + 1, j + 1) >= level, bl = at(i, j + 1) >= level;
    const c = (tl << 3) | (tr << 2) | (br << 1) | bl;
    if (c === 0 || c === 15) continue;
    const T = `h:${i}:${j}`, B = `h:${i}:${j + 1}`, L = `v:${i}:${j}`, R = `v:${i + 1}:${j}`;
    const centre = (at(i, j) + at(i + 1, j) + at(i + 1, j + 1) + at(i, j + 1)) / 4 >= level;
    switch (c) {
      case 1: case 14: push(L, B); break;
      case 2: case 13: push(B, R); break;
      case 3: case 12: push(L, R); break;
      case 4: case 11: push(T, R); break;
      case 6: case 9: push(T, B); break;
      case 7: case 8: push(T, L); break;
      case 5: if (centre) { push(T, L); push(B, R); } else { push(T, R); push(L, B); } break;
      case 10: if (centre) { push(T, R); push(L, B); } else { push(T, L); push(B, R); } break;
    }
  }
  const used = new Uint8Array(S.length), loops = [];
  for (let s0 = 0; s0 < S.length; s0++) {
    if (used[s0]) continue;
    const loop = []; let s = s0, from = S[s0][0];
    while (!used[s]) {
      used[s] = 1;
      const to = S[s][0] === from ? S[s][1] : S[s][0];
      loop.push(pt(to));
      const next = (segs.get(to) || []).find((q) => !used[q]);
      if (next === undefined) break;
      from = to; s = next;
    }
    if (loop.length > 3) loops.push(loop);
  }
  return loops;
}

// Separable Gaussian blur of a grid field. A binary mask contoured at 0.5 gives pixel
// stairs; blurred first (σ ≈ 1 cell), the same contour is smooth to a fraction of a pixel.
export function blurField(src, W, H, sigma = 1) {
  const r = Math.ceil(sigma * 2.5), ker = [];
  for (let i = -r; i <= r; i++) ker.push(Math.exp(-(i * i) / (2 * sigma * sigma)));
  const ks = ker.reduce((a, b) => a + b, 0); for (let i = 0; i < ker.length; i++) ker[i] /= ks;
  const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let a = 0; for (let o = -r; o <= r; o++) { const x = Math.min(W - 1, Math.max(0, i + o)); a += src[j * W + x] * ker[o + r]; } tmp[j * W + i] = a; }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let a = 0; for (let o = -r; o <= r; o++) { const y = Math.min(H - 1, Math.max(0, j + o)); a += tmp[y * W + i] * ker[o + r]; } out[j * W + i] = a; }
  return out;
}

// ------------------------------------------------------------------ simplify and smooth
export function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let idx = -1, dmax = 0;
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / L;
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax <= eps) return [a, b];
  return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
}
export function rdpClosed(loop, eps) {
  // split at the farthest pair so both halves are open polylines
  let far = 0, fd = 0;
  for (let i = 1; i < loop.length; i++) { const d = Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1]); if (d > fd) { fd = d; far = i; } }
  const A = rdp(loop.slice(0, far + 1), eps), B = rdp([...loop.slice(far), loop[0]], eps);
  return [...A.slice(0, -1), ...B.slice(0, -1)];
}
const P2 = (p) => `${Math.round(p[0] * 100) / 100} ${Math.round(p[1] * 100) / 100}`;
const l2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// Catmull-Rom → cubic Bézier with capped handles and clean corners where the curve doubles back.
export function smooth(raw, closed = false, minGap = config.minGap) {
  const pts = [];
  for (const p of raw) if (!pts.length || l2(p, pts[pts.length - 1]) >= minGap) pts.push(p); // gap to the last kept point
  if (!closed && raw.length > 1 && pts.length > 1 && pts[pts.length - 1] !== raw[raw.length - 1]) pts[pts.length - 1] = raw[raw.length - 1];
  if (closed && pts.length > 2 && l2(pts[0], pts[pts.length - 1]) < minGap) pts.pop();
  const n = pts.length;
  if (n < (closed ? 3 : 2)) return '';
  const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${P2(pts[0])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const chord = l2(p1, p2);
    const cap = (v) => { const l = Math.hypot(v[0], v[1]); return l > chord * 0.4 ? [v[0] * chord * 0.4 / l, v[1] * chord * 0.4 / l] : v; };
    // a node is a corner when the polyline turns back on itself there (> 120°); decided per
    // node, so both segments meeting at it agree and no near-kink is left behind
    const corner = (a, b, c) => { const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1]; return (ux * vx + uy * vy) / ((Math.hypot(ux, uy) * Math.hypot(vx, vy)) || 1) < -0.5; };
    const sharp1 = corner(p0, p1, p2), sharp2 = corner(p1, p2, p3);
    const t1 = cap([(p2[0] - p0[0]) / 6, (p2[1] - p0[1]) / 6]), t2 = cap([(p3[0] - p1[0]) / 6, (p3[1] - p1[1]) / 6]);
    const c1 = sharp1 ? [p1[0] + (p2[0] - p1[0]) / 3, p1[1] + (p2[1] - p1[1]) / 3] : [p1[0] + t1[0], p1[1] + t1[1]];
    const c2 = sharp2 ? [p2[0] + (p1[0] - p2[0]) / 3, p2[1] + (p1[1] - p2[1]) / 3] : [p2[0] - t2[0], p2[1] - t2[1]];
    d += ` C${P2(c1)} ${P2(c2)} ${P2(p2)}`;
  }
  return closed ? d + ' Z' : d;
}
const area = (loop) => { let a = 0; for (let i = 0; i < loop.length; i++) { const p = loop[i], q = loop[(i + 1) % loop.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); };

// Region {field >= level} as one even-odd path in world coordinates.
export function regionPath(F, field, level, { eps = 0.45, minArea = 3 } = {}) {
  const loops = contours(field, F.W, F.H, level)
    .map((l) => l.map(([i, j]) => [F.x0 + i * F.step, F.y0 + j * F.step]))
    .filter((l) => area(l) >= minArea)
    .map((l) => rdpClosed(l, eps))
    .filter((l) => l.length >= 4);
  return loops.map((l) => smooth(l, true)).filter(Boolean).join(' ');
}

// ------------------------------------------------------------------ bands per material
// levels: [[threshold, colour], ...] ascending; the first fills the whole material mask.
export function bands(F, mat, levels, { blur, specLevel, specColor, specOpacity = 0.8, prefix = '' } = {}) {
  const N = F.W * F.H, field = new Float32Array(N);
  for (let k = 0; k < N; k++) field[k] = F.mat[k] === mat ? F.tone[k] : -99;
  const out = [];
  const ind = new Float32Array(N); for (let k = 0; k < N; k++) ind[k] = F.mat[k] === mat ? 1 : 0;
  const mask = regionPath(F, blurField(ind, F.W, F.H, 0.9 / F.step), 0.5);
  if (!mask) return '';
  out.push(`<path d="${mask}" fill="${levels[0][1]}" fill-rule="evenodd"/>`);
  for (const [t, col] of levels.slice(1)) {
    const d = regionPath(F, field, t);
    if (d) out.push(`<path d="${d}" fill="${col}" fill-rule="evenodd"${blur ? ` filter="url(#${blur})"` : ''}/>`);
  }
  if (specLevel !== undefined) {
    const sf = new Float32Array(N);
    for (let k = 0; k < N; k++) sf[k] = F.mat[k] === mat ? F.spec[k] : -1;
    const d = regionPath(F, sf, specLevel, { minArea: 2 });
    if (d) out.push(`<path d="${d}" fill="${specColor}" opacity="${specOpacity}" fill-rule="evenodd"${blur ? ` filter="url(#${blur})"` : ''}/>`);
  }
  return `<g id="${prefix}${mat}"><clipPath id="${prefix}clip-${mat}"><path d="${mask}" clip-rule="evenodd"/></clipPath><g clip-path="url(#${prefix}clip-${mat})">${out.join('')}</g></g>`;
}

// ------------------------------------------------------------------ lines: silhouettes and occlusion
// For every part, trace its outline; keep the stretches where the neighbour across the
// edge is background or lies behind by more than `jump` px. Weight from the key light.
export function lines(F, { jump = 5, color = '#2b2028', wLit = 0.6, wDark = 2.2, skip = () => false, prefix = '' } = {}) {
  const N = F.W * F.H, out = [];
  for (let p = 0; p < F.parts.length; p++) {
    if (skip(F.parts[p])) continue;
    const ind = new Float32Array(N);
    for (let k = 0; k < N; k++) ind[k] = F.part[k] === p ? 1 : 0;
    for (const loop of contours(blurField(ind, F.W, F.H, 0.9 / F.step), F.W, F.H, 0.5)) {
      if (area(loop) < 6) continue;
      const keep = [], weight = [];
      for (let q = 0; q < loop.length; q++) {
        const a = loop[(q + loop.length - 1) % loop.length], b = loop[(q + 1) % loop.length], v = loop[q];
        let nx = b[1] - a[1], ny = -(b[0] - a[0]); const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        const s = (dx) => { const i = Math.round(v[0] + nx * dx), j = Math.round(v[1] + ny * dx); return i < 0 || j < 0 || i >= F.W || j >= F.H ? -1 : j * F.W + i; };
        let kin = s(1.2), kout = s(-1.2);
        if (kin < 0 || F.part[kin] !== p) [kin, kout] = [kout, kin];
        if (kin < 0 || F.part[kin] !== p) { keep.push(false); weight.push(0); continue; }
        const behind = kout < 0 || !F.hit[kout] || F.depth[kout] < F.depth[kin] - jump;
        keep.push(behind);
        const kd = F.key[kin];
        weight.push(kd <= 0 ? wDark : wDark + (wLit - wDark) * Math.min(1, kd / 0.6));
      }
      // smooth the weight along the loop, then split runs where its rounded value changes
      const sw = weight.map((_, q) => { let a = 0, n = 0; for (let o = -5; o <= 5; o++) { const w = weight[(q + o + loop.length) % loop.length]; if (w) { a += w; n++; } } return n ? a / n : 0; });
      weight.splice(0, weight.length, ...sw);
      const qz = (w) => Math.round(w / 0.4) * 0.4;
      let run = [], rw = null;
      const flush = () => {
        if (run.length > 3) {
          const pts = rdp(run.map(([i, j]) => [F.x0 + i * F.step, F.y0 + j * F.step]), 0.4);
          const d = smooth(pts, false);
          if (d) out.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${rw}" stroke-linecap="round" stroke-linejoin="round"/>`);
        }
        run = []; rw = null;
      };
      for (let q = 0; q <= loop.length; q++) {
        const idx = q % loop.length;
        if (!keep[idx] || (rw !== null && qz(weight[idx]) !== rw)) { if (keep[idx] && run.length) { run.push(loop[idx]); } flush(); if (!keep[idx]) continue; }
        if (rw === null) rw = qz(weight[idx]);
        run.push(loop[idx]);
      }
      flush();
    }
  }
  return `<g id="${prefix}lines" opacity=".85">${out.join('')}</g>`;
}

// ------------------------------------------------------------------ feature curves
// Points in world space; keep the stretches whose depth matches the visible surface.
export function featureCurve(F, pts, { tol = 2.5, color = '#3a2630', width = 1.6, extra = '' } = {}) {
  const vis = pts.map((p) => {
    const i = Math.round((p[0] - F.x0) / F.step), j = Math.round((p[1] - F.y0) / F.step);
    if (i < 0 || j < 0 || i >= F.W || j >= F.H) return false;
    return F.hit[j * F.W + i] && p[2] >= F.depth[j * F.W + i] - tol;
  });
  const out = []; let run = [];
  pts.forEach((p, q) => { if (vis[q]) run.push([p[0], p[1]]); else { if (run.length > 1) out.push(run); run = []; } });
  if (run.length > 1) out.push(run);
  return out.map((r) => { const d = smooth(r, false); return d ? `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"${extra}/>` : ''; }).join('');
}

// Project a point to the surface of a group along a direction (bisection on the SDF).
export function onSurface(scene, from, dir, maxT = 200) {
  dir = norm(dir);
  const f = (t) => { const p = add(from, mul(dir, t)); return evalScene(relevant(scene, p[0], p[1]), p[0], p[1], p[2]); };
  let a = 0, b = maxT;
  if (f(a) > 0) return from;
  for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (f(m) > 0) b = m; else a = m; }
  return add(from, mul(dir, (a + b) / 2));
}

// ------------------------------------------------------------------ seams between materials
// Thin lines where one material meets another on a continuous surface (necklines, hems).
export function seams(F, mats, { jump = 4, color = '#2b2028', width = 0.9, prefix = '' } = {}) {
  const N = F.W * F.H, out = [];
  for (const m of mats) {
    const ind = new Float32Array(N);
    for (let k = 0; k < N; k++) ind[k] = F.mat[k] === m ? 1 : 0;
    for (const loop of contours(blurField(ind, F.W, F.H, 0.9 / F.step), F.W, F.H, 0.5)) {
      if (area(loop) < 6) continue;
      let run = [];
      const flush = () => {
        if (run.length > 3) { const d = smooth(rdp(run.map(([i, j]) => [F.x0 + i * F.step, F.y0 + j * F.step]), 0.4), false); if (d) out.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`); }
        run = [];
      };
      for (let q = 0; q < loop.length; q++) {
        const a = loop[(q + loop.length - 1) % loop.length], b = loop[(q + 1) % loop.length], v = loop[q];
        let nx = b[1] - a[1], ny = -(b[0] - a[0]); const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        const s = (dx) => { const i = Math.round(v[0] + nx * dx), j = Math.round(v[1] + ny * dx); return i < 0 || j < 0 || i >= F.W || j >= F.H ? -1 : j * F.W + i; };
        const k1 = s(1.2), k2 = s(-1.2);
        const ok = k1 >= 0 && k2 >= 0 && F.hit[k1] && F.hit[k2] && F.mat[k1] !== F.mat[k2] &&
          (F.mat[k1] === m || F.mat[k2] === m) && Math.abs(F.depth[k1] - F.depth[k2]) < jump;
        if (ok) run.push(v); else flush();
      }
      flush();
    }
  }
  return `<g id="${prefix}seams">${out.join('')}</g>`;
}
