#!/usr/bin/env python3
"""Geometry audit for SVG path data. Standard library only; read-only.

Finds contour defects that XML checks cannot see:
  near-kink    two segments meet almost, but not quite, tangentially (a visible
               bump in a curve); clean corners and exact tangents are not flagged
  staircase    a run of short alternating horizontal/vertical lines (pixel trace)
  faceted      a run of short straight lines turning gently in one direction
               (a curve approximated by a polyline)
  tiny         segments too short to matter at the canvas scale (noisy anchors)
  long-handle  a cubic handle much longer than its chord (loops, overshoot)
  malformed    path data that does not parse (reported as an error)

Usage:
  python3 path_audit.py art.svg [--json] [--svg-out handles.svg] [--budget N]
                        [--smooth 1.5] [--corner 20] [--strict]
Exit 0: no errors (warnings may remain; --strict fails on warnings);
     1: errors, or warnings with --strict; 2: command-line misuse.

Angles are measured in each path's local coordinates; a non-uniform scale
transform on an ancestor changes them. The report is evidence for review, not
a verdict: a deliberate corner below --corner degrees is reported as a near-kink.

The idea of auditing joins and short segments with a handle overlay comes from
nolangz/pixel2motion (scripts/svg_path_audit.py, MIT); this implementation is
independent and covers all path commands.
"""
import argparse
import json
import math
import re
import sys
from pathlib import Path
import xml.etree.ElementTree as ET

SVG_NS = 'http://www.w3.org/2000/svg'
NUMBER = re.compile(r'[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?')
PARAMS = {'M': 2, 'L': 2, 'H': 1, 'V': 1, 'C': 6, 'S': 4, 'Q': 4, 'T': 2, 'A': 7, 'Z': 0}


class PathError(ValueError):
    pass


def local(tag):
    return tag.rsplit('}', 1)[-1]


# ------------------------------------------------------------------ parsing

def tokenize(d):
    """Yield (command, [numbers]) groups. Arc flags may be packed ("a1 1 0 00 1 1")."""
    i, n = 0, len(d)
    cmd = None
    while True:
        while i < n and (d[i].isspace() or d[i] == ','):
            i += 1
        if i >= n:
            return
        if d[i].isalpha():
            cmd = d[i]
            if cmd.upper() not in PARAMS:
                raise PathError(f'unknown command "{cmd}" at offset {i}')
            i += 1
            if cmd.upper() == 'Z':
                yield cmd, []
                continue
        elif cmd is None:
            raise PathError('path data must start with a command')
        elif cmd.upper() == 'Z':
            raise PathError(f'numbers after Z at offset {i}')
        count = PARAMS[cmd.upper()]
        args = []
        for k in range(count):
            while i < n and (d[i].isspace() or d[i] == ','):
                i += 1
            if cmd.upper() == 'A' and k in (3, 4):
                if i < n and d[i] in '01':
                    args.append(float(d[i]))
                    i += 1
                    continue
                raise PathError(f'arc flag must be 0 or 1 at offset {i}')
            m = NUMBER.match(d, i)
            if not m:
                raise PathError(f'expected {count} numbers for "{cmd}" at offset {i}')
            args.append(float(m.group()))
            i = m.end()
        if not all(math.isfinite(a) for a in args):
            raise PathError(f'non-finite number for "{cmd}"')
        yield cmd, args
        if cmd == 'M':
            cmd = 'L'
        elif cmd == 'm':
            cmd = 'l'


