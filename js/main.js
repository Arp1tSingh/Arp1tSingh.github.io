/* ============================================================
   main.js — orchestration
   ============================================================

   Boot order matters in one place only: initScroll() must run before
   anything that asks hasMotion(), because it is what decides whether
   the pinned sequences exist. Everything else is independent.
   ============================================================ */

import { CONFIG, GITHUB_STATS } from './config.js';
import { initReveal } from './reveal.js';
import { initCursor } from './cursor.js';
import { initPalette } from './palette.js';
import { initScroll, scrollTo, stopScroll, startScroll, hasMotion } from './scroll.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

/* ---------- 1. Boot ------------------------------------------------- */
function initBoot() {
  const boot = $('#boot');
  if (!boot) return;

  const mark = $('#bootMark');
  const bar = $('#bootBar');
  const pct = $('#bootPct');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduce) { boot.remove(); return; }

  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\<>#*';
  const final = CONFIG.name.toUpperCase();
  let t0 = 0;

  function scramble(now) {
    if (!t0) t0 = now;
    const t = Math.min(1, (now - t0) / 620);
    mark.textContent = final.split('').map((ch, i) => {
      if (ch === ' ') return ' ';
      if (i / final.length < t) return ch;
      return GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }).join('');
    if (t < 1) requestAnimationFrame(scramble);
    else fill();
  }

  function fill() {
    mark.textContent = final;
    let p = 0;
    const tick = () => {
      p = Math.min(100, p + Math.random() * 20 + 8);
      bar.style.width = `${p}%`;
      pct.textContent = String(Math.round(p)).padStart(2, '0');
      if (p < 100) setTimeout(tick, 80);
      else setTimeout(() => boot.classList.add('is-done'), 200);
    };
    tick();
  }

  requestAnimationFrame(scramble);
  setTimeout(() => boot.classList.add('is-done'), 2600);   // never trap the visitor
}

/* ---------- 2. Hero name, per character ---------------------------- */
function initHeroName() {
  const el = $('#heroName');
  if (!el) return;
  const text = el.textContent.trim();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  el.textContent = '';
  [...text].forEach((ch, i) => {
    const span = document.createElement('span');
    span.className = ch === ' ' ? 'sp' : 'ch';
    span.textContent = ch === ' ' ? ' ' : ch;
    if (!reduce) span.style.transitionDelay = `${(i * 0.05).toFixed(3)}s`;
    el.appendChild(span);
  });

  if (reduce) { el.classList.add('revealed'); return; }
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('revealed')));
}

/* ---------- 3. Typewriter ------------------------------------------ */
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

    let delay = deleting ? 42 : 74;
    if (!deleting && i === word.length) { deleting = true; delay = 1700; }
    else if (deleting && i === 0) { deleting = false; r = (r + 1) % roles.length; delay = 320; }

    timer = setTimeout(tick, delay);
  };

  tick();
  document.addEventListener('visibilitychange', () => {
    clearTimeout(timer);
    if (!document.hidden) tick();
  });
}

/* ---------- 4. Nav -------------------------------------------------- */
function initNav() {
  const nav = $('#nav');
  const rail = $('#navRail');
  const links = $$('.nav__links a[data-nav]');
  const sections = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);

  let frame = 0;
  const onScroll = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const y = scrollY;
      const max = document.documentElement.scrollHeight - innerHeight;
      nav.classList.toggle('stuck', y > 20);
      if (rail) rail.style.width = `${max > 0 ? (y / max) * 100 : 0}%`;
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const setActive = (link) => links.forEach((l) => l.classList.toggle('on', l === link));

  if ('IntersectionObserver' in window && sections.length) {
    // Purely for navigation state, so a missed fire is cosmetic, not fatal.
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const link = links.find((a) => a.getAttribute('href') === `#${entry.target.id}`);
        if (link) setActive(link);
      });
    }, { rootMargin: '-20% 0px -65% 0px' });
    sections.forEach((s) => spy.observe(s));
  }
  links.forEach((l) => { l.addEventListener('pointerenter', () => setActive(l)); l.addEventListener('focus', () => setActive(l)); });
}

/* ---------- 5. Drawer ----------------------------------------------- */
function initDrawer() {
  const burger = $('#burger');
  const drawer = $('#drawer');
  if (!burger || !drawer) return;

  const setOpen = (open) => {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    drawer.hidden = !open;
    if (open) stopScroll(); else startScroll();
    if (!hasMotion()) document.body.style.overflow = open ? 'hidden' : '';
  };

  burger.addEventListener('click', () => setOpen(drawer.hidden));
  drawer.addEventListener('click', (e) => {
    if (e.target.closest('a') || e.target === drawer) setOpen(false);
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) setOpen(false); });
  matchMedia('(min-width: 861px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
}

/* ---------- 6. Anchor links ----------------------------------------
   Every in-page jump goes through scroll.js so Lenis eases it and the
   fixed header offset is applied consistently. Without Lenis the native
   jump is used and only the default is prevented when we can offset it
   ourselves. */
function initAnchors() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (!id || id === '#') return;
    const target = document.querySelector(id);
    if (!target) return;           // let the browser handle unknown anchors

    e.preventDefault();
    scrollTo(target);
    // Keep the URL shareable without letting the browser's own jump fight
    // the tween.
    history.replaceState(null, '', id);
  });
}

