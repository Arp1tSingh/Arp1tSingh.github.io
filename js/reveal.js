/* ============================================================
   reveal.js — entry reveals and hero counters
   ------------------------------------------------------------
   Deliberately NOT IntersectionObserver. An IO only fires on
   threshold crossings: a fast scroll (deep link, restored
   scroll position, Find-in-page) can move an element from
   below the viewport to above it between two checks, so it never
   intersects, never fires, and stays stuck at opacity 0 for good.
   A sweep evaluated on scroll cannot miss.

   The skill bars and the timeline spine used to live here too. They
   do not any more: their un-armed state is the finished state by
   construction (inline bar widths, a full spine, lit dots), so the
   no-JS and prefers-reduced-motion pages are correct without running
   a single line of script. Nothing here needs to compensate for the
   sequences, which is exactly why the fallback is trustworthy.
   ============================================================ */

const EASE_OUT = (t) => 1 - Math.pow(1 - t, 3);

const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const prefersReduced = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches;

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

export function initReveal() {
  const targets = $$('.reveal');
  const counters = $$('[data-count]');

  if (prefersReduced()) {
    targets.forEach((el) => el.classList.add('show'));
    counters.forEach((el) => { el.textContent = el.dataset.count + (el.dataset.suffix || ''); });
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
  const onScroll = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; sweep(); });
  };

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  addEventListener('load', onScroll);
  addEventListener('hashchange', () => setTimeout(sweep, 120));
  addEventListener('pageshow', sweep);
  setTimeout(sweep, 60);
  sweep();

  // Counters are hero-only and sit above the fold on every breakpoint, but
  // they still ride a sweep rather than a timer so a restored scroll position
  // or a slow font swap cannot leave them stuck on zero.
  let done = false;
  const countSweep = () => {
    if (done) return;
    const first = counters[0];
    if (!first) { done = true; return; }
    if (first.getBoundingClientRect().top > window.innerHeight) return;
    done = true;
    counters.forEach((el, i) => setTimeout(() => {
      if (!el.dataset.done) { el.dataset.done = '1'; countUp(el); }
    }, i * 90));
  };

  addEventListener('scroll', countSweep, { passive: true });
  addEventListener('load', countSweep);
  countSweep();
}

/* Nothing else is needed here. The values a scrub would have produced — the
   skill bars, the timeline spine, the timeline dots — are already correct in
   the un-armed state by construction: the bar widths are inline, and the
   spine and dots default to their finished look, with styles.css resetting
   them only under `.js-scroll`. That means the no-JS and
   prefers-reduced-motion pages are correct without running a single line of
   script, which is a stronger guarantee than repainting them from JS. */