def arc_to_cubics(p0, rx, ry, phi_deg, large, sweep, p1):
    """SVG arc (endpoint form) to cubic segments of at most 90 degrees each."""
    if p0 == p1:
        return []
    rx, ry = abs(rx), abs(ry)
    if rx == 0 or ry == 0:
        return [('L', p0, p1)]
    phi = math.radians(phi_deg % 360)
    cp, sp = math.cos(phi), math.sin(phi)
    dx, dy = (p0[0] - p1[0]) / 2, (p0[1] - p1[1]) / 2
    x1 = cp * dx + sp * dy
    y1 = -sp * dx + cp * dy
    lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
    if lam > 1:
        s = math.sqrt(lam)
        rx, ry = rx * s, ry * s
    num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
    den = rx * rx * y1 * y1 + ry * ry * x1 * x1
    coef = math.sqrt(max(0.0, num / den)) if den else 0.0
    if large == sweep:
        coef = -coef
    cxp, cyp = coef * rx * y1 / ry, -coef * ry * x1 / rx
    cx = cp * cxp - sp * cyp + (p0[0] + p1[0]) / 2
    cy = sp * cxp + cp * cyp + (p0[1] + p1[1]) / 2

    def angle(ux, uy, vx, vy):
        a = math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
        return a

    t1 = angle(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry)
    dt = angle((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry)
    if not sweep and dt > 0:
        dt -= 2 * math.pi
    elif sweep and dt < 0:
        dt += 2 * math.pi
    pieces = max(1, math.ceil(abs(dt) / (math.pi / 2) - 1e-9))
    step = dt / pieces
    k = 4 / 3 * math.tan(step / 4)

    def point(t):
        x, y = rx * math.cos(t), ry * math.sin(t)
        return (cp * x - sp * y + cx, sp * x + cp * y + cy)

    def deriv(t):
        x, y = -rx * math.sin(t), ry * math.cos(t)
        return (cp * x - sp * y, sp * x + cp * y)

    out, start = [], p0
    for i in range(pieces):
        a, b = t1 + i * step, t1 + (i + 1) * step
        end = p1 if i == pieces - 1 else point(b)
        da, db = deriv(a), deriv(b)
        c1 = (start[0] + k * da[0], start[1] + k * da[1])
        c2 = (end[0] - k * db[0], end[1] - k * db[1])
        out.append(('C', start, c1, c2, end))
        start = end
    return out


def parse(d):
    """Return a list of subpaths: {'segments': [...], 'closed': bool}.
    Segments are ('L', p0, p1) or ('C', p0, c1, c2, p1) in absolute coordinates."""
    subpaths = []
    cur = start = (0.0, 0.0)
    seg = None
    prev_cmd, prev_ctrl = None, None
    for cmd, a in tokenize(d):
        up, rel = cmd.upper(), cmd.islower()
        ox, oy = (cur if rel else (0.0, 0.0))
        if up == 'M':
            cur = start = (a[0] + ox, a[1] + oy)
            seg = {'segments': [], 'closed': False}
            subpaths.append(seg)
            prev_cmd = 'M'
            continue
        if seg is None:
            raise PathError('drawing command before the first moveto')
        if seg['closed']:
            seg = {'segments': [], 'closed': False}
            subpaths.append(seg)
        if up == 'Z':
            if math.dist(cur, start) > 1e-9:
                seg['segments'].append(('L', cur, start))
            seg['closed'] = True
            cur = start
            prev_cmd = 'Z'
            continue
        if up in 'LHV':
            if up == 'L':
                end = (a[0] + ox, a[1] + oy)
            elif up == 'H':
                end = (a[0] + ox, cur[1])
            else:
                end = (cur[0], a[0] + oy)
            seg['segments'].append(('L', cur, end))
            cur, prev_cmd = end, up
            continue
        if up in 'CS':
            if up == 'C':
                c1 = (a[0] + ox, a[1] + oy)
                c2, end = (a[2] + ox, a[3] + oy), (a[4] + ox, a[5] + oy)
            else:
                c1 = (2 * cur[0] - prev_ctrl[0], 2 * cur[1] - prev_ctrl[1]) if prev_cmd in ('C', 'S') else cur
                c2, end = (a[0] + ox, a[1] + oy), (a[2] + ox, a[3] + oy)
            seg['segments'].append(('C', cur, c1, c2, end))
            cur, prev_ctrl, prev_cmd = end, c2, up
            continue
        if up in 'QT':
            if up == 'Q':
                q, end = (a[0] + ox, a[1] + oy), (a[2] + ox, a[3] + oy)
            else:
                q = (2 * cur[0] - prev_ctrl[0], 2 * cur[1] - prev_ctrl[1]) if prev_cmd in ('Q', 'T') else cur
                end = (a[0] + ox, a[1] + oy)
            c1 = (cur[0] + 2 / 3 * (q[0] - cur[0]), cur[1] + 2 / 3 * (q[1] - cur[1]))
            c2 = (end[0] + 2 / 3 * (q[0] - end[0]), end[1] + 2 / 3 * (q[1] - end[1]))
            seg['segments'].append(('C', cur, c1, c2, end))
            cur, prev_ctrl, prev_cmd = end, q, up
            continue
        if up == 'A':
            end = (a[5] + ox, a[6] + oy)
            seg['segments'].extend(arc_to_cubics(cur, a[0], a[1], a[2], bool(a[3]), bool(a[4]), end))
            cur, prev_cmd = end, 'A'
    return [s for s in subpaths if s['segments']]


def points_attr(value):
    nums = [float(x) for x in NUMBER.findall(value or '')]
    return list(zip(nums[0::2], nums[1::2]))


# ------------------------------------------------------------------ geometry

def seg_len(s):
    if s[0] == 'L':
        return math.dist(s[1], s[2])
    pts = [cubic_at(s, i / 16) for i in range(17)]
    return sum(math.dist(pts[i], pts[i + 1]) for i in range(16))


def cubic_at(s, t):
    p0, c1, c2, p1 = s[1], s[2], s[3], s[4]
    mt = 1 - t
    return tuple(mt ** 3 * p0[k] + 3 * mt * mt * t * c1[k] + 3 * mt * t * t * c2[k] + t ** 3 * p1[k] for k in (0, 1))


def tangent_out(s):
    """Direction leaving the segment's end point, skipping degenerate handles."""
    if s[0] == 'L':
        return (s[2][0] - s[1][0], s[2][1] - s[1][1])
    for a in (s[3], s[2], s[1]):
        v = (s[4][0] - a[0], s[4][1] - a[1])
        if math.hypot(*v) > 1e-9:
            return v
    return (0.0, 0.0)


def tangent_in(s):
    if s[0] == 'L':
        return (s[2][0] - s[1][0], s[2][1] - s[1][1])
    end = s[4]
    for b in (s[2], s[3], end):
        v = (b[0] - s[1][0], b[1] - s[1][1])
        if math.hypot(*v) > 1e-9:
            return v
    return (0.0, 0.0)


def turn(u, v):
    """Signed angle in degrees from u to v; None when either is zero."""
    lu, lv = math.hypot(*u), math.hypot(*v)
    if lu < 1e-9 or lv < 1e-9:
        return None
    cross = u[0] * v[1] - u[1] * v[0]
    dot = u[0] * v[0] + u[1] * v[1]
    return math.degrees(math.atan2(cross, dot))


def start_point(s):
    return s[1]


def end_point(s):
    return s[2] if s[0] == 'L' else s[4]


def axis(s):
    if s[0] != 'L':
        return None
    dx, dy = s[2][0] - s[1][0], s[2][1] - s[1][1]
    if abs(dy) <= 1e-6 * max(1.0, abs(dx)) and abs(dx) > 0:
        return 'h'
    if abs(dx) <= 1e-6 * max(1.0, abs(dy)) and abs(dy) > 0:
        return 'v'
    return None


def rnd(p):
    return [round(p[0], 2), round(p[1], 2)]


# ------------------------------------------------------------------ audit

def audit_subpath(sub, diag, opt, label, found):
    segs = sub['segments']
    short = opt.short * diag
    facet_len = opt.facet_length * diag
    tiny = opt.tiny * diag
    pairs = list(zip(segs, segs[1:]))
    if sub['closed'] and len(segs) > 1 and math.dist(end_point(segs[-1]), start_point(segs[0])) < 1e-6:
        pairs.append((segs[-1], segs[0]))

    corners = 0
    for left, right in pairs:
        if math.dist(end_point(left), start_point(right)) > 1e-6:
            continue
        a = turn(tangent_out(left), tangent_in(right))
        if a is None:
            continue
        a = abs(a)
        curved = left[0] == 'C' or right[0] == 'C'
        if a >= opt.corner:
            corners += 1
        elif a > opt.smooth and curved:
            found['near-kink'].append({'path': label, 'at': rnd(start_point(right)), 'angle': round(a, 2)})

    for s in segs:
        length = seg_len(s)
        if length < tiny:
            found['tiny'].append({'path': label, 'at': rnd(start_point(s)), 'length': round(length, 4)})
        if s[0] == 'C':
            chord = math.dist(s[1], s[4])
            h = max(math.dist(s[1], s[2]), math.dist(s[3], s[4]))
            if chord > 1e-9 and h > opt.handle * chord:
                found['long-handle'].append({'path': label, 'at': rnd(s[1]), 'handle_to_chord': round(h / chord, 2)})

    # Staircase: consecutive short lines alternating h/v.
    run = []
    for s in segs + [None]:
        ax = axis(s) if s is not None else None
        ok = ax is not None and seg_len(s) < short and (not run or axis(run[-1]) != ax)
        if ok:
            run.append(s)
            continue
        if len(run) >= opt.stair:
            found['staircase'].append({'path': label, 'at': rnd(start_point(run[0])), 'segments': len(run)})
        run = [s] if ax is not None and seg_len(s) < short else []

    # Faceted curve: consecutive short lines turning gently in the same direction.
    run, sign = [], 0
    lines = segs + [None]
    for i, s in enumerate(lines):
        extend = False
        if s is not None and s[0] == 'L' and seg_len(s) < facet_len and axis(s) is None:
            if run:
                a = turn(tangent_out(run[-1]), tangent_in(s))
                if a is not None and opt.smooth < abs(a) < opt.corner and (sign == 0 or (a > 0) == (sign > 0)):
                    sign = 1 if a > 0 else -1
                    extend = True
            if extend:
                run.append(s)
                continue
        if len(run) >= opt.facet:
            found['faceted'].append({'path': label, 'at': rnd(start_point(run[0])), 'segments': len(run)})
        run, sign = ([s] if s is not None and s[0] == 'L' and seg_len(s) < facet_len and axis(s) is None else []), 0
    return corners


def view_box(root):
    vb = [float(x) for x in NUMBER.findall(root.get('viewBox', ''))]
    if len(vb) == 4 and vb[2] > 0 and vb[3] > 0:
        return vb
    w = float((NUMBER.findall(root.get('width', '')) or ['0'])[0])
    h = float((NUMBER.findall(root.get('height', '')) or ['0'])[0])
    return [0, 0, w or 100, h or 100]


def audit(path, opt):
    report = {'file': str(path), 'errors': [], 'warnings': [], 'paths': [],
              'limits': 'Local coordinates; transforms and stroke outlines are not applied.'}
    try:
        raw = path.read_bytes()
        probe = raw.replace(b'\x00', b'').upper()
        if b'<!DOCTYPE' in probe or b'<!ENTITY' in probe:
            raise ValueError('DTD/entity declarations are outside this audit profile.')
        root = ET.fromstring(raw)
    except (OSError, ET.ParseError, ValueError) as exc:
        report['errors'].append(str(exc))
        return report, None
    vb = view_box(root)
    diag = math.hypot(vb[2], vb[3])
    report['viewBox'] = vb
    found = {k: [] for k in ('near-kink', 'staircase', 'faceted', 'tiny', 'long-handle')}
    geometry = []
    for index, el in enumerate(e for e in root.iter() if local(e.tag) in ('path', 'polyline', 'polygon')):
        tag = local(el.tag)
        label = f'{tag}#{el.get("id")}' if el.get('id') else f'{tag}[{index}]'
        try:
            if tag == 'path':
                subs = parse(el.get('d', ''))
            else:
                pts = points_attr(el.get('points'))
                segs = [('L', pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
                if tag == 'polygon' and len(pts) > 2 and pts[0] != pts[-1]:
                    segs.append(('L', pts[-1], pts[0]))
                subs = [{'segments': segs, 'closed': tag == 'polygon'}] if segs else []
        except PathError as exc:
            report['errors'].append(f'{label}: malformed path data: {exc}')
            continue
        corners = sum(audit_subpath(s, diag, opt, label, found) for s in subs)
        segs = [s for sub in subs for s in sub['segments']]
        cubic = sum(1 for s in segs if s[0] == 'C')
        report['paths'].append({'path': label, 'subpaths': len(subs), 'segments': len(segs),
                                'cubic': cubic, 'lines': len(segs) - cubic, 'corners': corners})
        if opt.budget is not None and cubic > opt.budget:
            report['warnings'].append(f'{label}: {cubic} cubic segments exceed the chosen budget of {opt.budget}.')
        geometry.append((label, subs))
    report['findings'] = found
    messages = {
        'near-kink': lambda f: f'{f["path"]}: near-kink of {f["angle"]}° at {f["at"]} (smooth the handles or make a real corner).',
        'staircase': lambda f: f'{f["path"]}: staircase of {f["segments"]} axis-aligned steps from {f["at"]} (pixel trace; refit with curves).',
        'faceted': lambda f: f'{f["path"]}: {f["segments"]} short straight lines approximate a curve from {f["at"]} (replace with a cubic).',
        'tiny': lambda f: f'{f["path"]}: tiny segment ({f["length"]}) at {f["at"]} (merge or remove the anchor).',
        'long-handle': lambda f: f'{f["path"]}: handle {f["handle_to_chord"]}× its chord at {f["at"]} (risk of loop or overshoot).',
    }
    for kind, items in found.items():
        report['warnings'].extend(messages[kind](f) for f in items[:opt.limit])
        if len(items) > opt.limit:
            report['warnings'].append(f'… {len(items) - opt.limit} more {kind} findings in the JSON report.')
    report['summary'] = {k: len(v) for k, v in found.items()}
    return report, (vb, geometry, found)


# ------------------------------------------------------------------ overlay

PALETTE = ['#2563eb', '#16a34a', '#9333ea', '#0891b2', '#ca8a04', '#db2777']


def overlay(vb, geometry, found):
    x, y, w, h = vb
    u = math.hypot(w, h) / 400
    f = lambda p: f'{p[0]:.2f} {p[1]:.2f}'
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x:g} {y:g} {w:g} {h:g}" width="{min(1200, max(400, w * 3)):.0f}">',
           f'<rect x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" fill="#ffffff"/>',
           f'<g fill="none" stroke-linecap="round" stroke-width="{1.6 * u:.3f}">']
    handles, anchors = [], []
    n = 0
    for _, subs in geometry:
        for sub in subs:
            for s in sub['segments']:
                color = PALETTE[n % len(PALETTE)]
                n += 1
                if s[0] == 'L':
                    out.append(f'<path d="M{f(s[1])} L{f(s[2])}" stroke="{color}"/>')
                else:
                    out.append(f'<path d="M{f(s[1])} C{f(s[2])} {f(s[3])} {f(s[4])}" stroke="{color}"/>')
                    handles.append(f'M{f(s[1])} L{f(s[2])} M{f(s[4])} L{f(s[3])}')
                    anchors.extend([s[2], s[3]])
    out.append('</g>')
    if handles:
        out.append(f'<path d="{" ".join(handles)}" fill="none" stroke="#94a3b8" stroke-width="{0.7 * u:.3f}"/>')
        out.append('<g fill="#94a3b8">' + ''.join(f'<circle cx="{p[0]:.2f}" cy="{p[1]:.2f}" r="{1.3 * u:.3f}"/>' for p in anchors) + '</g>')
    marks = {'near-kink': '#dc2626', 'staircase': '#ea580c', 'faceted': '#ea580c', 'tiny': '#c026d3', 'long-handle': '#0f766e'}
    for kind, items in found.items():
        for item in items:
            p = item['at']
            out.append(f'<circle cx="{p[0]}" cy="{p[1]}" r="{5 * u:.3f}" fill="none" stroke="{marks[kind]}" stroke-width="{1.4 * u:.3f}"><title>{kind}</title></circle>')
    out.append('</svg>')
    return '\n'.join(out) + '\n'


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('file', type=Path)
    p.add_argument('--json', action='store_true')
    p.add_argument('--svg-out', type=Path, help='write a segment/handle overlay SVG with findings circled')
    p.add_argument('--budget', type=int, help='maximum cubic segments per path for this artwork')
    p.add_argument('--smooth', type=float, default=3.0, help='joins turning less than this are smooth (degrees)')
    p.add_argument('--corner', type=float, default=20.0, help='joins turning at least this much are deliberate corners')
    p.add_argument('--tiny', type=float, default=0.002, help='tiny segment, as a fraction of the viewBox diagonal')
    p.add_argument('--short', type=float, default=0.02, help='short segment for staircase/facet runs, fraction of the diagonal')
    p.add_argument('--facet-length', type=float, default=0.06, help='longest line in a faceted-curve run, fraction of the diagonal')
    p.add_argument('--stair', type=int, default=6, help='minimum steps in a staircase run')
    p.add_argument('--facet', type=int, default=5, help='minimum lines in a faceted-curve run')
    p.add_argument('--handle', type=float, default=1.5, help='long handle when longer than this × chord')
    p.add_argument('--limit', type=int, default=8, help='warnings listed per kind in text output')
    p.add_argument('--strict', action='store_true', help='exit 1 when warnings remain')
    opt = p.parse_args()
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if not (0 <= opt.smooth < opt.corner <= 180):
        p.error('need 0 <= --smooth < --corner <= 180')
    report, geo = audit(opt.file, opt)
    if opt.svg_out and geo:
        opt.svg_out.parent.mkdir(parents=True, exist_ok=True)
        opt.svg_out.write_text(overlay(*geo), encoding='utf-8')
        report['overlay'] = str(opt.svg_out)
    if opt.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print(f"{report['file']}: {len(report['errors'])} errors, {len(report['warnings'])} warnings")
        for row in report['paths']:
            print(f"  {row['path']}: {row['segments']} segments ({row['cubic']} cubic), {row['corners']} corners")
        for kind in ('errors', 'warnings'):
            for item in report[kind]:
                print(f'  {kind[:-1].upper()}: {item}')
    if report['errors'] or (opt.strict and report['warnings']):
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
