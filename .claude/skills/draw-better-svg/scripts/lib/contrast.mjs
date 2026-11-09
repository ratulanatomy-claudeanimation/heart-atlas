// Contrast of an SVG's painted colors against the backgrounds it may sit on.
// Walks the markup, resolves fill/stroke from attributes, inline style, and
// ancestor groups, and computes WCAG 2 contrast ratios. Text below `text`
// (default 4.5:1) and graphics below `graphic` (3:1, WCAG 1.4.11) are reported.
//
// Artwork with its own opaque full-canvas background: only text is checked,
// against that background. Transparent artwork (logos, icons): text and
// graphics are checked against every preview background.
//
// Limits: complex CSS selectors, gradients, currentColor, opacity, and overlap with
// other shapes are not resolved; those paints are listed as unchecked. A shape
// on top of another shape is compared with the page background, not the shape
// beneath it, so treat findings as prompts to look, not verdicts.

const NAMED = { white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000', blue: '#0000ff', gray: '#808080', grey: '#808080', orange: '#ffa500', yellow: '#ffff00', transparent: null, none: null };
const SKIP = new Set(['defs', 'clippath', 'mask', 'pattern', 'symbol', 'marker', 'lineargradient', 'radialgradient', 'filter', 'title', 'desc', 'metadata', 'style', 'script']);
const SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'textpath', 'use']);

export function parseColor(value) {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (v in NAMED) return NAMED[v];
  let m = v.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h.slice(0, 3)].map((c) => c + c).join('');
    return `#${h.slice(0, 6)}`;
  }
  m = v.match(/^rgba?\(\s*([\d.]+)%?[\s,]+([\d.]+)%?[\s,]+([\d.]+)%?/);
  if (m) return '#' + m.slice(1, 4).map((n) => Math.round(Math.min(255, Number(n))).toString(16).padStart(2, '0')).join('');
  return 'unresolved';
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const attr = (attrs, name) => {
  const style = attrs.match(/\sstyle\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] ?? '';
  const fromStyle = style.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, 'i'))?.[1];
  return fromStyle ?? attrs.match(new RegExp(`\\s${name}\\s*=\\s*(["'])([^"']*)\\1`, 'i'))?.[2];
};

