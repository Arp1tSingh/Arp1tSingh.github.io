/* ============================================================
   scroll.js — Lenis + ScrollTrigger, and the pinned sequences
   ------------------------------------------------------------
   THE ARMING CONTRACT

   Nothing here touches the DOM until all three vendor globals have
   resolved AND the visitor has not asked for reduced motion. Only then
   is `js-scroll` added to <html>, the class every pinned and scrubbed
   rule in styles.css is scoped under.

     · JS disabled            → no class → plain stacked document
     · vendor files blocked   → no class → plain stacked document
     · prefers-reduced-motion → no class → plain stacked document

   There is no state in which a visitor sees a pinned section whose
   scrub never runs.

   PIN OR STAND STILL

   A pin needs a one-screen viewport *and* a scroll range to scrub
   across. Below these widths the sections stack and the second
   condition fails — and a pin with start === end freezes its timeline
   at progress 1, which reads as a broken scrub rather than a layout
   decision. So the call is made here, written onto the section as
   `is-static`, and the stylesheet keys off that class instead of
   re-deriving the same breakpoints in two places.
   ============================================================ */

const { gsap, ScrollTrigger, Lenis } = window;

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

let lenis = null;

const motionAllowed = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
export const hasMotion = () => document.documentElement.classList.contains('js-scroll');

export function scrollTo(target, { immediate = false } = {}) {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;

  const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 64;

  if (!lenis) {
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - navH - 18,
                      behavior: motionAllowed() ? 'smooth' : 'auto' });
    return;
  }
  lenis.scrollTo(el, { offset: -(navH + 18), duration: 1.1, immediate });
}

export function stopScroll() { lenis?.stop(); }
export function startScroll() { lenis?.start(); }

/* ---------- line wipes ---------------------------------------------
   Entrance only. Splitting into .line / .line>span lets CSS do the
   whole thing with a transform and an overflow clip, so there is no
   per-character DOM cost and no JS in the animation itself. */
export function initWipes() {
  const lines = $$('.line');
  if (!lines.length) return;

  if (!motionAllowed()) {
    lines.forEach((l) => l.classList.add('is-in'));
    return;
  }

  const reveal = () => lines.forEach((l, i) =>
    setTimeout(() => l.classList.add('is-in'), 120 + i * 110));

  // Wait for the display face, or the first frame is set in the fallback
  // serif and the wipe animates the wrong metrics.
  if (document.fonts?.ready) document.fonts.ready.then(() => setTimeout(reveal, 60));
  else setTimeout(reveal, 200);
  setTimeout(reveal, 1200);   // never leave the name hidden
}

