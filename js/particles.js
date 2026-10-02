/* ============================================================
   particles.js — drifting constellation background
   DPR-aware, pauses when hidden, disabled under reduced motion.
   ============================================================ */

export function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const LINK_DIST = 132;   // px within which nodes connect
  const POINTER_R = 150;   // px radius the cursor pushes nodes out of
  const SPEED = 0.16;

  let w = 0, h = 0, dpr = 1, nodes = [], raf = 0, running = false;
  const pointer = { x: -9999, y: -9999, active: false };

  const PALETTE = ['34,211,238', '168,85,247', '244,114,182'];

  function sizeToViewport() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }

  function seed() {
    // Density scales with viewport area, clamped so it never gets silly.
    const target = Math.round(Math.min(130, Math.max(38, (w * h) / 17000)));
    nodes = new Array(target).fill(0).map(() => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * SPEED,
      vy: (Math.random() - 0.5) * SPEED,
      r: 0.7 + Math.random() * 1.5,
      c: PALETTE[(Math.random() * PALETTE.length) | 0],
    }));
  }

  function step() {
    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];

      n.x += n.vx;
      n.y += n.vy;

      // Wrap around the edges instead of bouncing (no visible edge pile-up).
      if (n.x < -20) n.x = w + 20; else if (n.x > w + 20) n.x = -20;
      if (n.y < -20) n.y = h + 20; else if (n.y > h + 20) n.y = -20;

      if (pointer.active) {
        const dx = n.x - pointer.x;
        const dy = n.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < POINTER_R * POINTER_R && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = ((POINTER_R - d) / POINTER_R) * 0.55;
          n.x += (dx / d) * push;
          n.y += (dy / d) * push;
        }
      }

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${n.c},.55)`;
      ctx.fill();
    }

    // Proximity links — only compare each pair once.
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        if (dx > LINK_DIST || dx < -LINK_DIST || dy > LINK_DIST || dy < -LINK_DIST) continue;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > LINK_DIST) continue;
        const a1 = (1 - d / LINK_DIST) * 0.28;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(34,211,238,${a1.toFixed(3)})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    }

    raf = requestAnimationFrame(step);
  }

  function start() {
    if (reduce || running) return;
    running = true;
    raf = requestAnimationFrame(step);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  // --- events -------------------------------------------------------------
  window.addEventListener('resize', sizeToViewport, { passive: true });

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.active = true;
  }, { passive: true });

  window.addEventListener('pointerleave', () => { pointer.active = false; });

  document.addEventListener('visibilitychange', () => {
    document.hidden ? stop() : start();
  });

  // Stop burning frames when the tab is scrolled far past the hero.
  const hero = document.getElementById('hero');
  if (hero) {
    new IntersectionObserver(([entry]) => {
      entry.isIntersecting ? start() : stop();
    }, { threshold: 0 }).observe(hero);
  }

  sizeToViewport();
  if (reduce) {
    // One static frame so the background still reads as designed.
    step();
    stop();
  } else {
    start();
  }
}