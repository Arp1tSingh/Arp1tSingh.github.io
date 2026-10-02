/* ============================================================
   cursor.js — dot + lagging ring, magnetises to interactive elements
   Skipped entirely on touch / reduced-motion.
   ============================================================ */

export function initCursor() {
  const root = document.getElementById('cursor');
  if (!root) return;

  const fine = window.matchMedia('(pointer: fine)').matches;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduce) return;

  // Only suppress the native cursor once we know the custom one is running,
  // so a JS failure can never leave the visitor with no pointer at all.
  document.documentElement.classList.add('has-custom-cursor');

  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  const label = ring?.querySelector('.cursor__label');

  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let rx = mx, ry = my;
  let raf = 0;

  const MAGNETS = 'a, button, [data-tilt], [data-cursor], input, .chip';

  function loop() {
    // Ring eases toward the pointer; the dot is already there.
    rx += (mx - rx) * 0.16;
    ry += (my - ry) * 0.16;

    if (dot) dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
    if (ring) ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;

    raf = requestAnimationFrame(loop);
  }

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX;
    my = e.clientY;
    root.classList.add('is-on');

    const target = e.target instanceof Element ? e.target.closest(MAGNETS) : null;
    if (target) {
      root.classList.add('is-magnet');
      if (label) label.textContent = target.dataset.cursor || '';
    } else {
      root.classList.remove('is-magnet');
    }
  }, { passive: true });

  document.addEventListener('pointerleave', () => root.classList.remove('is-on'));
  window.addEventListener('blur', () => root.classList.remove('is-on'));

  raf = requestAnimationFrame(loop);
  window.addEventListener('pagehide', () => cancelAnimationFrame(raf));
}