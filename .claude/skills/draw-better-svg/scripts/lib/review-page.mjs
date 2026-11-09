// The review page: one screen, usage first. The drawing fills the canvas with a
// small floating toolbar (Comment, Draw, Arrow, color, Undo); one timeline plays
// the motion or the construction; the Notes panel collects comments and sends
// them. Checks and target sizes open on demand in dialogs.
//
// Native building blocks (modern-web-guidance): color-scheme with light-dark()
// tokens and a prefers-color-scheme fallback; a canvas-local color-scheme for the
// background switch; Popover API menus positioned by script (anchor positioning
// is not yet available everywhere) with a class fallback; <dialog closedby="any">
// with the click-outside fallback.
import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrastReport } from './contrast.mjs';
import { BACKGROUNDS, esc, inlineSvg, viewBoxOf, safeCss, safeJs, motionLint, runAudit } from './preview-page.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const STAGE_RUNTIME = readFileSync(join(HERE, 'stage-runtime.js'), 'utf8');
const REVIEW_UI = readFileSync(join(HERE, 'review-ui.js'), 'utf8');

const icon = (d, extra = '') => `<svg aria-hidden="true" viewBox="0 0 24 24" ${extra}><path d="${d}"/></svg>`;
const ICONS = {
  comment: icon('M4 5h16v11H9l-5 4z'),
  pen: icon('M4 20l4-1 11-11-3-3L5 16zM14 6l3 3'),
  arrow: icon('M5 19L19 5M10 5h9v9'),
  undo: icon('M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-2'),
  play: icon('M8 5v14l11-7z', 'class="i-play"'),
  pause: icon('M8 5v14M16 5v14', 'class="i-pause"'),
  check: icon('M5 12l4 4L19 6'),
  alert: icon('M12 4l9 16H3zM12 10v4M12 17v.5'),
  sizes: icon('M4 4h7v7H4zM14 4h6v6h-6zM14 14h6v6h-6zM4 14h7v6H4z'),
};

// Popover placement and fallbacks, dialog light-dismiss fallback, background switch.
const CHROME_RUNTIME = `
(() => {
  const hasPopover = 'popover' in HTMLElement.prototype;
  for (const trigger of document.querySelectorAll('[data-pop]')) {
    const pop = document.getElementById(trigger.dataset.pop);
    const place = () => {
      const r = trigger.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
      const above = r.top - h - 8 > 0;
      pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
      pop.style.top = (above ? r.top - h - 8 : r.bottom + 8) + 'px';
    };
    if (hasPopover) {
      pop.addEventListener('toggle', (e) => { trigger.setAttribute('aria-expanded', String(e.newState === 'open')); if (e.newState === 'open') place(); });
      trigger.addEventListener('click', () => pop.togglePopover());
    } else {
      trigger.addEventListener('click', () => { const open = pop.classList.toggle('is-open'); trigger.setAttribute('aria-expanded', String(open)); if (open) place(); });
      pop.hidePopover = () => { pop.classList.remove('is-open'); trigger.setAttribute('aria-expanded', 'false'); };
    }
  }
  for (const b of document.querySelectorAll('[data-dialog]')) {
    const dlg = document.getElementById(b.dataset.dialog);
    b.addEventListener('click', () => dlg.showModal());
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      dlg.addEventListener('click', (e) => {
        if (e.target !== dlg) return;
        const r = dlg.getBoundingClientRect();
        if (r.top <= e.clientY && e.clientY <= r.bottom && r.left <= e.clientX && e.clientX <= r.right) return;
        dlg.close();
      });
    }
  }
  const canvas = document.querySelector('.canvas');
  for (const b of document.querySelectorAll('[data-bg]')) {
    b.addEventListener('click', () => {
      canvas.dataset.canvasBg = b.dataset.bg;
      for (const x of document.querySelectorAll('[data-bg]')) x.setAttribute('aria-pressed', String(x === b));
      try { localStorage.setItem('dbs-canvas-bg', b.dataset.bg); } catch {}
    });
  }
  try { const saved = localStorage.getItem('dbs-canvas-bg'); if (saved) document.querySelector('[data-bg="' + saved + '"]')?.click(); } catch {}
})();`;

