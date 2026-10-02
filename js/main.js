/* ============================================================
   main.js — orchestration
   ============================================================ */

import { CONFIG, REPOS, GITHUB_STATS } from './config.js';
import { initParticles } from './particles.js';
import { initCursor } from './cursor.js';
import { initTilt } from './tilt.js';
import { initReveal, initTimeline } from './reveal.js';
import { initPalette } from './palette.js';

const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ---------- 1. Boot sequence ------------------------------------------- */
function initBoot() {
  const boot = $('#boot');
  const bar = $('#bootBar');
  const pct = $('#bootPct');
  const text = $('[data-boot-text]');
  if (!boot) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const final = CONFIG.name.toUpperCase();

  if (reduce) {
    text.textContent = final;
    finish();
    return;
  }

  // Scramble the name, then fill the bar.
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\<>#*';
  let frame = 0;
  let scrambleStart = 0;
  const SCRAMBLE_MS = 620;

  function scramble(now) {
    if (!scrambleStart) scrambleStart = now;
    const t = Math.min(1, (now - scrambleStart) / SCRAMBLE_MS);

    text.textContent = final.split('').map((ch, i) => {
      if (ch === ' ') return ' ';
      // Characters settle left-to-right.
      if (i / final.length < t) return ch;
      return GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }).join('');

    if (t < 1) frame = requestAnimationFrame(scramble);
    else finish();
  }

  function finish() {
    text.textContent = final;
    let p = 0;
    const tick = () => {
      p = Math.min(100, p + Math.random() * 18 + 6);
      bar.style.width = `${p}%`;
      pct.textContent = `${String(Math.round(p)).padStart(2, '0')}%`;
      if (p < 100) setTimeout(tick, 90);
      else setTimeout(() => boot.classList.add('is-done'), 220);
    };
    tick();
  }

  requestAnimationFrame(scramble);
  // Belt and braces: never trap the visitor behind the loader.
  setTimeout(() => boot.classList.add('is-done'), 2600);
}

/* ---------- 2. Nav: stuck state, progress, section spy, pill ----------- */
function initNav() {
  const nav = $('#nav');
  const progress = $('#navProgress');
  const links = $$('.nav__links a[data-nav]');
  const pill = $('#navPill');
  const sections = links
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  let frame = 0;
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      nav.classList.toggle('is-stuck', y > 24);
      if (progress) progress.style.width = `${max > 0 ? (y / max) * 100 : 0}%`;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Section spy — the section covering the upper third of the viewport wins.
  if ('IntersectionObserver' in window && sections.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const link = links.find((a) => a.getAttribute('href') === `#${entry.target.id}`);
        if (link) setActive(link);
      });
    }, { rootMargin: '-25% 0px -60% 0px', threshold: 0 });

    sections.forEach((s) => spy.observe(s));
  }

  function setActive(link) {
    links.forEach((l) => l.classList.toggle('is-active', l === link));
    if (!pill) return;

    const navBox = nav.getBoundingClientRect();
    const box = link.getBoundingClientRect();
    const left = box.left - navBox.left;
    const top = box.top - navBox.top;

    pill.style.opacity = '1';
    pill.style.width = `${box.width}px`;
    pill.style.height = `${box.height}px`;
    pill.style.transform = `translate(${left}px, ${top}px)`;
  }

  links.forEach((link) => {
    link.addEventListener('pointerenter', () => setActive(link));
    link.addEventListener('focus', () => setActive(link));
  });
}

/* ---------- 3. Mobile drawer -------------------------------------------- */
function initDrawer() {
  const burger = $('#burger');
  const drawer = $('#drawer');
  if (!burger || !drawer) return;

  const setOpen = (open) => {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    drawer.hidden = !open;
    document.body.classList.toggle('is-locked', open);
  };

  burger.addEventListener('click', () => setOpen(drawer.hidden));
  drawer.addEventListener('click', (e) => {
    if (e.target.closest('a') || e.target === drawer) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !drawer.hidden) setOpen(false);
  });
  // Reset if the viewport grows past the breakpoint while open.
  matchMedia('(min-width: 861px)').addEventListener('change', (e) => {
    if (e.matches) setOpen(false);
  });
}

/* ---------- 4. Hero typewriter ------------------------------------------ */
function initTypewriter() {
  const el = $('#typewriter');
  if (!el) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const roles = CONFIG.roles;
  if (reduce) { el.textContent = roles[0]; return; }

  let r = 0, i = 0, deleting = false, timer = 0;

  const tick = () => {
    const word = roles[r];
    i += deleting ? -1 : 1;
    el.textContent = word.slice(0, i);

    let delay = deleting ? 45 : 78;

    if (!deleting && i === word.length) { deleting = true; delay = 1900; }
    else if (deleting && i === 0) {
      deleting = false;
      r = (r + 1) % roles.length;
      delay = 340;
    }

    timer = setTimeout(tick, delay);
  };

  tick();
  document.addEventListener('visibilitychange', () => {
    clearTimeout(timer);
    if (!document.hidden) tick();
  });
}

/* ---------- 5. Marquee: duplicate the track for a seamless loop -------- */
function initMarquee() {
  $$('[data-marquee]').forEach((marquee) => {
    const track = $('.marquee__track', marquee);
    if (!track) return;
    // Two identical halves translate -100% for a continuous loop.
    track.innerHTML += track.innerHTML;
  });
}

