#!/usr/bin/env python3
"""Read-only structural SVG audit. No third-party packages; not a sanitizer.

Usage: python3 audit_svg.py art.svg [more.svg ...] [--profile portable|web] [--json]
Exit 0: no errors (warnings may remain); 1: errors; 2: command-line misuse.
"""
import argparse
import collections
import json
import math
import re
import sys
from pathlib import Path
import xml.etree.ElementTree as ET

SVG_NS = 'http://www.w3.org/2000/svg'
NUM = r'[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?'
URL = re.compile(r'url\(\s*[\"\']?([^\)\"\']+)[\"\']?\s*\)', re.I)
GRAPHICS = {'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'use', 'image'}
ANIMATION = {'animate', 'animateTransform', 'animateMotion', 'set'}

def local(name):
    return name.rsplit('}', 1)[-1]

def audit(path, profile='portable'):
    report = {'file': str(path), 'profile': profile, 'errors': [], 'warnings': [],
              'features': [], 'counts': {}, 'limits': 'No path grammar, computed CSS, layout, visual, or security certification.'}
    errors, warnings = report['errors'], report['warnings']
    try:
        if path.stat().st_size > 10 * 1024 * 1024:
            raise ValueError('Input exceeds the 10 MiB audit limit.')
        raw = path.read_bytes()
        # Reject declarations before XML parsing, including UTF-16/32 encodings.
        probe = raw.replace(b'\x00', b'').upper()
        if b'<!DOCTYPE' in probe or b'<!ENTITY' in probe:
            raise ValueError('DTD/entity declarations are outside this audit profile.')
        root = ET.fromstring(raw)
    except (OSError, ET.ParseError, ValueError) as exc:
        errors.append(str(exc))
        return report
    report['bytes'] = len(raw)
    if root.tag != f'{{{SVG_NS}}}svg':
        errors.append('Standalone root must be svg in the SVG namespace.')
    vb = root.get('viewBox', '')
    try:
        values = [float(x) for x in re.split(r'[\s,]+', vb.strip()) if x]
        if len(values) != 4 or not all(math.isfinite(x) for x in values) or min(values[2:]) <= 0:
            raise ValueError()
        report['viewBox'] = values
    except ValueError:
        errors.append('viewBox must contain four finite numbers with positive width and height.')
    counts = collections.Counter(local(el.tag) for el in root.iter())
    report['counts'] = dict(sorted(counts.items()))
    report['graphics_elements'] = sum(counts[k] for k in GRAPHICS)
    ids, references = set(), []
    for el in root.iter():
        tag = local(el.tag)
        label = f'{tag}#{el.get("id")}' if el.get('id') else tag
        ident = el.get('id')
        if ident:
            if ident in ids:
                errors.append(f'Duplicate ID: {ident}')
            ids.add(ident)
        if tag == 'path' and not el.get('d', '').strip():
            errors.append(f'{label}: empty path data.')
        if tag in {'script', 'foreignObject', 'image'}:
            target = errors if profile == 'portable' else warnings
            target.append(f'{label}: {tag} needs explicit delivery-context review.')
        if tag in {'style'}:
            css = ''.join(el.itertext())
            if '@import' in css.lower():
                (errors if profile == 'portable' else warnings).append('CSS @import dependency.')
            for target in URL.findall(css):
                references.append((label, target.strip()))
            if '@keyframes' in css.lower() and 'css-animation' not in report['features']:
                report['features'].append('css-animation')
        for key, value in el.attrib.items():
            attr = local(key)
            if attr.lower().startswith('on'):
                (errors if profile == 'portable' else warnings).append(f'{label}: event handler {attr}.')
            if attr in {'href', 'src'}:
                references.append((label, value.strip()))
            if attr in {'aria-labelledby', 'aria-describedby'}:
                references.extend((label, '#' + item) for item in value.split())
            references.extend((label, x.strip()) for x in URL.findall(value))
            if attr in {'d', 'points', 'transform', 'viewBox', 'x', 'y', 'r', 'rx', 'ry', 'width', 'height'}:
                if re.search(r'(?<![A-Za-z])(?:nan|[+-]?inf(?:inity)?)(?![A-Za-z])', value, re.I):
                    errors.append(f'{label}: non-finite value in {attr}.')
            if attr in {'r', 'rx', 'ry', 'width', 'height', 'stroke-width'} and re.fullmatch(NUM, value):
                if float(value) < 0:
                    errors.append(f'{label}: negative {attr}.')
    for label, target in references:
        if target.startswith('#'):
            if target[1:] not in ids:
                errors.append(f'{label}: missing local reference {target}.')
        elif target:
            (errors if profile == 'portable' else warnings).append(f'{label}: non-local reference needs review.')
    if not report['graphics_elements']:
        warnings.append('No graphics elements found; check symbols, defs, and external use context.')
    if counts['text']:
        report['features'].append('live-text')
        warnings.append('Verify font availability, glyphs, and wrapping in the target renderer.')
    if counts['image']:
        report['features'].append('raster-hybrid')
    if any(counts[t] for t in ANIMATION):
        report['features'].append('smil-animation')
        warnings.append('Static rendering cannot validate motion or reduced-motion behavior.')
    for feature, tags in [('effects', {'filter', 'mask', 'clipPath'}),
                          ('reusable-definitions', {'symbol', 'use', 'pattern'}),
                          ('gradient-fills', {'linearGradient', 'radialGradient'})]:
        if any(counts[t] for t in tags):
            report['features'].append(feature)
    if counts['filter']:
        warnings.append('Inspect filter bounds and target-renderer support.')
    if root.get('aria-hidden') != 'true' and not (counts['title'] or root.get('aria-label')):
        warnings.append('Choose informative naming or decorative aria-hidden for the embedding context.')
    if report['graphics_elements'] > 1500:
        warnings.append('Large element count: inspect editability and performance; this is not an automatic defect.')
    report['errors'] = list(dict.fromkeys(errors))
    report['warnings'] = list(dict.fromkeys(warnings))
    return report

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('files', nargs='+', type=Path)
    p.add_argument('--profile', choices=['portable', 'web'], default='portable')
    p.add_argument('--json', action='store_true')
    args = p.parse_args()
    reports = [audit(path, args.profile) for path in args.files]
    if args.json:
        print(json.dumps(reports, indent=2, ensure_ascii=False))
    else:
        for report in reports:
            print(f"{report['file']}: {len(report['errors'])} errors, {len(report['warnings'])} warnings")
            print('  Features: ' + ', '.join(report['features'] or ['basic vector structure']))
            for kind in ['errors', 'warnings']:
                for item in report[kind]:
                    print(f'  {kind[:-1].upper()}: {item}')
    return 1 if any(r['errors'] for r in reports) else 0

if __name__ == '__main__':
    sys.exit(main())
