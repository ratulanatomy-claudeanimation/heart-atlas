// Review layer for the review page (browser script, inlined by review-page.mjs).
// Binds to the page's toolbar, notes panel, and timeline: comment pins, freehand
// and arrow marks, undo/redo, Send/Approve.
//
// Transport: with window.__dbsReview.endpoint (review_server.mjs) Send POSTs the
// round and the agent's `--wait` returns it; opened as a file, Send downloads the
// feedback JSON and copies it to the clipboard.
//
// Coordinates are in the SVG's root user space (viewBox units). A comment names
// the element under the click as path_audit.py does. On the motion timeline every
// comment and mark records its frame time `t` (ms); making one pauses there.
(() => {
  const cfg = window.__dbsReview || {};
  const stage = document.getElementById('dbs-stage');
  const svg = stage && stage.querySelector('svg');
  if (!svg) return;
  const $ = (id) => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const canvas = stage.closest('.canvas');
  const clock = () => window.__dbsStage?.time?.() ?? null;
  const r2 = (v) => Math.round(v * 100) / 100;

  // ---------------------------------------------------------------- layers
  const make = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    parent?.append(n);
    return n;
  };
  const layer = make('g', { id: 'dbs-review-layer', 'data-dbs-ui': '' }, svg);
  const marks = make('g', { id: 'dbs-markup' }, layer);
  const pins = make('g', { id: 'dbs-pins' }, layer);
  const toUser = (x, y) => {
    const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM().inverse());
    return { x: r2(p.x), y: r2(p.y) };
  };
  const unit = () => 1 / Math.abs(svg.getScreenCTM().a || 1); // user units per CSS pixel

  // ---------------------------------------------------------------- state and history
  let tool = 'view';
  let color = '#e5484d';
  let comments = [];
  let nextN = 1;
  let selected = null;
  let dirty = false;
  const past = [];
  let future = [];
  const snapshot = () => JSON.stringify({ m: marks.innerHTML, c: comments, n: nextN });
  const save = () => { past.push(snapshot()); future = []; };
  function restore(s) { const o = JSON.parse(s); marks.innerHTML = o.m; comments = o.c; nextN = o.n; changed(); }
  function undo() { if (past.length) { future.push(snapshot()); restore(past.pop()); } }
  function redo() { if (future.length) { past.push(snapshot()); restore(future.pop()); } }

  // ---------------------------------------------------------------- what is under a point
  const own = (n) => !n.closest('[data-dbs-ui]');
  function label(n) {
    const tag = n.tagName.toLowerCase();
    if (n.id) return `${tag}#${n.id}`;
    const pool = ['path', 'polyline', 'polygon'].includes(tag) ? svg.querySelectorAll('path,polyline,polygon') : svg.querySelectorAll(tag);
    return `${tag}[${[...pool].filter(own).indexOf(n)}]`;
  }
  function selector(n) {
    const parts = [];
    for (let cur = n; cur && cur !== svg; cur = cur.parentElement) {
      if (cur.id) { parts.unshift(`#${CSS.escape(cur.id)}`); break; }
      const i = [...cur.parentElement.children].filter((x) => x.tagName === cur.tagName).indexOf(cur) + 1;
      parts.unshift(`${cur.tagName.toLowerCase()}:nth-of-type(${i})`);
    }
    return parts.join(' > ');
  }
  function bbox(n) {
    try {
      const b = n.getBBox();
      const k = svg.getScreenCTM().inverse().multiply(n.getScreenCTM());
      const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([x, y]) => new DOMPoint(x, y).matrixTransform(k));
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      return [r2(Math.min(...xs)), r2(Math.min(...ys)), r2(Math.max(...xs) - Math.min(...xs)), r2(Math.max(...ys) - Math.min(...ys))];
    } catch { return null; }
  }
  function pick(cx, cy) {
    layer.style.pointerEvents = 'none';
    const stack = document.elementsFromPoint(cx, cy).filter((n) => n !== svg && svg.contains(n) && own(n));
    layer.style.pointerEvents = '';
    const top = stack[0];
    if (!top) return { label: 'background', below: [] };
    const cs = getComputedStyle(top);
    const ancestors = [];
    for (let a = top.parentElement; a && a !== svg; a = a.parentElement) if (a.id) ancestors.push(a.id);
    return { label: label(top), tag: top.tagName.toLowerCase(), id: top.id || null, selector: selector(top), ancestors, fill: cs.fill, stroke: cs.stroke, bbox: bbox(top), below: stack.slice(1, 4).map(label) };
  }

  // ---------------------------------------------------------------- rendering
  const isNear = (t, now) => t === null || t === undefined || now === null || Math.abs(t - now) <= 60;
  let nowT = clock();
  function renderPins() {
    pins.replaceChildren();
    const u = unit();
    for (const cm of comments) {
      const g = make('g', { 'data-comment': cm.n, 'data-t': cm.t ?? '', class: cm.n === selected ? 'is-selected' : '' }, pins);
      make('circle', { cx: cm.x, cy: cm.y, r: 12 * u, fill: cm.n === selected ? '#5b21b6' : '#7c3aed', stroke: '#fff', 'stroke-width': 2 * u }, g);
      const t = make('text', { x: cm.x, y: cm.y + 4.2 * u, 'text-anchor': 'middle', 'font-size': 12 * u, 'font-weight': 700, 'font-family': 'system-ui,sans-serif', fill: '#fff' }, g);
      t.textContent = cm.n;
    }
    fade();
  }
  // Marks from another frame fade while the timeline is elsewhere.
  function fade() {
    for (const n of [...pins.children, ...marks.children]) {
      const raw = n.getAttribute('data-t');
      n.style.opacity = isNear(raw === '' || raw === null ? null : Number(raw), nowT) ? '' : '0.25';
    }
  }
  const list = $('notes-list');
  function renderList() {
    list.replaceChildren();
    for (const cm of comments) {
      const li = document.createElement('li');
      li.dataset.n = cm.n;
      li.className = cm.n === selected ? 'is-selected' : '';
      li.innerHTML = '<button type="button" class="note-main"><span class="pin"></span><span class="note-text"></span><span class="note-meta"></span></button><button type="button" class="icon-btn note-del"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
      li.querySelector('.pin').textContent = cm.n;
      li.querySelector('.note-text').textContent = cm.text;
      li.querySelector('.note-meta').textContent = `${cm.t !== null && cm.t !== undefined ? `${cm.t} ms · ` : ''}${cm.target.label}`;
      li.querySelector('.note-del').setAttribute('aria-label', `Delete note ${cm.n}`);
      li.querySelector('.note-main').onclick = () => select(cm.n, true);
      li.querySelector('.note-main').ondblclick = () => edit(cm);
      li.querySelector('.note-del').onclick = () => { save(); comments = comments.filter((x) => x !== cm); changed(); };
      list.append(li);
    }
    $('notes-count').textContent = comments.length ? String(comments.length) : '';
    $('notes-empty').hidden = comments.length > 0;
  }
  function renderMarkers() {
    const box = $('tl-markers');
    if (!box) return;
    box.replaceChildren();
    const d = window.__dbsStage?.duration || 0;
    if (window.__dbsStage?.mode !== 'motion' || !d) return;
    // Notes made on the same frame share one marker.
    const byTime = new Map();
    for (const cm of comments) {
      if (cm.t === null || cm.t === undefined) continue;
      byTime.set(cm.t, [...(byTime.get(cm.t) ?? []), cm.n]);
    }
    for (const [t, ns] of byTime) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'marker';
      b.style.insetInlineStart = `${Math.min(100, (t / d) * 100)}%`;
      b.textContent = ns.length > 2 ? String(ns.length) : ns.join(',');
      b.setAttribute('aria-label', `${ns.length > 1 ? 'Notes' : 'Note'} ${ns.join(', ')} at ${t} ms`);
      b.onclick = () => select(ns[0], true);
      box.append(b);
    }
  }
  function changed() {
    const hasWork = comments.length > 0 || marks.childElementCount > 0 || $('note').value.trim() !== '';
    dirty = hasWork;
    $('send').disabled = !hasWork;
    renderPins();
    renderList();
    renderMarkers();
  }
  function select(n, seek) {
    selected = n;
    const cm = comments.find((x) => x.n === n);
    if (seek && cm && cm.t !== null && cm.t !== undefined) window.__dbsStage?.seek(cm.t);
    renderPins();
    renderList();
    list.querySelector(`[data-n="${n}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  // ---------------------------------------------------------------- inline input
  let pop = null;
  function ask(cx, cy, initial, done) {
    closeAsk();
    const box = canvas.getBoundingClientRect();
    pop = document.createElement('form');
    pop.className = 'ask';
    pop.innerHTML = '<input type="text" aria-label="Note" placeholder="Add a note…" autocomplete="off"><button type="submit" class="btn primary">Add</button>';
    pop.style.insetInlineStart = `${Math.max(8, Math.min(cx - box.left + 16, box.width - 340))}px`;
    pop.style.insetBlockStart = `${Math.max(8, Math.min(cy - box.top - 20, box.height - 64))}px`;
    canvas.append(pop);
    const input = pop.querySelector('input');
    input.value = initial || '';
    input.focus({ preventScroll: true });
    const end = (value) => { closeAsk(); done(value); };
    pop.onsubmit = (e) => { e.preventDefault(); end(input.value.trim()); };
    input.onkeydown = (e) => { if (e.key === 'Escape') { e.stopPropagation(); end(null); } };
    input.onblur = () => setTimeout(() => { if (pop && !pop.contains(document.activeElement)) end(input.value.trim() || null); }, 120);
  }
  function closeAsk() { const p = pop; pop = null; p?.remove(); }
  function edit(cm) {
    const b = pins.querySelector(`[data-comment="${cm.n}"]`)?.getBoundingClientRect();
    if (!b) return;
    ask(b.right, b.top, cm.text, (v) => {
      if (v === null) return;
      save();
      if (v) cm.text = v; else comments = comments.filter((x) => x !== cm);
      changed();
    });
  }

  // ---------------------------------------------------------------- drawing
  let drawing = null;
  function smooth(pts) {
    let d = `M${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) d += ` Q${pts[i].x} ${pts[i].y} ${r2((pts[i].x + pts[i + 1].x) / 2)} ${r2((pts[i].y + pts[i + 1].y) / 2)}`;
    const last = pts.at(-1);
    return `${d} L${last.x} ${last.y}`;
  }
  function arrow(a, b) {
    const u = unit(), len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len, h = 14 * u, w = 7 * u;
    const f = (p) => `${r2(p.x)} ${r2(p.y)}`;
    return `M${f(a)} L${f(b)} M${f({ x: b.x - ux * h - uy * w, y: b.y - uy * h + ux * w })} L${f(b)} L${f({ x: b.x - ux * h + uy * w, y: b.y - uy * h - ux * w })}`;
  }
  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const pinHit = e.target.closest('#dbs-pins > g');
    if (tool === 'view') { if (pinHit) select(Number(pinHit.dataset.comment), false); return; }
    e.preventDefault();
    const p = toUser(e.clientX, e.clientY);
    const t = clock();
    if (t !== null) window.__dbsStage.seek(t); // pause on the frame being annotated
    if (tool === 'comment') {
      const target = pick(e.clientX, e.clientY);
      ask(e.clientX, e.clientY, '', (v) => {
        if (!v) return;
        save();
        comments.push({ n: nextN, x: p.x, y: p.y, t, text: v, target });
        selected = nextN++;
        changed();
      });
      return;
    }
    svg.setPointerCapture(e.pointerId);
    const before = snapshot();
    const node = make('path', { d: `M${p.x} ${p.y}`, fill: 'none', stroke: color, 'stroke-width': 3 * unit(), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-kind': tool, 'data-t': t ?? '' }, marks);
    drawing = { node, start: p, end: p, pts: [p], before };
  });
  svg.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const p = toUser(e.clientX, e.clientY);
    const { node, start, pts } = drawing;
    if (node.dataset.kind === 'pen') {
      if (Math.hypot(p.x - pts.at(-1).x, p.y - pts.at(-1).y) < 2 * unit()) return;
      pts.push(p);
      node.setAttribute('d', smooth(pts));
    } else {
      node.setAttribute('d', arrow(start, p));
    }
    drawing.end = p;
  });
  const endDraw = () => {
    if (!drawing) return;
    const { node, start, end, pts, before } = drawing;
    drawing = null;
    const tiny = node.dataset.kind === 'pen' ? pts.length < 2 : Math.hypot(end.x - start.x, end.y - start.y) < 4 * unit();
    if (tiny) { node.remove(); return; }
    past.push(before); future = [];
    changed();
  };
  svg.addEventListener('pointerup', endDraw);
  svg.addEventListener('pointercancel', endDraw);

  // ---------------------------------------------------------------- toolbar
  const toolbar = $('tools');
  const toolButtons = [...toolbar.querySelectorAll('[data-tool]')];
  function setTool(next) {
    tool = tool === next ? 'view' : next;
    closeAsk();
    if (tool !== 'view') window.__dbsStage?.finish();
    canvas.dataset.tool = tool;
    for (const b of toolButtons) b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
  }
  for (const b of toolButtons) b.addEventListener('click', () => setTool(b.dataset.tool));
  $('tool-undo').addEventListener('click', undo);
  for (const b of document.querySelectorAll('[data-color]')) {
    b.addEventListener('click', () => {
      color = b.dataset.color;
      $('tool-color').style.setProperty('--swatch', color);
      for (const x of document.querySelectorAll('[data-color]')) x.setAttribute('aria-pressed', String(x === b));
      $('color-pop').hidePopover?.();
    });
  }
  // Roving tabindex: one tab stop for the toolbar, arrow keys move within it.
  const items = [...toolbar.querySelectorAll('button')];
  items.forEach((b, i) => { b.tabIndex = i === 0 ? 0 : -1; });
  toolbar.addEventListener('keydown', (e) => {
    const i = items.indexOf(document.activeElement);
    if (i === -1) return;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const jump = { Home: 0, End: items.length - 1 }[e.key];
    if (step === undefined && jump === undefined) return;
    e.preventDefault();
    const next = jump ?? (i + step + items.length) % items.length;
    items[i].tabIndex = -1;
    items[next].tabIndex = 0;
    items[next].focus();
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input:not([type=range]),textarea,[contenteditable]')) return;
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); (e.shiftKey ? redo : undo)(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') setTool('view'); // always lands on view: toggling view stays view
    const shortcut = { c: 'comment', d: 'pen', a: 'arrow' }[key];
    if (shortcut) setTool(shortcut);
  });

  const host = stage;
  host.addEventListener('dbs-time', (e) => { nowT = e.detail; fade(); });
  host.addEventListener('dbs-mode', () => { nowT = clock(); fade(); renderMarkers(); });
  addEventListener('resize', renderPins);
  addEventListener('beforeunload', (e) => { if (dirty) e.preventDefault(); });
  $('note').addEventListener('input', changed);

  // ---------------------------------------------------------------- send
  function payload(status) {
    const items = [...marks.children].map((n) => ({
      kind: n.dataset.kind, color: n.getAttribute('stroke'), bbox: bbox(n),
      t: n.dataset.t === '' || n.dataset.t === undefined ? null : Number(n.dataset.t),
    }));
    const vb = svg.viewBox.baseVal;
    const note = $('note').value.trim();
    const at = (t) => (t === null || t === undefined ? '' : ` at ${t} ms`);
    const lines = comments.map((cm) => `${cm.n}.${at(cm.t)} (${cm.x}, ${cm.y}) on ${cm.target.label}: ${cm.text}`);
    items.forEach((it, i) => lines.push(`mark ${i + 1}${at(it.t)}: ${it.kind} around ${it.bbox?.join(', ')}`));
    if (note) lines.unshift(`Note: ${note}`);
    return {
      schema: 'draw-better-svg/review@1',
      status,
      file: cfg.file || null,
      round: cfg.round || null,
      sentAt: new Date().toISOString(),
      viewBox: vb && vb.width ? [vb.x, vb.y, vb.width, vb.height] : null,
      animated: !!window.__dbsStage?.animated,
      times: [...new Set([...comments.map((cm) => cm.t), ...items.map((it) => it.t)].filter((t) => t !== null && t !== undefined))].sort((a, b) => a - b),
      note,
      comments,
      markup: { items, svg: marks.innerHTML },
      pins: pins.innerHTML,
      summary: lines.join('\n') || (status === 'approved' ? 'Approved without changes.' : 'No comments.'),
      checks: cfg.checks ?? null, // what the user saw; the server replaces it with a fresh run
    };
  }
  const status = $('status');
  async function submit(kind) {
    const body = payload(kind);
    for (const b of [$('send'), $('approve')]) b.disabled = true;
    try {
      if (cfg.endpoint) {
        const res = await fetch(cfg.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'x-dbs-token': cfg.token }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
        const { round } = await res.json();
        status.textContent = kind === 'approved' ? `Approved · round ${round}` : `Sent · round ${round}. The agent is working on it; this page updates by itself.`;
      } else {
        const open = (body.checks?.groups ?? []).flatMap((g) => (g.items ?? []).map((x) => `- ${g.name}: ${x}`));
        if (open.length) body.summary += `\nOpen checks (${open.length}):\n${open.join('\n')}`;
        const text = JSON.stringify(body, null, 2);
        const name = `${(body.file || 'svg').replace(/\.svg$/i, '')}.review.json`;
        Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name }).click();
        let copied = false;
        try { await navigator.clipboard.writeText(text); copied = true; } catch { /* blocked on file:// in some browsers */ }
        status.textContent = `Saved ${name}${copied ? ' and copied it' : ''}. Give it to the agent.`;
      }
      dirty = false;
    } catch (err) {
      status.textContent = `Not sent: ${err.message}`;
    } finally {
      $('approve').disabled = false;
      $('send').disabled = !dirty;
    }
  }
  $('send').addEventListener('click', () => submit('changes'));
  $('approve').addEventListener('click', () => submit('approved'));

  // ---------------------------------------------------------------- live reload
  if (cfg.events) {
    new EventSource(cfg.events).addEventListener('changed', () => {
      if (!dirty) { location.reload(); return; }
      const banner = $('banner');
      banner.hidden = false;
      banner.querySelector('button').onclick = () => { dirty = false; location.reload(); };
    });
  }
  canvas.dataset.tool = 'view';
  changed();
  window.__dbsReviewUI = { payload, setTool };
})();
