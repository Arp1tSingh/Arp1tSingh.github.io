/* ============================================================
   tilt.js — pointer-driven 3D tilt + glow tracking
   Only for fine pointers, and only while the element is on screen.
   ============================================================ */

export function initTilt() {
  const fine = window.matchMedia('(pointer: fine)').matches;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduce) return;

  const MAX = 7; // degrees
  const items = document.querySelectorAll('[data-tilt]');
  if (!items.length) return;

  let visible = new Set();

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) visible.add(e.target);
      else visible.delete(e.target);
    }
  }, { threshold: 0.15 });

  items.forEach((el) => {
    io.observe(el);

    let frame = 0;

    el.addEventListener('pointermove', (e) => {
      if (!visible.has(el) || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;   // 0..1
        const py = (e.clientY - r.top) / r.height;   // 0..1

        el.style.setProperty('--rx', `${((0.5 - py) * MAX * 2).toFixed(2)}deg`);
        el.style.setProperty('--ry', `${((px - 0.5) * MAX * 2).toFixed(2)}deg`);
        el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
        el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
      });
    }, { passive: true });

    const reset = () => {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    };
    el.addEventListener('pointerleave', reset);
    el.addEventListener('blur', reset, true);
  });
}