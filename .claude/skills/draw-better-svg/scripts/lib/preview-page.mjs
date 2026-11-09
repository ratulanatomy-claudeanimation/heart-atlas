// Shared helpers and the motion page. The review page is in review-page.mjs.
//
// motion page: only the animation, with QA hooks for capture_frames.mjs:
//   ?t=<ms> pauses every animation there, ?static=1 finishes them, ?bare=1 shows
//   the SVG without the motion CSS, window.__dbsReady marks a settled frame.
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = dirname(HERE);
export const BACKGROUNDS = { light: '#f8f5ee', dark: '#17242b' };

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Inline copies must not smuggle script: drop scripts, handlers, prolog, doctype.
export const inlineSvg = (source) => source
  .replace(/<\?xml[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '')
  .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\s on[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '');
export const viewBoxOf = (source) => (source.match(/viewBox\s*=\s*["']([^"']+)["']/) || [])[1]?.trim().split(/[\s,]+/).map(Number);
// A literal "</style>" or "</script>" inside embedded text would end the element early.
export const safeCss = (css) => css.replace(/<\/style/gi, '<\\/style');
export const safeJs = (js) => js.replace(/<\/script/gi, '<\\/script');

/** Motion CSS mistakes that fail silently. Returns { animated, warnings }. */
export function motionLint(source, motionCss) {
  const allCss = motionCss + [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  const animated = /@keyframes|animation\s*:|<animate|<set\b/i.test(allCss + source);
  const warnings = [];
  for (const m of allCss.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g)) {
    if (/animation-timing-function\s*:\s*var\(/.test(m[2])) {
      warnings.push(`@keyframes ${m[1]}: animation-timing-function uses var(); Chromium drops it and runs that segment linearly. Write the cubic-bezier() literally.`);
    }
  }
  if (animated && !/prefers-reduced-motion/.test(allCss)) {
    warnings.push('No prefers-reduced-motion rule: the delivered CSS must show the final static state under reduced motion; capture_frames.mjs checks this.');
  }
  if (animated && /animation\s*:[^;]*\binfinite\b/.test(allCss) && !/animation-play-state|iteration-count\s*:\s*\d/.test(allCss)) {
    warnings.push('An infinite loop has no stop: decay attention-grabbing loops after a few cycles unless something is actually loading.');
  }
  return { animated, warnings };
}

export function runAudit(script, input) {
  for (const py of ['python3', 'python']) {
    const r = spawnSync(py, [join(SCRIPTS, script), input, '--json'], { encoding: 'utf8' });
    if (r.error || r.status === null) continue;
    try { return JSON.parse(r.stdout); } catch { return null; }
  }
  return null;
}

// ------------------------------------------------------------------ motion page

const MOTION_RUNTIME = `
(() => {
  const params = new URLSearchParams(location.search);
  const svg = document.querySelector('#stage svg');
  const anims = () => document.getAnimations();
  const smil = svg && typeof svg.pauseAnimations === 'function' && svg.querySelector('animate,animateTransform,animateMotion,set');
  const end = () => Math.max(0, ...anims().map((a) => {
    const t = a.effect?.getComputedTiming?.();
    return t && Number.isFinite(t.endTime) ? t.endTime : 0;
  }));
  window.__dbsDuration = end();
  function seek(ms) {
    for (const a of anims()) { a.pause(); a.currentTime = ms; }
    if (smil) { svg.pauseAnimations(); svg.setCurrentTime(ms / 1000); }
  }
  function finalState() {
    for (const a of anims()) {
      const t = a.effect?.getComputedTiming?.();
      if (t && Number.isFinite(t.endTime)) a.finish(); else { a.pause(); a.currentTime = 0; }
    }
    if (smil) { svg.pauseAnimations(); svg.setCurrentTime(window.__dbsDuration / 1000 || 0); }
  }
  function ready() { requestAnimationFrame(() => requestAnimationFrame(() => { window.__dbsReady = true; })); }
  const t = params.get('t');
  if (params.has('bare')) {
    document.getElementById('motion-css')?.remove();
    for (const a of anims()) a.cancel();
    if (smil) { svg.pauseAnimations(); svg.setCurrentTime(0); }
    ready();
  } else if (params.has('static')) { finalState(); ready(); }
  else if (t !== null) { seek(Number(t)); ready(); }
  else ready();
  const $ = (id) => document.getElementById(id);
  if (!$('replay')) return;
  // Finished animations without forwards fill leave getAnimations(), so restart
  // by re-inserting every stylesheet that declares keyframes.
  $('replay').onclick = () => {
    const sheets = [...document.querySelectorAll('style')].filter((s) => /@keyframes|animation/.test(s.textContent));
    const texts = sheets.map((s) => s.textContent);
    sheets.forEach((s) => { s.textContent = ''; });
    void document.body.offsetWidth;
    sheets.forEach((s, i) => { s.textContent = texts[i]; });
    for (const a of anims()) a.playbackRate = Number($('speed').value);
    if (smil) { svg.setCurrentTime(0); svg.unpauseAnimations(); }
  };
  $('speed').oninput = () => { for (const a of anims()) a.playbackRate = Number($('speed').value); $('speedv').textContent = $('speed').value + '×'; };
  $('slow').onclick = () => { $('speed').value = $('speed').value === '0.25' ? '1' : '0.25'; $('speed').oninput(); };
  $('final').onclick = finalState;
})();`;

export function motionPage({ source, motionCss = '', title = 'SVG' }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — motion</title>
<style>
:root{color-scheme:light dark;--bg:#f8f5ee;--fg:#1f2a30;--line:#d9d3c7}
@media (prefers-color-scheme:dark){:root{--bg:#17242b;--fg:#e8e4dc;--line:#33454f}}
html,body{margin:0;background:var(--bg);color:var(--fg);font:14px system-ui,sans-serif}
#stage{display:grid;place-items:center;padding:24px}
#stage svg{width:min(85vw,560px);height:auto;max-height:70vh}
.bar{display:flex;gap:12px;align-items:center;justify-content:center;padding:0 16px 16px;flex-wrap:wrap}
button{font:inherit;padding:6px 12px;border:1px solid var(--line);background:transparent;color:inherit;border-radius:6px;cursor:pointer}
</style>
<style id="motion-css">${safeCss(motionCss)}</style></head><body>
<div id="stage">${inlineSvg(source)}</div>
<div class="bar"><button id="replay">Replay</button><button id="slow">Slow motion</button>
<label>Speed <input id="speed" type="range" min="0.1" max="2" step="0.05" value="1"> <span id="speedv">1×</span></label>
<button id="final">Final frame</button></div>
<script>${safeJs(MOTION_RUNTIME)}</script></body></html>`;
}
