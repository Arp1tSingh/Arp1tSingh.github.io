/* ============================================================
   reveal.js — sweep-based reveals, counters, skill bars
   ------------------------------------------------------------
   Deliberately NOT IntersectionObserver. An IO only fires on
   threshold crossings: a fast scroll (deep link to #work, restored
   scroll position, Find-in-page) can move an element from below the
   viewport to above it between two checks, so it never intersects,
   never fires, and stays stuck at opacity 0 for good.
   A sweep evaluated on scroll cannot miss.
   ============================================================ */

const EASE_OUT = (t) => 1 - Math.pow(1 - t, 3);

function countUp(el) {
  const target = parseFloat(el.dataset.count || '0');
  const suffix = el.dataset.suffix || '';
  const dur = 1300;
  const start = performance.now();

  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    el.textContent = Math.round(target * EASE_OUT(t)) + suffix;
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = target + suffix;
  };
  requestAnimationFrame(tick);
}

function fillBar(bar) {
  const pct = Math.min(100, parseFloat(bar.dataset.bar || '0'));
  bar.querySelector('.bar__fill').style.width = `${pct}%`;
}

export function initReveal() {
  const targets = [...document.querySelectorAll('.reveal')];
  const counters = [...document.querySelectorAll('[data-count]')];
  const bars = [...document.querySelectorAll('.bar')];

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduce) {
    targets.forEach((el) => el.classList.add('show'));
    counters.forEach((el) => { el.textContent = el.dataset.count + (el.dataset.suffix || ''); });
    bars.forEach(fillBar);
    return;
  }

  // Elements still waiting to appear. Each pass drops whatever has reached
  // the trigger line, so the list only ever shrinks.
  let pending = targets;

  function sweep() {
    if (!pending.length) return;
    const line = window.innerHeight * 0.9;
    pending = pending.filter((el) => {
      if (el.getBoundingClientRect().top > line) return true;
      el.classList.add('show');
      return false;
    });
  }

  let frame = 0;
  function onScroll() {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; sweep(); });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  window.addEventListener('load', onScroll);
  window.addEventListener('hashchange', () => setTimeout(sweep, 120));
  window.addEventListener('pageshow', sweep);
  setTimeout(sweep, 60);
  sweep();

  // Bars and counters ride the same trigger: once they scroll in, animate.
  let barsShown = false;
  const barSweep = () => {
    if (barsShown) return;
    const first = bars[0];
    if (!first || first.getBoundingClientRect().top > window.innerHeight * 0.95) return;
    barsShown = true;
    bars.forEach((bar, i) => {
      bar.style.setProperty('--bd', `${(i * 0.09).toFixed(2)}s`);
      bar.querySelector('.bar__fill').style.width = `${Math.min(100, parseFloat(bar.dataset.bar || 0))}%`;
    });
  };

  let cframe = 0;
  const counterSweep = () => {
    if (cframe) return;
    cframe = requestAnimationFrame(() => {
      cframe = 0;
      counters.forEach((el) => {
        if (el.dataset.done) return;
        if (el.getBoundingClientRect().top < window.innerHeight * 0.95) {
          el.dataset.done = '1';
          countUp(el);
        }
      });
    });
  };

  window.addEventListener('scroll', () => { barSweep(); counterSweep(); }, { passive: true });
  window.addEventListener('load', () => { barSweep(); counterSweep(); });
  barSweep();
  counterSweep();

  /* Expose for any later caller that needs a fresh pass. */
  return sweep;
}

/* --- Timeline spine ------------------------------------------------- */
export function initTimeline() {
  const tl = document.getElementById('tl');
  const fill = document.getElementById('tlFill');
  if (!tl || !fill) return;

  let frame = 0;
  const update = () => {
    frame = 0;
    const r = tl.getBoundingClientRect();
    const anchor = window.innerHeight * 0.62;
    const p = (anchor - r.top) / r.height;
    fill.style.height = `${Math.max(0, Math.min(1, p)) * 100}%`;
  };

  window.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(update);
  }, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
}