/* ---------- 6. Project filters ------------------------------------------ */
function initFilters() {
  const buttons = $$('.filter');
  const cards = $$('#grid .card');
  if (!buttons.length || !cards.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const want = btn.dataset.filter;

      buttons.forEach((b) => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', String(on));
      });

      cards.forEach((card) => {
        const cats = (card.dataset.cat || '').split(/\s+/);
        const show = want === 'all' || cats.includes(want);
        card.classList.toggle('is-hidden', !show);
      });
    });
  });
}

/* ---------- 7. GitHub activity heatmap --------------------------------- */
function initHeatmap() {
  const host = $('#heatmap');
  if (!host) return;

  const WEEKS = 26;
  const DAY = 86400000;

  // Build one bucket per (repo, created) and (repo, pushed).
  const events = [];
  REPOS.forEach((r) => {
    events.push({ t: Date.parse(r.created + 'T00:00:00Z'), repo: r.name, kind: 'created' });
    events.push({ t: Date.parse(r.pushed + 'T00:00:00Z'), repo: r.name, kind: 'pushed' });
  });

  if (!events.length) return;

  // Anchor to the most recent event so the chart stays meaningful forever,
  // rather than slowly emptying out as real time moves on.
  const anchor = new Date(Math.max(...events.map((e) => e.t)));
  const end = Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate());
  const start = end - (WEEKS * 7 - 1) * DAY;

  const buckets = new Array(WEEKS * 7).fill(0);
  let total = 0;

  for (const e of events) {
    const day = Math.floor((e.t - start) / DAY);
    if (day < 0 || day >= buckets.length) continue;
    buckets[day] += 1;
    total += 1;
  }

  const max = Math.max(1, ...buckets);
  const frag = document.createDocumentFragment();

  // Start on a Sunday so rows line up with weekdays.
  const lead = (new Date(start).getUTCDay() + 7) % 7;
  for (let i = 0; i < lead; i++) {
    const pad = document.createElement('i');
    pad.style.background = 'transparent';
    frag.appendChild(pad);
  }

  buckets.forEach((count) => {
    const cell = document.createElement('i');
    const lvl = count === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4));
    cell.dataset.l = String(lvl);
    cell.title = count ? `${count} repo event${count > 1 ? 's' : ''}` : 'no events';
    frag.appendChild(cell);
  });

  host.appendChild(frag);

  const totalEl = $('#hmTotal');
  if (totalEl) totalEl.textContent = `${total} repo events mapped`;

  // "Active in last 90 days" — measured against the latest push, not today.
  const latestPush = Math.max(...REPOS.map((r) => Date.parse(r.pushed + 'T00:00:00Z')));
  const active = REPOS.filter((r) => Date.parse(r.pushed + 'T00:00:00Z') >= latestPush - 90 * DAY).length;
  const activeEl = $('#statPushes');
  if (activeEl) activeEl.textContent = String(active);

  const sinceEl = $('#statReposSince');
  if (sinceEl) sinceEl.textContent = `since ${GITHUB_STATS.since}`;

  const reposEl = $('#statRepos');
  if (reposEl) reposEl.textContent = String(GITHUB_STATS.repos);
  const starsEl = $('#statStars');
  if (starsEl) starsEl.textContent = String(GITHUB_STATS.stars);
  const folEl = $('#statFollowers');
  if (folEl) folEl.textContent = String(GITHUB_STATS.followers);
}

/* ---------- 8. Contact: copy handle + optional email card --------------- */
function initContact() {
  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  // Copy-to-clipboard on the handle card.
  const btn = $('#copyHandle');
  if (btn) {
    const label = $('#copyLabel');
    const value = $('#copyValue');
    let resetTimer = 0;

    btn.addEventListener('click', async () => {
      const text = CONFIG.handle;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          // Fallback for non-secure contexts (http:// on GitHub Pages root).
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        btn.classList.add('is-done');
        if (label) label.textContent = 'Copied!';
        if (value) value.textContent = 'Handle copied to clipboard';
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
          btn.classList.remove('is-done');
          if (label) label.textContent = 'Copy handle';
          if (value) value.textContent = text;
        }, 2200);
      } catch {
        if (value) value.textContent = text;
      }
    });
  }

  // Render an email card only once CONFIG.email is filled in.
  if (CONFIG.email && !$('#mailCard')) {
    const wrap = $('.contact__links');
    if (wrap) {
      const card = document.createElement('a');
      card.className = 'contact-card';
      card.id = 'mailCard';
      card.href = `mailto:${CONFIG.email}`;
      card.setAttribute('data-tilt', '');
      card.innerHTML = `
        <span class="contact-card__ic"><svg class="i" viewBox="0 0 24 24"><use href="#i-mail"/></svg></span>
        <span class="contact-card__txt">
          <span class="contact-card__t">Email</span>
          <span class="contact-card__s">${CONFIG.email}</span>
        </span>
        <svg class="i contact-card__go" viewBox="0 0 24 24"><use href="#i-arrow-up-right"/></svg>`;
      wrap.appendChild(card);
      initTilt();
    }
  }
}

/* ---------- 9. External links: safe target + noopener -------------------- */
function hardenExternalLinks() {
  $$('a[target="_blank"]').forEach((a) => {
    if (!a.rel.includes('noopener')) a.rel = 'noopener noreferrer';
  });
}

/* ---------- 10. Boot ---------------------------------------------------- */
function start() {
  initBoot();
  initNav();
  initDrawer();
  initTypewriter();
  initMarquee();
  initFilters();
  initHeatmap();
  initContact();
  initReveal();
  initTimeline();
  initPalette();
  initCursor();
  initParticles();
  initTilt();
  hardenExternalLinks();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}