const CSS = `
:root{
  --paper-l:#ffffff;--paper-d:#161b1f;--bg-l:#f4f2ee;--bg-d:#0f1316;--fg-l:#1d2327;--fg-d:#e9e6e0;
  --muted-l:#626b70;--muted-d:#98a3a8;--line-l:#e2ddd4;--line-d:#2a343a;--accent-l:#6d28d9;--accent-d:#a78bfa;
  --float-l:rgba(255,255,255,.92);--float-d:rgba(24,30,34,.92);--warn-l:#9a4a00;--warn-d:#f3b36b;
  --paper:var(--paper-l);--bg:var(--bg-l);--fg:var(--fg-l);--muted:var(--muted-l);--line:var(--line-l);--accent:var(--accent-l);--float:var(--float-l);--warn:var(--warn-l);
  color-scheme:light dark;
}
@media (prefers-color-scheme:dark){:root{--paper:var(--paper-d);--bg:var(--bg-d);--fg:var(--fg-d);--muted:var(--muted-d);--line:var(--line-d);--accent:var(--accent-d);--float:var(--float-d);--warn:var(--warn-d)}}
@supports (color:light-dark(white,black)){:root{
  --paper:light-dark(var(--paper-l),var(--paper-d));--bg:light-dark(var(--bg-l),var(--bg-d));--fg:light-dark(var(--fg-l),var(--fg-d));
  --muted:light-dark(var(--muted-l),var(--muted-d));--line:light-dark(var(--line-l),var(--line-d));--accent:light-dark(var(--accent-l),var(--accent-d));
  --float:light-dark(var(--float-l),var(--float-d));--warn:light-dark(var(--warn-l),var(--warn-d))}}
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{display:grid;grid-template-rows:auto 1fr;height:100dvh;overflow:hidden;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,sans-serif;accent-color:var(--accent)}
[hidden]{display:none!important}
button{font:inherit;color:inherit;cursor:pointer}
svg[aria-hidden]{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.btn{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border:1px solid var(--line);border-radius:8px;background:var(--paper)}
.btn.primary{background:var(--fg);color:var(--paper);border-color:var(--fg)}
.btn:disabled{opacity:.45;cursor:default}
.icon-btn{display:inline-grid;place-items:center;width:32px;height:32px;padding:0;border:0;border-radius:8px;background:transparent}
.icon-btn:hover{background:color-mix(in srgb,var(--fg) 8%,transparent)}
.seg{display:inline-flex;flex:none;padding:2px;border:1px solid var(--line);border-radius:9px;background:var(--paper)}
.seg button{border:0;background:transparent;padding:5px 10px;border-radius:7px}
.seg button[aria-pressed=true]{background:var(--fg);color:var(--paper)}
/* header */
.topbar{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--line);background:var(--paper);min-width:0}
.title{min-width:0;margin-inline-end:auto}.title strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.title span{color:var(--muted);font-size:12px;white-space:nowrap}
.chip{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;white-space:nowrap;flex:none;border:1px solid var(--line);border-radius:999px;background:var(--paper)}
.chip.warn{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 45%,var(--line))}
.swatch-bg{display:inline-block;vertical-align:-3px;width:14px;height:14px;border-radius:4px;border:1px solid var(--line)}
/* workspace */
.workspace{display:grid;grid-template-columns:minmax(0,1fr) 340px;grid-template-rows:minmax(0,1fr) auto;grid-template-areas:"canvas panel" "timeline panel";min-height:0}
.canvas{grid-area:canvas;position:relative;min-height:0;display:grid;place-items:center;padding:56px 24px 84px;background:#f8f5ee;color-scheme:only light}
.canvas[data-canvas-bg=dark]{background:#17242b;color-scheme:only dark}
.canvas[data-canvas-bg=transparent]{background:conic-gradient(#e6e6e6 25%,#fff 0 50%,#e6e6e6 0 75%,#fff 0) 0 0/18px 18px;color-scheme:only light}
.canvas>*{color:var(--fg)}
#dbs-stage{width:100%;height:100%;min-height:0;display:grid;place-items:center}
#dbs-stage>svg{width:100%;height:100%;max-width:960px;overflow:hidden}
.canvas[data-tool=comment] #dbs-stage>svg,.canvas[data-tool=pen] #dbs-stage>svg,.canvas[data-tool=arrow] #dbs-stage>svg{cursor:crosshair;touch-action:none}
#dbs-pins>g{cursor:pointer}
.stage-mode{position:absolute;inset-block-start:12px;inset-inline-start:12px}
.tools{position:absolute;inset-block-end:16px;inset-inline:0;margin-inline:auto;width:max-content;max-width:calc(100% - 24px);display:flex;align-items:center;gap:2px;padding:5px;border-radius:14px;background:var(--float);box-shadow:0 6px 24px rgba(0,0,0,.16),0 0 0 1px var(--line);backdrop-filter:blur(8px)}
.tools button{display:inline-flex;align-items:center;gap:6px;padding:7px 11px;border:0;border-radius:10px;background:transparent}
.tools button:hover{background:color-mix(in srgb,var(--fg) 8%,transparent)}
.tools button[aria-pressed=true]{background:var(--fg);color:var(--paper)}
.tools .sep{width:1px;align-self:stretch;margin:4px 3px;background:var(--line)}
.dot{width:16px;height:16px;border-radius:50%;background:var(--swatch,#e5484d);box-shadow:0 0 0 2px var(--float),0 0 0 3px var(--line)}
.banner{position:absolute;inset-block-start:12px;inset-inline:0;margin-inline:auto;width:max-content;max-width:calc(100% - 24px);display:flex;gap:10px;align-items:center;padding:8px 12px;border-radius:10px;background:#fef3c7;color:#713f12}
.ask{position:absolute;z-index:3;display:flex;gap:6px;padding:6px;border-radius:12px;background:var(--float);box-shadow:0 8px 28px rgba(0,0,0,.22),0 0 0 1px var(--line)}
.ask input{width:min(260px,60vw);padding:7px 9px;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--fg);font:inherit}
/* timeline */
.timeline{grid-area:timeline;display:flex;align-items:center;gap:10px;padding:8px 16px;border-top:1px solid var(--line);background:var(--paper)}
.timeline .i-pause,#tl-play[aria-pressed=true] .i-play{display:none}#tl-play[aria-pressed=true] .i-pause{display:block}
.track{position:relative;flex:1;min-width:120px;display:grid;align-items:center}
.track input{width:100%;margin:0}
#tl-markers{position:absolute;inset-inline:8px;inset-block-start:-14px;height:0}
.marker{position:absolute;translate:-50% 0;min-width:18px;height:18px;padding:0 4px;border:2px solid var(--paper);border-radius:50%;background:var(--accent);color:#fff;font-size:10px;font-weight:700;line-height:14px}
#tl-time{min-width:64px;text-align:end;font-variant-numeric:tabular-nums;color:var(--muted)}
.timeline[data-mode=construction] .motion-only{display:none}
/* panel */
.panel{grid-area:panel;display:grid;grid-template-rows:auto minmax(0,1fr) auto;min-height:0;border-inline-start:1px solid var(--line);background:var(--paper)}
.panel>header{display:flex;align-items:baseline;gap:8px;padding:14px 16px 6px}
.panel h2{margin:0;font-size:15px}
.count{min-width:20px;padding:0 6px;border-radius:999px;background:var(--accent);color:#fff;font-size:12px;text-align:center}
.count:empty{display:none}
.notes{overflow:auto;padding:4px 10px}
.empty{margin:8px 6px;color:var(--muted)}
kbd{padding:1px 5px;border:1px solid var(--line);border-bottom-width:2px;border-radius:5px;font:12px ui-monospace,monospace}
#notes-list{list-style:none;margin:0;padding:0;display:grid;gap:4px}
#notes-list li{display:flex;align-items:flex-start;border-radius:10px}
#notes-list li.is-selected{background:color-mix(in srgb,var(--accent) 12%,transparent)}
.note-main{flex:1;display:grid;grid-template-columns:24px 1fr;column-gap:8px;padding:8px 6px;border:0;background:transparent;text-align:start}
.note-main .pin{grid-row:span 2;display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--accent);color:#fff;font-size:11px;font-weight:700}
.note-meta{font-size:12px;color:var(--muted);overflow-wrap:anywhere}
.note-del{opacity:.55;margin:6px 4px 0 0}.note-del:hover{opacity:1}
.panel>footer{display:grid;gap:8px;padding:12px 16px 14px;border-block-start:1px solid var(--line)}
.panel textarea{width:100%;min-height:42px;max-height:30dvh;resize:vertical;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg);font:inherit;field-sizing:content}
.send-row{display:flex;gap:8px;justify-content:flex-end}.send-row .primary{flex:1;justify-content:center}
.status{margin:0;min-height:1.3em;font-size:12px;color:var(--muted)}
/* overlays */
[popover],.pop-fallback{position:fixed;inset:auto;margin:0;padding:6px;border:1px solid var(--line);border-radius:12px;background:var(--paper);color:var(--fg);box-shadow:0 10px 30px rgba(0,0,0,.18)}
/* Author display values beat the UA's popover hiding, so show rows only when open. :is() keeps the rule valid where :popover-open is unknown. */
.pop-row{display:none;gap:6px}.pop-row:is(:popover-open,.is-open){display:flex}
.pop-row button{padding:6px 10px;border:0;border-radius:8px;background:transparent}
.pop-row button[aria-pressed=true]{background:var(--fg);color:var(--paper)}
.color-btn{width:28px;height:28px;padding:0!important;border-radius:50%!important;background:var(--c)!important;box-shadow:inset 0 0 0 2px var(--paper)}
.color-btn[aria-pressed=true]{outline:2px solid var(--fg);outline-offset:1px}
dialog{width:min(720px,calc(100vw - 32px));max-height:min(80dvh,720px);padding:0;border:1px solid var(--line);border-radius:14px;background:var(--paper);color:var(--fg)}
dialog::backdrop{background:rgba(0,0,0,.4)}
.dlg-head{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--line);background:var(--paper)}
.dlg-head h2{margin:0;font-size:16px}
.dlg-body{padding:6px 18px 18px}
.dlg-body h3{margin:16px 0 6px;font-size:13px}.dlg-body h3 small{color:var(--muted);font-weight:400}
.dlg-body ul{margin:0;padding-inline-start:18px;color:var(--warn)}.dlg-body .ok{margin:0;color:var(--muted)}
.bgrow{display:grid;grid-template-columns:90px 1fr;gap:12px;align-items:start;margin-top:12px}.bgname{color:var(--muted);padding-top:6px}
.badge{font-size:12px;color:var(--warn)}
.cells{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}figure{margin:0;text-align:center}figcaption{font-size:12px;color:var(--muted)}
.cell{padding:8px;border:1px solid var(--line);border-radius:8px;display:grid;place-items:center;max-width:100%;overflow:hidden}.cell img{max-width:100%;height:auto;display:block}
.checker{background:conic-gradient(#e6e6e6 25%,#fff 0 50%,#e6e6e6 0 75%,#fff 0) 0 0/14px 14px}
@media (width < 760px){
  .workspace{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) auto auto;grid-template-areas:"canvas" "timeline" "panel"}
  .panel{max-height:42dvh;border-inline-start:0;border-block-start:1px solid var(--line)}
  .tools button .label,.topbar .label{display:none}
  .canvas{padding:52px 12px 76px}
}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
`;

