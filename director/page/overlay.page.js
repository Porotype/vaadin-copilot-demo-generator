// Runs inside the recorded page (installed with page.addInitScript).
//
// A dumb renderer: the director computes the whole overlay state for a frame in Node and calls
// window.__director.render(state). Nothing here animates on its own (no CSS transitions, no timers),
// so a frame looks the same whether it is captured in real time or stepped one screenshot at a time.
//
// The overlay lives in the top layer (a manual popover) so it draws above Copilot's own popovers and
// dialogs, and is re-raised whenever something else enters the top layer. Every element has
// pointer-events: none, so hit testing, hover and drag-and-drop go to the app as if it were absent.
(() => {
  if (window.__director) return;

  const CURSOR_SVG = `
    <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 3 L6 23 L11 18.2 L14.4 25.6 L18 24 L14.7 16.8 L21.5 16.8 Z"
            fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>
    </svg>`;

  const STYLE = `
    :host { all: initial; }
    .root { position: fixed; inset: 0; pointer-events: none; overflow: hidden;
            font-family: Inter, "Segoe UI", system-ui, sans-serif; }
    .root * { pointer-events: none; box-sizing: border-box; }
    .spot { position: absolute; border-radius: 10px; box-shadow: 0 0 0 200vmax rgba(10, 14, 24, 0.62); }
    .spot-ring { position: absolute; border-radius: 10px; border: 2px solid rgba(255,255,255,0.85); }
    .spot-ring.outline { border: 3px solid #ff8a1f; box-shadow: 0 0 0 4px rgba(255,138,31,0.22), 0 0 18px rgba(255,138,31,0.35); }
    .ghost { position: absolute; border-radius: 8px; overflow: hidden;
             box-shadow: 0 12px 28px rgba(0,0,0,0.28), 0 2px 6px rgba(0,0,0,0.18); }
    .ghost img { display: block; width: 100%; height: 100%; }
    .ghost .chip { padding: 8px 14px; background: #fff; color: #1a1f2b; font-size: 14px; font-weight: 600;
                   border: 1px solid rgba(0,0,0,0.12); border-radius: 8px; white-space: nowrap; }
    .ripple { position: absolute; border-radius: 50%; border: 3px solid rgba(37, 99, 235, 0.9);
              background: rgba(37, 99, 235, 0.18); }
    .cursor { position: absolute; width: 28px; height: 28px; transform-origin: 6px 3px;
              filter: drop-shadow(0 2px 3px rgba(0,0,0,0.35)); }
    .halo { position: absolute; border-radius: 50%; background: rgba(250, 204, 21, 0.35); }
    .callout { position: absolute; max-width: 360px; padding: 12px 16px; border-radius: 12px;
               background: #12182a; color: #fff; font-size: 17px; line-height: 1.35; font-weight: 500;
               box-shadow: 0 14px 34px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.08); }
    .callout .arrow { position: absolute; width: 14px; height: 14px; background: #12182a; transform: rotate(45deg); }
    .callout .kicker { display: block; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase;
                       color: #8fb3ff; margin-bottom: 4px; font-weight: 700; }
    .card { position: absolute; border-radius: 14px; background: #10151f; color: #e6ebf4;
            box-shadow: 0 22px 50px rgba(0,0,0,0.38), 0 0 0 1px rgba(255,255,255,0.08); overflow: hidden; }
    .card .head { display: flex; align-items: baseline; gap: 10px; padding: 12px 18px 10px;
                  border-bottom: 1px solid rgba(255,255,255,0.08); }
    .card .kicker { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #8fb3ff; font-weight: 700; }
    .card .title { font-size: 15px; font-weight: 600; }
    .card pre { margin: 0; padding: 10px 0 12px; font: 14px/1.55 "JetBrains Mono", "SFMono-Regular", Menlo, monospace; }
    .card .l { display: block; padding: 0 18px 0 14px; white-space: pre; border-left: 4px solid transparent; }
    .card .l.add { background: rgba(46, 160, 67, 0.20); border-left-color: #3fb950; }
    .card .l.del { background: rgba(248, 81, 73, 0.16); border-left-color: #f85149; color: #ffb3ad; }
    .card .l.gap { color: #6e7a90; }
    .card .body { padding: 14px 18px 16px; font-size: 18px; line-height: 1.4; }
    .title-card { position: absolute; padding: 18px 26px 20px; border-radius: 16px; background: rgba(16, 21, 31, 0.94);
                  color: #fff; box-shadow: 0 22px 50px rgba(0,0,0,0.35); }
    .title-card .kicker { display: block; font-size: 14px; letter-spacing: 0.1em; text-transform: uppercase; color: #8fb3ff;
                          font-weight: 700; margin-bottom: 6px; }
    .title-card .text { font-size: 34px; font-weight: 700; letter-spacing: -0.01em; }
    .title-card .sub { display: block; font-size: 18px; color: #c4cbe0; margin-top: 6px; font-weight: 500; }
  `;

  let host, shadow, root;

  function ensureHost() {
    if (host && host.isConnected) return;
    host = document.createElement('director-overlay');
    host.setAttribute('popover', 'manual');
    host.style.cssText =
      'all: initial; position: fixed; inset: 0; width: 100vw; height: 100vh; margin: 0; padding: 0;' +
      'border: 0; background: transparent; overflow: visible; pointer-events: none;';
    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${STYLE}</style><div class="root"></div>`;
    root = shadow.querySelector('.root');
    (document.body || document.documentElement).appendChild(host);
  }

  // The top layer is ordered by insertion; re-showing our popover moves it back on top. Copilot
  // re-promotes its own popovers whenever a Vaadin overlay opens, without changing how many elements
  // are in the top layer, so there is nothing cheap to detect: re-raise on every frame.
  function raise() {
    try {
      if (host.matches(':popover-open')) host.hidePopover();
      host.showPopover();
    } catch (e) {
      host.style.zIndex = '2147483647'; // popover unsupported: plain z-index fallback
    }
  }

  // Keyed element pool so a frame only touches what changed.
  const pool = new Map();
  function el(key, cls, html) {
    let e = pool.get(key);
    if (!e) {
      e = document.createElement('div');
      e.className = cls;
      if (html != null) e.innerHTML = html;
      pool.set(key, e);
    }
    return e;
  }

  function place(e, x, y, w, h) {
    e.style.left = `${x}px`;
    e.style.top = `${y}px`;
    if (w != null) e.style.width = `${w}px`;
    if (h != null) e.style.height = `${h}px`;
  }

  function renderCallout(c, used) {
    const key = `callout:${c.id}`;
    const e = el(key, 'callout');
    used.add(key);
    const html = (c.kicker ? `<span class="kicker"></span>` : '') + `<span class="text"></span><div class="arrow"></div>`;
    if (e.dataset.sig !== `${c.kicker}|${c.text}`) {
      e.innerHTML = html;
      if (c.kicker) e.querySelector('.kicker').textContent = c.kicker;
      e.querySelector('.text').textContent = c.text;
      e.dataset.sig = `${c.kicker}|${c.text}`;
    }
    root.appendChild(e);
    // Measure, then place next to the anchor on the requested side, clamped to the viewport.
    const w = e.offsetWidth, h = e.offsetHeight, gap = 16, vw = innerWidth, vh = innerHeight;
    const a = c.anchor; // {x, y, w, h}
    let side = c.placement;
    if (side === 'auto') {
      const room = { top: a.y, bottom: vh - (a.y + a.h), left: a.x, right: vw - (a.x + a.w) };
      side = ['bottom', 'top', 'right', 'left'].find(s => room[s] > (s === 'top' || s === 'bottom' ? h : w) + gap + 8) || 'bottom';
    }
    let x, y;
    if (side === 'top' || side === 'bottom') {
      x = a.x + a.w / 2 - w / 2;
      y = side === 'top' ? a.y - h - gap : a.y + a.h + gap;
    } else {
      y = a.y + a.h / 2 - h / 2;
      x = side === 'left' ? a.x - w - gap : a.x + a.w + gap;
    }
    x = Math.max(12, Math.min(vw - w - 12, x));
    y = Math.max(12, Math.min(vh - h - 12, y));
    // Entrance: fade and slide in from the anchor side, driven by c.t (0..1).
    const t = c.t, slide = (1 - t) * 10;
    const dx = side === 'left' ? -slide : side === 'right' ? slide : 0;
    const dy = side === 'top' ? -slide : side === 'bottom' ? slide : 0;
    place(e, x - dx, y - dy);
    e.style.opacity = String(t);
    const arrow = e.querySelector('.arrow');
    const ax = Math.max(14, Math.min(w - 28, a.x + a.w / 2 - x - 7));
    const ay = Math.max(12, Math.min(h - 26, a.y + a.h / 2 - y - 7));
    arrow.style.left = side === 'left' ? `${w - 8}px` : side === 'right' ? '-6px' : `${ax}px`;
    arrow.style.top = side === 'top' ? `${h - 8}px` : side === 'bottom' ? '-6px' : `${ay}px`;
  }

  // Cards sit in screen space: a code card (diff lines) or a title card (chapter heading).
  function renderCard(c, used) {
    const key = `card:${c.id}`;
    const e = el(key, c.kind === 'title' ? 'title-card' : 'card');
    used.add(key);
    if (e.dataset.sig !== c.sig) {
      e.innerHTML = '';
      const add = (parent, tag, cls, text) => {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        parent.appendChild(n);
        return n;
      };
      if (c.kind === 'title') {
        if (c.kicker) add(e, 'span', 'kicker', c.kicker);
        add(e, 'div', 'text', c.title);
        if (c.text) add(e, 'span', 'sub', c.text);
      } else {
        const head = add(e, 'div', 'head');
        if (c.kicker) add(head, 'span', 'kicker', c.kicker);
        if (c.title) add(head, 'span', 'title', c.title);
        if (c.lines) {
          const pre = add(e, 'pre');
          for (const l of c.lines) add(pre, 'span', 'l ' + (l.type === '+' ? 'add' : l.type === '-' ? 'del' : l.type === '~' ? 'gap' : ''), l.text || ' ');
        }
        if (c.text) add(e, 'div', 'body', c.text);
      }
      e.dataset.sig = c.sig;
    }
    if (c.width) e.style.width = `${c.width}px`;
    root.appendChild(e);
    const w = e.offsetWidth, h = e.offsetHeight, vw = innerWidth, vh = innerHeight, m = 28;
    const pos = c.position || 'right';
    let x = pos.x ?? (pos === 'left' || pos === 'bottom-left' ? m : pos === 'center' || pos === 'bottom' ? (vw - w) / 2 : vw - w - m);
    let y = pos.y ?? (pos === 'center' ? (vh - h) / 2 : pos.startsWith?.('bottom') ? vh - h - m - 60 : (vh - h) / 2);
    const slide = (1 - c.t) * 16;
    place(e, x, y + slide);
    e.style.opacity = String(c.t);
  }

  function render(s) {
    ensureHost();
    raise();
    const used = new Set();

    if (s.spotlight && s.spotlight.t > 0) {
      const r = s.spotlight.rect, pad = s.spotlight.padding;
      const ring = el('spot-ring', 'spot-ring');
      used.add('spot-ring');
      ring.classList.toggle('outline', s.spotlight.dim === false);
      place(ring, r.x - pad, r.y - pad, r.w + 2 * pad, r.h + 2 * pad);
      ring.style.opacity = String(s.spotlight.t);
      if (s.spotlight.dim !== false) {
        const spot = el('spot', 'spot');
        used.add('spot');
        place(spot, r.x - pad, r.y - pad, r.w + 2 * pad, r.h + 2 * pad);
        spot.style.opacity = ring.style.opacity;
        root.appendChild(spot);
      }
      root.appendChild(ring);
    }

    for (const r of s.ripples || []) {
      const key = `ripple:${r.id}`;
      const e = el(key, 'ripple');
      used.add(key);
      const size = 14 + r.t * 46;
      place(e, r.x - size / 2, r.y - size / 2, size, size);
      e.style.opacity = String(1 - r.t);
      root.appendChild(e);
    }

    if (s.ghost && s.cursor) {
      const g = s.ghost;
      const e = el(`ghost:${g.id}`, 'ghost');
      used.add(`ghost:${g.id}`);
      if (e.dataset.id !== g.id) {
        e.innerHTML = g.image ? `<img src="${g.image}">` : `<div class="chip"></div>`;
        if (!g.image) e.querySelector('.chip').textContent = g.label || '';
        e.dataset.id = g.id;
      }
      // The grab point stays under the cursor, like the native drag image.
      place(e, s.cursor.x - g.grabX, s.cursor.y - g.grabY, g.w || null, g.h || null);
      e.style.opacity = String(g.opacity);
      root.appendChild(e);
    }

    if (s.cursor && s.cursor.visible) {
      const c = s.cursor;
      if (c.halo) {
        const h = el('halo', 'halo');
        used.add('halo');
        const size = 44;
        place(h, c.x - size / 2, c.y - size / 2, size, size);
        root.appendChild(h);
      }
      const e = el('cursor', 'cursor', CURSOR_SVG);
      used.add('cursor');
      // The SVG tip is at (6,3).
      place(e, c.x - 6, c.y - 3);
      e.style.transform = `scale(${c.pressed ? 0.86 : 1})`;
      root.appendChild(e);
    }

    for (const c of s.callouts || []) renderCallout(c, used);
    for (const c of s.cards || []) renderCard(c, used);

    for (const [key, e] of pool) {
      if (!used.has(key) && e.parentNode) e.remove();
    }
  }

  window.__director = { render, version: 1 };
})();
