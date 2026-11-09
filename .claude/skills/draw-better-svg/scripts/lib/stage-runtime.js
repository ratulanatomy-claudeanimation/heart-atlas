// Stage runtime for the review page (browser script, inlined by review-page.mjs).
//
// One timeline drives two modes:
//   motion        the motion CSS / SMIL on a single clock, in milliseconds
//   construction  a replay of how the drawing is built: strokes draw, fills appear
// window.__dbsStage exposes { mode, animated, duration, time(), seek(ms), setMode(m),
// finish(), toggle() } and the stage element emits `dbs-time` and `dbs-mode` events.
(() => {
  const host = document.getElementById('dbs-stage');
  const svg = host && host.querySelector('svg');
  if (!svg) return;
  const $ = (id) => document.getElementById(id);
  const play = $('tl-play'), range = $('tl-range'), readout = $('tl-time');
  const motionCss = $('motion-css');
  const smil = typeof svg.pauseAnimations === 'function' && svg.querySelector('animate,animateTransform,animateMotion,set');
  const animated = !!(smil || (motionCss && motionCss.textContent.trim()) || [...svg.querySelectorAll('style')].some((s) => /@keyframes/.test(s.textContent)));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let mode = animated ? 'motion' : 'construction';
  let speed = 1;
  const setPlaying = (on) => {
    play.setAttribute('aria-pressed', String(on));
    play.setAttribute('aria-label', on ? 'Pause (Space)' : 'Play (Space)');
  };
  const emit = (type, detail) => host.dispatchEvent(new CustomEvent(type, { detail }));

  // ---------------------------------------------------------------- construction
  const skip = 'defs,clipPath,mask,pattern,symbol,marker,linearGradient,radialGradient,filter,[data-dbs-ui]';
  const shapes = [...svg.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon,text,use,image')].filter((el) => !el.closest(skip));
  const vb = svg.viewBox.baseVal;
  const hair = Math.max(0.5, Math.hypot(vb?.width || 300, vb?.height || 150) / 320);
  let c = { anims: [], ghosts: [], total: 1 };
  function cBuild() {
    cCancel();
    let t = 0;
    const fills = [];
    for (const el of shapes) {
      const cs = getComputedStyle(el);
      const canDraw = typeof el.getTotalLength === 'function' && !['text', 'use'].includes(el.tagName);
      const len = canDraw ? el.getTotalLength() : 0;
      const stroke = cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0 && Number(cs.strokeOpacity) > 0;
      const fill = cs.fill !== 'none' && Number(cs.fillOpacity) > 0;
      const dur = Math.min(900, Math.max(160, len * 2.2));
      const draw = (node) => c.anims.push(node.animate([{ strokeDasharray: `${len} ${len}`, strokeDashoffset: len }, { strokeDasharray: `${len} ${len}`, strokeDashoffset: 0 }],
        { duration: dur, delay: t, fill: 'both', easing: 'cubic-bezier(0.4,0,0.2,1)' }));
      if (canDraw && len > 0 && stroke) {
        draw(el);
        if (fill) fills.push([el, 'fillOpacity', cs.fillOpacity]);
        t += dur * 0.55;
      } else if (canDraw && len > 0 && fill) {
        const g = el.cloneNode(false);
        for (const a of ['id', 'class', 'filter', 'mask']) g.removeAttribute(a);
        Object.assign(g.style, { fill: 'none', stroke: /^rgb|^#/.test(cs.fill) ? cs.fill : '#555', strokeWidth: hair * 1.6, strokeOpacity: 0.85, opacity: 1 });
        g.setAttribute('aria-hidden', 'true');
        g.setAttribute('data-dbs-ui', '');
        el.after(g);
        c.ghosts.push(g);
        draw(g);
        fills.push([el, 'opacity', cs.opacity, g]);
        t += dur * 0.55;
      } else {
        fills.push([el, 'opacity', cs.opacity]);
      }
    }
    t += 200;
    fills.forEach(([el, prop, to, ghost], i) => {
      const delay = t + i * 70;
      c.anims.push(el.animate([{ [prop]: 0 }, { [prop]: to }], { duration: 420, delay, fill: 'both', easing: 'ease-out' }));
      if (ghost) c.anims.push(ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: delay + 200, fill: 'both' }));
    });
    c.total = Math.max(t + fills.length * 70 + 700, 400);
    for (const a of c.anims) a.playbackRate = speed;
  }
  function cCancel() { for (const a of c.anims) a.cancel(); for (const g of c.ghosts) g.remove(); c = { anims: [], ghosts: [], total: 1 }; }
  const cNow = () => Math.max(0, ...c.anims.map((a) => a.currentTime ?? 0));

  // ---------------------------------------------------------------- motion
  let m = { anims: [], dur: 0 };
  function mStart() {
    if (motionCss) { motionCss.media = 'not all'; void document.body.offsetWidth; motionCss.media = 'all'; }
    for (const s of svg.querySelectorAll('style')) { const t = s.textContent; s.textContent = ''; void svg.getBBox(); s.textContent = t; }
    const own = new Set(c.anims);
    m.anims = document.getAnimations().filter((a) => !own.has(a));
    m.dur = Math.max(0, ...m.anims.map((a) => {
      const t = a.effect?.getComputedTiming?.();
      if (!t) return 0;
      return Number.isFinite(t.endTime) ? t.endTime : (t.delay || 0) + (t.duration || 0);
    }));
    if (smil) { svg.setCurrentTime(0); svg.unpauseAnimations(); m.dur = Math.max(m.dur, 2000); }
    for (const a of m.anims) a.playbackRate = speed;
  }
  // Parts end at different times; the longest one carries the clock. A drawing
  // made only of endless loops repeats every m.dur ms, so its clock wraps: a note
  // then records 5034 ms, not 117034 ms after the page opened.
  const looping = () => m.anims.length > 0 && m.anims.every((a) => a.effect?.getComputedTiming?.().iterations === Infinity);
  const mNow = () => {
    const raw = m.anims.length ? Math.max(...m.anims.map((a) => a.currentTime ?? 0)) : smil ? svg.getCurrentTime() * 1000 : 0;
    return looping() && m.dur > 0 ? raw % m.dur : raw;
  };
  const mRunning = () => m.anims.some((a) => a.playState === 'running') || (smil && !svg.animationsPaused());

  // ---------------------------------------------------------------- one timeline
  const duration = () => (mode === 'motion' ? m.dur : c.total);
  const now = () => (mode === 'motion' ? mNow() : cNow());
  const running = () => (mode === 'motion' ? mRunning() : c.anims.some((a) => a.playState === 'running'));
  function show() {
    const d = Math.max(1, duration()), t = Math.min(now(), d);
    range.max = String(Math.round(d));
    range.value = String(Math.round(t));
    readout.textContent = mode === 'motion' ? `${Math.round(t)} ms` : `${Math.round((t / d) * 100)}%`;
    emit('dbs-time', mode === 'motion' ? Math.round(t) : null);
  }
  function tick() { show(); if (running()) requestAnimationFrame(tick); else setPlaying(false); }
  function start() {
    if (mode === 'motion') mStart(); else cBuild();
    for (const a of mode === 'motion' ? m.anims : c.anims) a.play();
    setPlaying(true);
    tick();
  }
  function pause() {
    for (const a of mode === 'motion' ? m.anims : c.anims) a.pause();
    if (mode === 'motion' && smil) svg.pauseAnimations();
    setPlaying(false);
    show();
  }
  function seek(ms) {
    if (mode === 'construction' && !c.anims.length) cBuild();
    const list = mode === 'motion' ? m.anims : c.anims;
    for (const a of list) { a.pause(); a.currentTime = ms; }
    if (mode === 'motion' && smil) { svg.pauseAnimations(); svg.setCurrentTime(ms / 1000); }
    setPlaying(false);
    show();
  }
  function toggle() {
    if (running()) { pause(); return; }
    const list = mode === 'motion' ? m.anims : c.anims;
    if (!list.length || now() >= duration() - 1) { start(); return; }
    for (const a of list) a.play();
    if (mode === 'motion' && smil) svg.unpauseAnimations();
    setPlaying(true);
    tick();
  }
  // Construction ends on the untouched drawing, with no helper strokes left.
  function finish() { if (mode === 'construction') { cCancel(); setPlaying(false); range.value = range.max; readout.textContent = '100%'; } }

  function setMode(next) {
    if (next === 'motion' && !animated) return;
    if (mode === 'motion') { for (const a of m.anims) a.cancel(); m = { anims: [], dur: 0 }; if (motionCss) motionCss.media = 'not all'; if (smil) { svg.pauseAnimations(); svg.setCurrentTime(0); } }
    else cCancel();
    mode = next;
    for (const b of document.querySelectorAll('[data-stage-mode]')) b.setAttribute('aria-pressed', String(b.dataset.stageMode === next));
    $('tl').dataset.mode = next;
    if (next === 'motion') { mStart(); if (reduce.matches) { pause(); seek(m.dur); } else { setPlaying(true); tick(); } }
    else if (reduce.matches) finish();
    else start();
    emit('dbs-mode', next);
  }

  play.addEventListener('click', toggle);
  range.addEventListener('input', () => seek(Number(range.value)));
  for (const b of document.querySelectorAll('[data-stage-mode]')) b.addEventListener('click', () => setMode(b.dataset.stageMode));
  for (const b of document.querySelectorAll('[data-speed]')) {
    b.addEventListener('click', () => {
      speed = Number(b.dataset.speed);
      for (const a of [...m.anims, ...c.anims]) a.playbackRate = speed;
      $('tl-speed').textContent = `${speed}×`;
      for (const x of document.querySelectorAll('[data-speed]')) x.setAttribute('aria-pressed', String(x === b));
      $('speed-pop').hidePopover?.();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input:not([type=range]),textarea,[contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === ' ') { e.preventDefault(); toggle(); }
    if (mode === 'motion' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.target === document.body) {
      e.preventDefault();
      seek(Math.max(0, Math.min(m.dur, mNow() + (e.key === 'ArrowLeft' ? -40 : 40) * (e.shiftKey ? 5 : 1))));
    }
  });

  window.__dbsStage = {
    get mode() { return mode; },
    animated,
    get duration() { return duration(); },
    time: () => (mode === 'motion' ? Math.round(mNow()) : null),
    seek: (ms) => { if (mode !== 'motion') setMode('motion'); seek(ms); },
    setMode,
    finish,
    toggle,
  };
  setMode(mode);
})();