/** Paints of every visible shape: { tag, id, label, fill, stroke }. */
export function paints(svg) {
  const out = [];
  const stack = [{ fill: '#000000', stroke: null, skip: 0 }];
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|([^<]+)/g;
  let open = null;
  for (const m of svg.matchAll(re)) {
    if (m[5] !== undefined) {
      if (open && m[5].trim()) open.label = (open.label + ' ' + m[5].trim()).trim().slice(0, 40);
      continue;
    }
    const [, closing, rawTag, attrs, selfClosing] = m;
    const tag = rawTag.toLowerCase().replace(/^svg:/, '');
    if (closing) {
      if (stack.length > 1) stack.pop();
      if (tag === 'text') open = null;
      continue;
    }
    const parent = stack.at(-1);
    const fillRaw = attr(attrs, 'fill');
    const strokeRaw = attr(attrs, 'stroke');
    const node = {
      fill: fillRaw === undefined ? parent.fill : fillRaw,
      stroke: strokeRaw === undefined ? parent.stroke : strokeRaw,
      skip: parent.skip || (SKIP.has(tag) ? 1 : 0),
    };
    if (!node.skip && SHAPES.has(tag)) {
      const entry = { tag, id: attrs.match(/\sid\s*=\s*["']([^"']+)/)?.[1], label: '', fill: node.fill, stroke: node.stroke,
        d: attrs.match(/\sd\s*=\s*["']([^"']*)/)?.[1],
        classes: (attrs.match(/\sclass\s*=\s*["']([^"']*)/)?.[1] ?? '').split(/\s+/).filter(Boolean),
        box: ['x', 'y', 'width', 'height'].map((k) => attrs.match(new RegExp(`\\s${k}\\s*=\\s*["']([^"']+)`))?.[1]) };
      out.push(entry);
      if (tag === 'text') open = entry;
    }
    if (!selfClosing && tag !== '?xml') stack.push(node);
  }
  return out;
}

// Simple rules from <style>: `#id` and `.class` selectors setting fill/stroke,
// split into base rules and `@media (prefers-color-scheme: dark)` overrides.
function styleRules(svg) {
  const css = [...svg.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1].replace(/<!\[CDATA\[|\]\]>/g, '')).join('\n');
  const dark = [];
  const base = css.replace(/@media[^{]*prefers-color-scheme\s*:\s*dark[^{]*\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/gi, (_, inner) => { dark.push(inner); return ''; })
    .replace(/@media[^{]*\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/gi, '');
  const parse = (text) => {
    const rules = [];
    for (const [, sel, body] of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const decl = {};
      for (const k of ['fill', 'stroke']) {
        const v = body.match(new RegExp(`(?:^|;)\\s*${k}\\s*:\\s*([^;]+)`, 'i'))?.[1]?.replace(/!important/, '').trim();
        if (v) decl[k] = v;
      }
      if (!Object.keys(decl).length) continue;
      for (const one of sel.split(',').map((x) => x.trim())) {
        if (/^[#.][\w-]+$/.test(one)) rules.push({ sel: one, ...decl });
      }
    }
    return rules;
  };
  return { base: parse(base), dark: parse(dark.join('\n')) };
}
const matches = (p, sel) => (sel[0] === '#' ? p.id === sel.slice(1) : p.classes?.includes(sel.slice(1)));
function styled(p, rules) {
  const out = { ...p };
  for (const r of rules) {
    if (!matches(p, r.sel)) continue;
    if (r.fill) out.fill = r.fill;
    if (r.stroke) out.stroke = r.stroke;
  }
  return out;
}

/** Findings per background name. `backgrounds` maps name → hex; a name containing
 *  "dark" also applies the SVG's prefers-color-scheme: dark rules. */
export function contrastReport(svg, backgrounds, { text = 4.5, graphic = 3, viewBox } = {}) {
  const rules = styleRules(svg);
  const list = paints(svg).map((p) => styled(p, rules.base));
  // An opaque rectangle covering the whole canvas is the artwork's own background.
  const full = list.find((p) => p.tag === 'rect' && parseColor(p.fill) && parseColor(p.fill) !== 'unresolved' &&
    (p.box[2] === '100%' || (viewBox && Number(p.box[2]) >= viewBox[2] && Number(p.box[3]) >= viewBox[3])));
  const report = { ownBackground: full ? parseColor(full.fill) : null, findings: {}, unchecked: [] };
  const targets = full ? { 'own background': parseColor(full.fill) } : backgrounds;
  for (const [name, bg] of Object.entries(targets)) {
    report.findings[name] = [];
    for (const raw of list) {
      if (raw === full) continue;
      const p = /dark/.test(name) ? styled(raw, rules.dark) : raw;
      const isText = p.tag === 'text' || p.tag === 'tspan' || p.tag === 'textpath';
      // With its own background the artwork's tonal shapes are design choices and
      // often sit on other shapes; only text is judged there.
      if (full && !isText) continue;
      // A shape stays visible through its better paint: a white dot with a dark
      // outline passes. Fills of lines and single straight path segments paint nothing.
      const noArea = p.tag === 'line' || (p.tag === 'path' && /^\s*[Mm][^A-Za-z]*[HhVvLl][^A-Za-z]*$/.test(p.d ?? ''));
      let best = null;
      for (const kind of ['fill', 'stroke']) {
        if (kind === 'fill' && noArea) continue;
        const c = parseColor(p[kind]);
        if (c === null || c === undefined) continue;
        if (c === 'unresolved') {
          if (!report.unchecked.includes(p[kind])) report.unchecked.push(p[kind]);
          best = { unresolved: true };
          break;
        }
        const r = ratio(c, bg);
        if (!best || r > best.ratio) best = { paint: kind, color: c, ratio: r };
      }
      const min = isText ? text : graphic;
      if (best && !best.unresolved && best.ratio < min) {
        const who = `${p.tag}${p.id ? '#' + p.id : ''}${p.label ? ` "${p.label}"` : ''}`;
        report.findings[name].push({ element: who, paint: best.paint, color: best.color, background: bg, ratio: Math.round(best.ratio * 100) / 100, minimum: min });
      }
    }
  }
  return report;
}