/* ---------- arming ------------------------------------------------ */
export function initScroll() {
  if (!(motionAllowed() && gsap && ScrollTrigger && Lenis)) {
    document.documentElement.classList.remove('js-scroll');
    return { armed: false };
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
  // or pinned sections drift by a frame during a fast flick.
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  document.documentElement.classList.add('js-scroll');

  const STACKED = '(max-width: 1080px)';
  const NARROW  = '(max-width: 860px)';

  function leaveStatic(section) {
    section?.classList.add('is-static');
    return false;
  }
  function willPin(section, query) {
    if (!section) return false;
    // Clear first: a rebuild re-runs every builder, and a section that was
    // static may now be wide enough to pin.
    section.classList.remove('is-static');
    return matchMedia(query).matches ? leaveStatic(section) : true;
  }

  const pin = (section, extra = {}) => gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1,
      pin: $('.pin__vp', section),
      pinType: 'fixed',
      invalidateOnRefresh: true,
      ...extra,
    },
  });

  /* ---------- hero out ----------------------------------------------
     Nothing moves except the type. The portrait used to live here; now
     the name is the whole screen and it simply retreats. */
  function heroOut() {
    const section = $('[data-hero-pin]')?.parentElement;
    if (!section) return;

    const name = $('[data-hero-name]');
    const mail = $('.hero__mail');
    const meta = $('.hero__meta');
    const tl = pin(section);

    if (name) tl.to(name, { yPercent: -14, letterSpacing: '-.075em', ease: 'none' }, 0);
    if (mail) tl.to(mail, { yPercent: -220, opacity: 0, ease: 'none' }, 0);
    if (meta) tl.to(meta, { yPercent: -320, opacity: 0, ease: 'none' }, 0);
  }

  /* ---------- impact statements --------------------------------------
     Cream to red, tracking tightening. Scrolling literally tightens the
     sentence. This is the site's one unforgettable move. */
  function impacts() {
    $$('[data-seq^="impact-"]').forEach((section) => {
      if (!willPin(section, STACKED)) return;
      const line = $('[data-impact]', section);
      if (!line) return;

      const tl = pin(section);
      // `color` is not scrubbable as a tween in every engine, so the
      // red value is written once and the element cross-fades via a
      // stacked pseudo layer instead. Simplest reliable version:
      // animate the colour directly — GSAP handles computed colours fine.
      tl.to(line, { color: '#e4032e', letterSpacing: '-.045em', ease: 'none' }, 0);
    });
  }

  /* ---------- toolkit share bar --------------------------------------
     One mark, not six. The bar fills against scroll progress and the
     leading percentage counts up with it. */
  function shareBar() {
    const section = $('[data-seq="toolkit"]');
    if (!section || !willPin(section, STACKED)) return;

    const segs = $$('.share__seg', section);
    const big = $('[data-share-big]', section);
    const tl = pin(section);

    // Stagger the segments so the bar wipes across rather than appearing.
    segs.forEach((seg, i) => {
      tl.to(seg, { scaleX: 1, ease: 'none', duration: .5 }, i * 0.075);
    });

    if (big) {
      const counter = { v: 0 };
      tl.to(counter, {
        v: 58.8, ease: 'none', duration: 1,
        onUpdate: () => { big.textContent = counter.v.toFixed(1); },
      }, 0);
    }
  }

  /* ---------- photo band ---------------------------------------------
     A short parallax. Barely perceptible, which is the point: the photo
     is the one moment that gets to be still. */
  function photoBand() {
    const section = $('[data-seq="band"]');
    if (!section || !willPin(section, STACKED)) return;

    const img = $('[data-band-img]', section);
    if (!img) return;

    pin(section).fromTo(img,
      { yPercent: -6, scale: 1.06 },
      { yPercent: 6, ease: 'none' }, 0);
  }

  /* ---------- journey rail ------------------------------------------
     Dates translate by exactly the rail's overflow width, so the last
     day arrives flush with the right edge at progress 1. */
  function journeyRail() {
    const section = $('[data-seq="journey"]');
    const track = $('[data-rail-track]');
    if (!section || !track) return;
    if (!willPin(section, NARROW)) return;

    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth + 80);

    gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${distance() + window.innerHeight * .4}`,
        scrub: 1,
        pin: $('.pin__vp', section),
        pinType: 'fixed',
        invalidateOnRefresh: true,
      },
    });
  }

  /* ---------- the dock ----------------------------------------------
     Visible between the end of the hero and the start of the contact
     block, so it is always a shortcut and never an obstruction. */
  function dockVisibility() {
    const dock = $('#dock');
    if (!dock) return;
    const show = () => dock.classList.add('on');
    const hide = () => dock.classList.remove('on');

    ScrollTrigger.create({ trigger: '[data-hero-pin]', start: 'bottom bottom', onEnter: show, onLeaveBack: hide });
    ScrollTrigger.create({ trigger: '#contact', start: 'top 85%', onEnter: hide, onLeaveBack: show });

    requestAnimationFrame(() => {
      const contact = $('#contact');
      const past = scrollY > innerHeight * .9;
      const inOutro = contact && contact.getBoundingClientRect().top < innerHeight * .85;
      if (past && !inOutro) show();
    });
  }

  const buildAll = () => {
    heroOut();
    impacts();
    shareBar();
    photoBand();
    journeyRail();
    dockVisibility();
  };

  buildAll();

  // Web fonts land after first paint and change section heights, so the
  // pinned ranges must be recomputed once they are in.
  if (document.fonts?.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  addEventListener('load', () => ScrollTrigger.refresh());

  // `is-static` is a one-way decision made at load. Crossing either
  // breakpoint changes whether a section should be pinned at all, which
  // no CSS rule can repair, so rebuild from scratch.
  [matchMedia(STACKED), matchMedia(NARROW)].forEach((mq) =>
    mq.addEventListener('change', () => {
      ScrollTrigger.getAll().forEach((st) => st.kill());
      buildAll();
      ScrollTrigger.refresh();
    }));

  return { armed: true, lenis };
}