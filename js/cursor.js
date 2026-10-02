/* ============================================================
   cursor.js — flat corner reticle, in the spirit of a targeting
   instrument. A 5px dot tracks with zero lag; four 1px brackets
   chase it fast, then lock onto whatever the pointer is over.
   No glow, no mix-blend, no fill.
   ============================================================ */

const MAGNETS = 'a, button, [data-cursor], input, li';

export function initCursor() {
  const root = document.getElementById('cursor');
  if (!root) return;

  const fine = matchMedia('(pointer: fine)').matches;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduce) return;

  // Only suppress the native pointer once we know ours is running, so a JS
  // failure can never leave the visitor with no cursor at all.
  document.documentElement.classList.add('has-cursor');

  const dot = document.getElementById('cursorDot');
  const box = document.getElementById('cursorBox');
  const label = box?.querySelector('.cursor__label');
  if (!dot || !box) return;

  const R = { x: innerWidth / 2, y: innerHeight / 2, w: 26, h: 26 };  // current
  const T = { x: R.x, y: R.y, w: 26, h: 26 };                        // target
  let locked = null;
  let raf = 0;
  let armed = false;
  let firstX = 0, firstY = 0;

  const mix = (a, b, t) => a + (b - a) * t;

  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%,-50%)`;

    // Browsers can fire a single synthetic pointermove during load. Wait
    // until the pointer has actually travelled from wherever it was first
    // seen, so a stationary pointer never leaves a reticle in the corner.
    if (!armed) {
      if (!firstX && !firstY) { firstX = e.clientX; firstY = e.clientY; return; }
      if (Math.hypot(e.clientX - firstX, e.clientY - firstY) < 3) return;
      armed = true;
    }
    root.classList.add('on');

    if (!locked) { T.x = e.clientX; T.y = e.clientY; T.w = 26; T.h = 26; }
  }, { passive: true });

  addEventListener('pointerover', (e) => {
    const hit = e.target instanceof Element ? e.target.closest(MAGNETS) : null;
    if (!hit) return;
    locked = hit;
    root.classList.add('magnet');
    if (label) label.textContent = hit.dataset.cursor || '';
  });

  addEventListener('pointerout', (e) => {
    if (locked && !e.relatedTarget?.closest?.(MAGNETS)) {
      locked = null;
      root.classList.remove('magnet');
    }
  });

  addEventListener('pointerleave', () => root.classList.remove('on'));

  function frame() {
    if (locked) {
      // re-measure every frame so the brackets track elements that move
      const b = locked.getBoundingClientRect();
      T.x = b.left + b.width / 2;
      T.y = b.top + b.height / 2;
      T.w = b.width + 14;
      T.h = b.height + 14;
    }
    R.x = mix(R.x, T.x, 0.34);   // responsive, not floaty
    R.y = mix(R.y, T.y, 0.34);
    R.w = mix(R.w, T.w, 0.28);
    R.h = mix(R.h, T.h, 0.28);

    box.style.width = `${R.w}px`;
    box.style.height = `${R.h}px`;
    box.style.transform = `translate(${R.x - R.w / 2}px, ${R.y - R.h / 2}px)`;

    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  addEventListener('pagehide', () => cancelAnimationFrame(raf));
}