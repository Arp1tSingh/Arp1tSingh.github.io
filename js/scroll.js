/* ============================================================
   scroll.js — Lenis + ScrollTrigger, and the four pinned sequences
   ------------------------------------------------------------
   The arming contract:

   Nothing in this file touches the DOM until all three vendor globals
   have resolved AND the visitor has not asked for reduced motion. Only
   then is `js-scroll` added to <html>, which is the class every pinned
   rule in styles.css is scoped under.

   Consequences, all deliberate:
   · JS disabled            → no class → plain stacked document
   · vendor files blocked   → no class → plain stacked document
   · prefers-reduced-motion → no class → plain stacked document

   So there is no state in which a visitor sees a pinned section whose
   scrub transform never runs, or an element stranded at opacity 0.
   ============================================================ */

const { gsap, ScrollTrigger, Lenis } = window;

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

/* One shared instance, so nav links, the palette, the drawer and the
   footer all move the page through one path. */
let lenis = null;

const motionAllowed = () =>
  !matchMedia('(prefers-reduced-motion: reduce)').matches;

export const hasMotion = () => document.documentElement.classList.contains('js-scroll');

/* ---------- anchor navigation -------------------------------------
   Every in-page link goes through here so Lenis can ease to it. With
   no Lenis the browser's own jump (offset by scroll-padding-top) is
   correct and we must not prevent it. */
export function scrollTo(target, { immediate = false } = {}) {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;

  if (!lenis) {
    const top = el.getBoundingClientRect().top + window.scrollY
      - parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) - 18;
    window.scrollTo({ top, behavior: motionAllowed() ? 'smooth' : 'auto' });
    return;
  }

  lenis.scrollTo(el, {
    offset: -parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) - 18,
    duration: 1.1,
    immediate,
  });
}

export function stopScroll() { lenis?.stop(); }
export function startScroll() { lenis?.start(); }