const TRANSPARENT_ADVICE = 'A transparent logo must work on every background it will sit on: ship a variant per background, or theme it with currentColor where it is inlined.';

/**
 * Every check the review page shows, in one structure the page, the server, and
 * the agent share: groups of { name, source, items[] | null (not run) }, plus the
 * raw pieces the page needs for badges.
 */
export function collectChecks({ source, input, motionCss = '' }) {
  const vb = viewBoxOf(source);
  const { animated, warnings: lint } = motionLint(source, motionCss);
  const structural = runAudit('audit_svg.py', input)?.[0] ?? null;
  const geometric = runAudit('path_audit.py', input);
  const contrast = contrastReport(source, BACKGROUNDS, { viewBox: vb });
  const contrastLines = Object.entries(contrast.findings).flatMap(([bg, items]) => items.map((f) => `${bg}: ${f.element} ${f.paint} ${f.color} is ${f.ratio}:1 (needs ${f.minimum}:1)`));
  const groups = [
    { name: 'Structure', source: 'audit_svg.py', items: structural ? [...structural.errors.map((e) => `Error: ${e}`), ...structural.warnings] : null },
    { name: 'Geometry', source: 'path_audit.py', items: geometric ? [...geometric.errors.map((e) => `Error: ${e}`), ...geometric.warnings] : null },
    { name: 'Contrast', source: contrast.ownBackground ? `on its own background ${contrast.ownBackground}` : 'on light and dark backgrounds', items: contrastLines,
      advice: contrastLines.length && !contrast.ownBackground ? TRANSPARENT_ADVICE : null },
    ...(animated ? [{ name: 'Motion', source: 'CSS lint', items: lint }] : []),
  ];
  const issues = groups.reduce((n, g) => n + (g.items?.length ?? 0), 0);
  return { groups, issues, animated, lint, structural, geometric, contrast, viewBox: vb };
}