/* ---------- 7. Copy to clipboard -----------------------------------
   Shared by the contact card and the dock button. */
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/* ---------- 8. Contact ---------------------------------------------- */
function initContact() {
  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  const btn = $('#copyHandle');
  const label = $('#copyLabel');
  const value = $('#copyValue');
  let resetTimer = 0;

  btn?.addEventListener('click', async () => {
    const ok = await copyText(CONFIG.handle);
    if (!ok) return;                     // clipboard blocked — leave it visible
    btn.classList.add('is-done');
    if (label) label.textContent = 'Copied';
    if (value) value.textContent = 'handle copied to clipboard';
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      btn.classList.remove('is-done');
      if (label) label.textContent = 'Copy handle';
      if (value) value.textContent = CONFIG.handle;
    }, 2200);
  });

  // The dock's own copy button copies the email address, which is the
  // action a visitor hovering it is most likely to want.
  const dockBtn = $('#dockCopy');
  const dockMail = $('.dock__mail span');
  let dockTimer = 0;
  dockBtn?.addEventListener('click', async () => {
    const ok = await copyText(CONFIG.email);
    if (!ok) return;
    dockBtn.classList.add('done');
    if (dockMail) dockMail.textContent = 'Email copied';
    clearTimeout(dockTimer);
    dockTimer = setTimeout(() => {
      dockBtn.classList.remove('done');
      if (dockMail) dockMail.textContent = CONFIG.email;
    }, 2200);
  });
}

/* ---------- 9. Commit calendar --------------------------------------
   Rendered from data/commits.json, which tools/fetch-commits.mjs
   generates straight from the GitHub API. Nothing here is invented.
   ------------------------------------------------------------------ */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = 86400000;

async function initCommits() {
  const grid = $('#calGrid');
  const note = $('#calNote');
  if (!grid) return;

  let data;
  try {
    const res = await fetch('./data/commits.json');
    if (!res.ok) throw new Error(res.status);
    data = await res.json();
  } catch {
    if (note) note.textContent = 'commit data unavailable';
    return;
  }

  const days = data.days || {};
  const counts = Object.values(days);
  const max = Math.max(1, ...counts);

  // 53 columns x 7 rows, ending on the week containing the latest commit.
  const endDate = new Date(`${data.last}T00:00:00Z`);
  const end = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate());
  const firstMs = Date.parse(`${data.first}T00:00:00Z`);
  const lastCol = Math.floor((end - firstMs) / DAY / 7);

  const frag = document.createDocumentFragment();
  const monthMarks = [];
  let prevMonth = -1;

  for (let col = 0; col <= lastCol; col++) {
    // Leading blanks so row 0 is always Sunday.
    if (col === 0) {
      const firstDate = new Date(firstMs);
      for (let k = 0; k < firstDate.getUTCDay(); k++) {
        const blank = document.createElement('i');
        blank.style.visibility = 'hidden';
        frag.appendChild(blank);
      }
    }

    for (let row = 0; row < 7; row++) {
      const t = firstMs + (col * 7 + row) * DAY;
      if (t > end) {
        const blank = document.createElement('i');
        blank.style.visibility = 'hidden';
        frag.appendChild(blank);
        continue;
      }
      const iso = new Date(t).toISOString().slice(0, 10);
      const n = days[iso] || 0;
      const cell = document.createElement('i');
      cell.className = 'cal__cell';
      cell.dataset.l = String(n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
      cell.title = n ? `${n} commit${n > 1 ? 's' : ''} · ${iso}` : `no commits · ${iso}`;
      frag.appendChild(cell);

      if (row === 0) {
        const m = new Date(t).getUTCMonth();
        if (m !== prevMonth) { prevMonth = m; monthMarks.push({ m, col }); }
      }
    }
  }
  grid.appendChild(frag);

  // Month labels sit above the first week whose Monday begins that month.
  const months = $('#calMonths');
  if (months) {
    const mf = document.createDocumentFragment();
    for (let col = 0; col <= lastCol; col++) {
      const s = document.createElement('span');
      const mark = monthMarks.find((x) => x.col === col);
      s.textContent = mark ? MONTHS[mark.m] : '';
      mf.appendChild(s);
    }
    months.appendChild(mf);
  }

  const fmt = (iso) => {
    if (!iso) return '—';
    const d = new Date(`${iso}T00:00:00Z`);
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };

  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('#cTotal', data.total);
  set('#cDays', data.activeDays);
  set('#cFirst', fmt(data.first));
  set('#calRange', `${data.activeDays} active days`);
  set('#cRepos', String(GITHUB_STATS.repos));
  if (note) {
    note.textContent = `generated ${data.generated} · ${data.total} commits across ${GITHUB_STATS.repos} repositories`;
  }
}

/* ---------- 10. Safety --------------------------------------------- */
function hardenExternalLinks() {
  $$('a[target="_blank"]').forEach((a) => {
    if (!a.rel.includes('noopener')) a.rel = 'noopener noreferrer';
  });
}

/* ---------- boot ---------------------------------------------------- */
function start() {
  initBoot();
  initHeroName();
  initNav();
  initDrawer();
  initTypewriter();
  initAnchors();
  initContact();
  initCommits();
  initPalette();
  initCursor();
  hardenExternalLinks();

  // Last, because it decides the page's motion architecture. There is no
  // compensating branch afterwards: the un-armed state is already the
  // finished state in CSS, so reduced-motion and no-JS need no repainting.
  initScroll();
  initReveal();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}