/* ---------- arming ------------------------------------------------ */
export function initScroll() {
  const canRun = motionAllowed() && gsap && ScrollTrigger && Lenis;

  if (!canRun) {
    // Reduced motion, or a vendor file failed to load. Say so in the DOM
    // so the fallback is observable rather than assumed, and hand control
    // back to the plain document.
    document.documentElement.classList.remove('js-scroll');
    return { armed: false, lenis: null };
  }

  gsap.registerPlugin(ScrollTrigger);

  lenis = new Lenis({
    duration: 1.05,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    syncTouch: false,
    touchMultiplier: 1.6,
  });

  // Lenis owns the scroll position; ScrollTrigger must read it every frame
  // or pinned sections drift by a frame during a fast flick. This pairing is
  // the documented Lenis + ScrollTrigger integration.
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  document.documentElement.classList.add('js-scroll');

  const buildAll = () => {
    heroOut();
    aboutSteps();
    workRail();
    toolkitBars();
    journeySpine();
    dockVisibility();
  };

  /* ---------- pin or stand still -------------------------------------
     A pinned sequence needs two things: a viewport that is exactly one screen
     tall, and a scroll range to scrub across. Below these widths the sections
     stack, so the second condition fails — and a pin with `start === end`
     silently freezes its timeline at progress 1, which looks like the scrub
     "not working" rather than like a layout decision.

     So the decision is made here, once, and written onto the section as
     `is-static`. styles.css keys the finished look off that class instead of
     re-deriving the same breakpoints in two places. */
  const STACKED = '(max-width: 1080px)';
  const RAIL_STACKED = '(max-width: 860px)';

  function leaveStatic(section) {
    section?.classList.add('is-static');
    return false;
  }

  function willPin(section, query) {
    if (!section) return false;
    // Clear first: rebuild() re-runs every builder, and a section that used to
    // be static may now be wide enough to pin.
    section.classList.remove('is-static');
    return matchMedia(query).matches ? leaveStatic(section) : true;
  }

  /* ---------- sequence 01 · hero out ------------------------------
     The portrait is the one asset worth moving: it scales and drifts
     right while the type retreats, so the hero reads as a shot rather
     than a static header. */
  function heroOut() {
    const section = $('[data-hero-pin]')?.parentElement;
    if (!section) return;

    const media = $('[data-hero-media]');
    const scrim = $('[data-hero-scrim]');
    const name   = $('#heroName');
    const lead   = $('[data-hero-lead]');
    const stats  = $('[data-hero-stats]');
    const foot   = $('.hero__foot');

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
        pin: section.querySelector('.pin__vp'),
        pinType: 'fixed',
        invalidateOnRefresh: true,
      },
    });

    if (media) tl.to(media, { scale: 1.16, xPercent: 5, ease: 'none' }, 0);
    if (scrim) tl.to(scrim, { opacity: 0.35, ease: 'none' }, 0);
    if (name)   tl.to(name, { yPercent: -18, letterSpacing: '-0.06em', ease: 'none' }, 0);
    if (lead)   tl.to(lead, { yPercent: -60, opacity: 0, ease: 'none' }, 0);
    if (stats)  tl.to(stats, { yPercent: -90, opacity: 0, ease: 'none' }, 0);
    if (foot)   tl.to(foot, { yPercent: -120, opacity: 0, ease: 'none' }, 0);
  }

  /* ---------- sequence 02 · About ---------------------------------
     A stepped statement list. Each step lights up as the statement
     beside it swaps, so the section is a sequence rather than a page
     of paragraphs. */
  function aboutSteps() {
    const section = $('[data-seq="about"]');
    if (!section) return;

    const steps = $$('[data-step]', section);
    const statement = $('[data-statement]', section);
    if (!steps.length || !statement) return;
    if (!willPin(section, STACKED)) return;

    // The statement is the only thing that changes, so it gets the timeline.
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
        pin: $('.pin__vp', section),
        pinType: 'fixed',
        invalidateOnRefresh: true,
      },
    });

    steps.slice(1).forEach((step, i) => {
      const at = (i + 1) / steps.length;
      tl.call(() => {
        steps.forEach((s) => s.classList.remove('is-on'));
        step.classList.add('is-on');
        gsap.fromTo(statement,
          { opacity: 0, y: 26 },
          { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' });
      }, null, at);
    });
  }

  /* ---------- sequence 03 · Work rail -----------------------------
     The signature move. The section pins and the track translates by
     exactly its overflow width, so the last panel arrives flush with
     the right edge at progress 1 and the rail can never overshoot. */
  function workRail() {
    const section = $('[data-seq="work"]');
    const track = $('[data-rail-track]');
    if (!section || !track) return;

    const counter = $('#railNow');
    const panels = $$('.panel', track);
    const getDistance = () => Math.max(0, track.scrollWidth - window.innerWidth);

    // Under 860px the rail is a plain natively-scrollable row instead of a
    // scrub: a drag is a better interaction than a scroll-jack nobody asked
    // for, and there is no vertical room to pin it in anyway.
    if (!willPin(section, RAIL_STACKED)) return;

    gsap.to(track, {
      x: () => -getDistance(),
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${getDistance() + window.innerHeight * 0.5}`,
        scrub: 1,
        pin: $('.pin__vp', section),
        pinType: 'fixed',
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (!counter || !panels.length) return;
          const idx = Math.min(panels.length, Math.max(1,
            Math.ceil(self.progress * panels.length) || 1));
          const next = String(idx).padStart(2, '0');
          if (counter.textContent !== next) counter.textContent = next;
        },
      },
    });
  }

  /* ---------- sequence 04 · Toolkit -------------------------------
     Bars fill against scroll progress rather than on entry, so the
     percentages read as measured rather than decorated. */
  function toolkitBars() {
    const section = $('[data-seq="toolkit"]');
    if (!section) return;

    if (!willPin(section, STACKED)) return;

    const bars = $$('.bar', section);
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
        pin: $('.pin__vp', section),
        pinType: 'fixed',
        invalidateOnRefresh: true,
      },
    });

    bars.forEach((bar) => {
      const pct = parseFloat(bar.dataset.bar || '0');
      const fill = $('.bar__fill', bar);
      const out = $('.bar__pct', bar);
      const counter = { v: 0 };

      tl.to(fill, { scaleX: Math.min(1, pct / 100), ease: 'none', duration: 1 }, 0);
      tl.to(counter, {
        v: pct,
        ease: 'none',
        duration: 1,
        onUpdate: () => { if (out) out.textContent = `${counter.v.toFixed(1)}%`; },
      }, 0);
    });
  }

  /* ---------- sequence 05 · Journey -------------------------------
     The timeline dots ignite as the spine fills, so the left column
     tracks the reader's own scroll instead of a fixed trigger line. */
  function journeySpine() {
    const section = $('[data-seq="journey"]');
    const tl = $('#tl');
    const fill = $('#tlFill');
    if (!section || !tl || !fill) return;
    if (!willPin(section, STACKED)) return;

    gsap.to(fill, {
      height: '100%',
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
        pin: $('.pin__vp', section),
        pinType: 'fixed',
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const items = $$('.tl__item');
          const n = items.length;
          if (!n) return;
          const idx = Math.min(n, Math.max(0, Math.ceil(self.progress * n) - 1));
          items.forEach((it, i) => it.classList.toggle('on', i <= idx));
        },
      },
    });
  }

  /* ---------- the dock --------------------------------------------
     Visible between the end of the hero and the start of the contact
     outro, so it is always a shortcut and never an obstruction. */
  function dockVisibility() {
    const dock = $('#dock');
    if (!dock) return;

    const show = () => dock.classList.add('on');
    const hide = () => dock.classList.remove('on');

    ScrollTrigger.create({ trigger: '[data-hero-pin]', start: 'bottom bottom', onEnter: show, onLeaveBack: hide });
    ScrollTrigger.create({ trigger: '[data-outro]', start: 'top 80%', onEnter: hide, onLeaveBack: show });
    // Belt and braces: if neither trigger fires (deep link, restored scroll),
    // reconcile once on load.
    requestAnimationFrame(() => {
      const past = window.scrollY > window.innerHeight * 0.9;
      const outro = $('[data-outro]');
      const inOutro = outro && outro.getBoundingClientRect().top < window.innerHeight * 0.8;
      if (past && !inOutro) show();
    });
  }

  buildAll();

  // Web fonts land after first paint and change section heights, so the
  // pinned ranges must be recomputed once they are in.
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
  addEventListener('load', () => ScrollTrigger.refresh());

  // `is-static` is decided once, at load. Crossing either breakpoint changes
  // whether a section should be pinned at all, which no CSS rule can repair,
  // so rebuild from scratch rather than leave a pin frozen at progress 1.
  const breakpoints = [matchMedia(STACKED), matchMedia(RAIL_STACKED)];
  const rebuild = () => {
    for (const st of ScrollTrigger.getAll()) st.kill();
    buildAll();
    ScrollTrigger.refresh();
  };
  breakpoints.forEach((mq) => mq.addEventListener('change', rebuild));

  return { armed: true, lenis, refresh: () => ScrollTrigger.refresh() };
}