/** Plain-text lines for the agent: one per open check. */
export function checksSummary(checks) {
  if (!checks) return '';
  const lines = checks.groups.flatMap((g) => (g.items ?? []).map((x) => `- ${g.name}: ${x}`));
  const skipped = checks.groups.filter((g) => g.items === null).map((g) => g.name);
  return [
    lines.length ? `Open checks (${lines.length}):` : 'Checks: no findings.',
    ...lines,
    ...(skipped.length ? [`Not run: ${skipped.join(', ')}`] : []),
  ].join('\n');
}

/**
 * Build the review page. `review` = { endpoint, token, events, round, file } when a
 * review server is attached; otherwise Send downloads the feedback JSON.
 */
export function reviewPage({ source, input, motionCss = '', sizes: sizesArg, title, review = null }) {
  const checks = collectChecks({ source, input, motionCss });
  const { groups, issues, animated, lint, structural, geometric, contrast, viewBox: vb } = checks;
  const vbW = vb?.[2] || 300, vbH = vb?.[3] || 150;
  const sizes = sizesArg ?? (vbW <= 64 ? [16, 24, 32, 48, 96] : [120, 240, 480]);
  if (sizes.some((n) => !Number.isInteger(n) || n < 8 || n > 2048)) throw new Error('sizes must be integers between 8 and 2048');
  const name = title ?? basename(input);

  // ---- checks dialog
  const checksBody = groups.map((g) => `<h3>${g.name} <small>${esc(g.source)}</small></h3>${
    g.items === null ? '<p class="ok">Not run (Python unavailable).</p>'
      : g.items.length ? `<ul>${g.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="ok">No findings.</p>'}${
    g.advice ? `<p class="ok">${esc(g.advice)}</p>` : ''}`).join('');

  // ---- sizes dialog
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(source).toString('base64')}`;
  const rows = [['transparent', 'checker'], ['light', BACKGROUNDS.light], ['dark', BACKGROUNDS.dark]];
  const sizesBody = rows.map(([row, bg]) => {
    const n = contrast.findings[row]?.length ?? 0;
    return `<div class="bgrow"><div class="bgname">${row}${n ? `<div class="badge">${n} low-contrast paint${n > 1 ? 's' : ''}</div>` : ''}</div><div class="cells">${sizes.map((s) =>
      `<figure><div class="cell ${bg === 'checker' ? 'checker' : ''}" style="${bg === 'checker' ? '' : `background:${bg}`}"><img src="${dataUri}" style="color-scheme:${row === 'dark' ? 'dark' : 'light'}" width="${s}" height="${Math.round((s * vbH) / vbW)}" alt=""></div><figcaption>${s}px</figcaption></figure>`).join('')}</div></div>`;
  }).join('');

  // The page carries its checks so a saved offline round includes them too.
  const reviewCfg = { ...(review ?? {}), file: review?.file ?? basename(input), checks: { issues, groups: groups.map(({ name, source: src, items }) => ({ name, source: src, items })) } };
  const connected = review?.endpoint
    ? `Connected to the agent${review.round ? ` · round ${review.round}` : ''}.`
    : 'Offline file: Send saves the notes as a file for the agent.';
  const lowContrast = (row) => (contrast.findings[row]?.length ? ' · low contrast' : '');

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark">
<title>${esc(name)} · review</title>
<style>${CSS}</style>
<style id="motion-css" media="not all">${safeCss(motionCss)}</style>
</head><body>
<header class="topbar">
  <div class="title"><strong>${esc(name)}</strong><span>${esc(basename(input))}${vb ? ` · ${vb[2]}×${vb[3]}` : ''}</span></div>
  <div class="seg" role="group" aria-label="Canvas background">
    <button type="button" data-bg="light" aria-pressed="true" title="Light background${lowContrast('light')}"><span class="swatch-bg" style="background:${BACKGROUNDS.light}"></span><span class="label"> Light</span></button>
    <button type="button" data-bg="dark" aria-pressed="false" title="Dark background${lowContrast('dark')}"><span class="swatch-bg" style="background:${BACKGROUNDS.dark}"></span><span class="label"> Dark</span></button>
    <button type="button" data-bg="transparent" aria-pressed="false" title="Transparent"><span class="swatch-bg checker"></span><span class="label"> None</span></button>
  </div>
  <button type="button" class="chip" data-dialog="sizes-dlg">${ICONS.sizes}<span class="label">Sizes</span></button>
  <button type="button" class="chip ${issues ? 'warn' : ''}" data-dialog="checks-dlg">${issues ? ICONS.alert : ICONS.check}<span>${issues ? `${issues}<span class="label"> to check</span>` : '<span class="label">Checks </span>OK'}</span></button>
</header>
<div class="workspace">
  <section class="canvas" aria-label="Drawing">
    ${animated ? '<div class="seg stage-mode" role="group" aria-label="Show"><button type="button" data-stage-mode="motion" aria-pressed="true">Motion</button><button type="button" data-stage-mode="construction" aria-pressed="false">Construction</button></div>' : ''}
    <div id="dbs-stage">${inlineSvg(source)}</div>
    <div id="banner" class="banner" hidden>The drawing was updated. <button type="button" class="btn">Reload</button></div>
    <div id="tools" class="tools" role="toolbar" aria-label="Annotate">
      <button type="button" data-tool="comment" aria-pressed="false" aria-keyshortcuts="C" title="Comment (C): click the drawing to pin a note">${ICONS.comment}<span class="label">Comment</span></button>
      <button type="button" data-tool="pen" aria-pressed="false" aria-keyshortcuts="D" title="Draw (D)">${ICONS.pen}<span class="label">Draw</span></button>
      <button type="button" data-tool="arrow" aria-pressed="false" aria-keyshortcuts="A" title="Arrow (A)">${ICONS.arrow}<span class="label">Arrow</span></button>
      <span class="sep" aria-hidden="true"></span>
      <button type="button" id="tool-color" data-pop="color-pop" aria-expanded="false" aria-label="Mark color" title="Mark color"><span class="dot"></span></button>
      <button type="button" id="tool-undo" aria-label="Undo" aria-keyshortcuts="Control+Z" title="Undo (Ctrl+Z)">${ICONS.undo}</button>
    </div>
  </section>
  <div id="tl" class="timeline" data-mode="${animated ? 'motion' : 'construction'}">
    <button type="button" id="tl-play" class="icon-btn" aria-pressed="false" aria-label="Play (Space)">${ICONS.play}${ICONS.pause}</button>
    <div class="track"><div id="tl-markers"></div><input id="tl-range" type="range" min="0" max="1" step="1" value="0" aria-label="${animated ? 'Animation time' : 'Construction progress'}"></div>
    <output id="tl-time">0 ms</output>
    <button type="button" id="tl-speed" class="btn" data-pop="speed-pop" aria-expanded="false" aria-label="Playback speed">1×</button>
  </div>
  <aside class="panel" aria-labelledby="notes-h">
    <header><h2 id="notes-h">Notes</h2><span id="notes-count" class="count"></span></header>
    <div class="notes">
      <p id="notes-empty" class="empty">Choose <b>Comment</b> (<kbd>C</kbd>) and click the drawing to pin a note${animated ? '; it remembers the frame you are on' : ''}. <b>Draw</b> (<kbd>D</kbd>) and <b>Arrow</b> (<kbd>A</kbd>) mark it up.</p>
      <ol id="notes-list"></ol>
    </div>
    <footer>
      <textarea id="note" rows="2" placeholder="Anything else for the agent?" aria-label="Overall note"></textarea>
      <div class="send-row"><button type="button" id="approve" class="btn">Approve</button><button type="button" id="send" class="btn primary" disabled>${review?.endpoint ? 'Send to agent' : 'Save notes'}</button></div>
      <p id="status" class="status" role="status" aria-live="polite">${esc(connected)}</p>
    </footer>
  </aside>
</div>
<div id="color-pop" popover class="pop-row" aria-label="Mark color">${['#e5484d', '#f59e0b', '#16a34a', '#2563eb'].map((c, i) => `<button type="button" class="color-btn" data-color="${c}" style="--c:${c}" aria-label="${['Red', 'Amber', 'Green', 'Blue'][i]}" aria-pressed="${i === 0}"></button>`).join('')}</div>
<div id="speed-pop" popover class="pop-row" aria-label="Playback speed">${[0.25, 0.5, 1, 2].map((s) => `<button type="button" data-speed="${s}" aria-pressed="${s === 1}">${s}×</button>`).join('')}</div>
<dialog id="checks-dlg" closedby="any" aria-labelledby="checks-h"><div class="dlg-head"><h2 id="checks-h">Checks</h2><form method="dialog"><button class="icon-btn" aria-label="Close">${icon('M6 6l12 12M18 6L6 18')}</button></form></div><div class="dlg-body">${checksBody}</div></dialog>
<dialog id="sizes-dlg" closedby="any" aria-labelledby="sizes-h"><div class="dlg-head"><h2 id="sizes-h">Target sizes</h2><form method="dialog"><button class="icon-btn" aria-label="Close">${icon('M6 6l12 12M18 6L6 18')}</button></form></div><div class="dlg-body">${sizesBody}</div></dialog>
<script>if (!('popover' in HTMLElement.prototype)) for (const p of document.querySelectorAll('[popover]')) { p.removeAttribute('popover'); p.classList.add('pop-fallback'); }</script>
<script>window.__dbsReview = ${safeJs(JSON.stringify(reviewCfg))};</script>
<script>${safeJs(CHROME_RUNTIME)}</script>
<script>${safeJs(STAGE_RUNTIME)}</script>
<script>${safeJs(REVIEW_UI)}</script>
</body></html>`;

  const summary = {
    sizes, animated, issues,
    structural: structural && { errors: structural.errors.length, warnings: structural.warnings.length },
    geometry: geometric && { errors: geometric.errors.length, warnings: geometric.warnings.length },
    contrast: Object.fromEntries(Object.entries(contrast.findings).map(([k, v]) => [k, v.length])),
    motionWarnings: lint,
  };
  return { html, summary };
}
