/* ============================================================
   reveal.js — scroll reveals, stat counters, skill bar fills
   ============================================================ */

const EASE_OUT = (t) => 1 - Math.pow(1 - t, 3);

function animateCount(el) {
  const target = parseFloat(el.dataset.count || '0');
  const suffix = el.dataset.suffix || '';
  const dur = 1400;
  const start = performance.now();

  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const val = target * EASE_OUT(t);
    el.textContent = (target % 1 === 0 ? Math.round(val) : val.toFixed(1)) + suffix;
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = target + suffix;
  };

  requestAnimationFrame(tick);
}

export function initReveal() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const targets = document.querySelectorAll('[data-reveal]');
  const counters = document.querySelectorAll('[data-count]');
  const bars = document.querySelectorAll('.bar');

  if (reduce || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-in'));
    counters.forEach((el) => { el.textContent = el.dataset.count + (el.dataset.suffix || ''); });
    bars.forEach((bar) => { bar.querySelector('.bar__fill').style.width = `${bar.dataset.bar}%`; });
    return;
  }

  const io = new IntersectionObserver((entries, obs) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');

      if (entry.target.matches('[data-count]')) animateCount(entry.target);

      if (entry.target.matches('.bar')) {
        // Stagger bars inside the block they belong to.
        const group = [...entry.target.parentElement.children].filter((c) => c.matches('.bar'));
        const i = group.indexOf(entry.target);
        entry.target.style.setProperty('--bd', `${(i * 0.09).toFixed(2)}s`);
        entry.target.querySelector('.bar__fill').style.width = `${Math.min(100, parseFloat(entry.target.dataset.bar || 0))}%`;
      }

      obs.unobserve(entry.target);
    }
  }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });

  targets.forEach((el) => io.observe(el));
  counters.forEach((el) => io.observe(el));
  bars.forEach((el) => io.observe(el));

  // Safety net. IntersectionObserver can coalesce a fast jump (deep link to
  // #work, restored scroll position, back/forward, Find-in-page) so an element
  // may never report as intersecting and would stay stuck at opacity 0.
  // Anything at or above the fold has definitely been passed, so show it.
  // The `:not(.is-in)` selector shrinks as things reveal, so this stays cheap.
  const sweep = () => {
    document.querySelectorAll('[data-reveal]:not(.is-in)').forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.95) el.classList.add('is-in');
    });
  };

  let idle = 0;
  window.addEventListener('scroll', () => {
    clearTimeout(idle);
    idle = setTimeout(sweep, 220);
  }, { passive: true });

  window.addEventListener('load', () => setTimeout(sweep, 500));
  window.addEventListener('hashchange', () => setTimeout(sweep, 200));
  window.addEventListener('pageshow', sweep);
}

/* --- Timeline spine ----------------------------------------------------- */
export function initTimeline() {
  const tl = document.querySelector('.tl');
  const fill = document.getElementById('tlFill');
  if (!tl || !fill) return;

  let frame = 0;

  const update = () => {
    frame = 0;
    const r = tl.getBoundingClientRect();
    const anchor = window.innerHeight * 0.72;
    const progress = (anchor - r.top) / r.height;
    fill.style.height = `${Math.max(0, Math.min(1, progress)) * 100}%`;
  };

  window.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(update);
  }, { passive: true });

  window.addEventListener('resize', update, { passive: true });
  update();
}