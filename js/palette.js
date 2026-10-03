/* ============================================================
   palette.js — ⌘K / Ctrl+K command palette
   Fuzzy subsequence match over sections and projects.
   ============================================================ */

import { NAV_ITEMS, PROJECTS, CONFIG } from './config.js';
import { scrollTo, stopScroll, startScroll, hasMotion } from './scroll.js';

/* Subsequence match with a contiguous-run bonus.
   Exact substrings always win. Returns { score, hits } or null. */
function fuzzy(query, text) {
  if (!query) return { score: 0, hits: [] };

  const q = query.toLowerCase();
  const t = text.toLowerCase();

  const direct = t.indexOf(q);
  if (direct !== -1) {
    return {
      score: 1000 - direct * 4 + (direct === 0 ? 60 : 0),
      hits: Array.from({ length: q.length }, (_, i) => direct + i),
    };
  }

  const hits = [];
  let qi = 0, score = 0, streak = 0;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      hits.push(ti);
      streak += 1;
      score += 10 + streak * 6;
      qi += 1;
    } else {
      streak = 0;
    }
  }
  return qi === q.length ? { score, hits } : null;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function highlight(label, hits) {
  if (!hits || !hits.length) return esc(label);
  const set = new Set(hits);
  let out = '';
  for (let i = 0; i < label.length; i++) {
    const ch = esc(label[i]);
    out += set.has(i) ? `<mark>${ch}</mark>` : ch;
  }
  return out;
}

function buildIndex() {
  const items = NAV_ITEMS.map((n) => ({
    kind: 'section', icon: n.icon, label: n.label, hint: '', href: n.href,
  }));

  PROJECTS.forEach((p) => {
    items.push({
      kind: 'project', icon: 'search', label: p.name, hint: p.desc,
      href: p.href, meta: p.meta,
    });
  });

  items.push({ kind: 'link', icon: 'github',   label: 'GitHub profile',   hint: CONFIG.social.github,   href: CONFIG.social.github,   external: true });
  items.push({ kind: 'link', icon: 'linkedin', label: 'LinkedIn profile', hint: CONFIG.social.linkedin, href: CONFIG.social.linkedin, external: true });
  items.push({ kind: 'link', icon: 'search',   label: 'All repositories', hint: `${PROJECTS.length} featured`, href: CONFIG.social.repos,   external: true });
  if (CONFIG.email) {
    items.push({ kind: 'link', icon: 'mail', label: 'Send an email', hint: CONFIG.email, href: `mailto:${CONFIG.email}`, external: true });
  }
  return items;
}

export function initPalette() {
  const $ = (s) => document.querySelector(s);
  const overlay = $('#palette');
  if (!overlay) return;

  const input = $('#paletteInput');
  const list = $('#paletteList');
  if (!input || !list) return;

  const index = buildIndex();
  let results = [];
  let selected = 0;
  let lastFocus = null;

  function render(query) {
    if (query) {
      results = index
        .map((it) => {
          const m = fuzzy(query, it.label);
          if (!m) return null;
          const hm = fuzzy(query, it.hint || '');
          return { it, score: m.score + (hm ? hm.score * 0.25 : 0), hits: m.hits };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((r) => r.it);
    } else {
      results = index.filter((i) => i.kind === 'section' || i.kind === 'link').slice(0, 8);
    }

    selected = 0;

    if (!results.length) {
      list.innerHTML = `<li class="palette__empty">No matches for “${esc(query)}”</li>`;
      return;
    }

    list.innerHTML = results.map((it, i) => `
      <li role="option" aria-selected="${i === 0}">
        <button class="prow" type="button" data-i="${i}">
          <span class="ic"><svg class="i" viewBox="0 0 24 24"><use href="#i-${it.icon}"/></svg></span>
          <span class="lb">${highlight(it.label, query ? fuzzy(query, it.label)?.hits : [])}</span>
          <span class="kind">${esc(it.meta || it.kind)}</span>
        </button>
      </li>`).join('');
  }

  function paint() {
    const rows = list.querySelectorAll('.prow');
    rows.forEach((r, i) => {
      const on = i === selected;
      r.setAttribute('aria-selected', String(on));
      r.closest('li')?.setAttribute('aria-selected', String(on));
    });
    rows[selected]?.scrollIntoView({ block: 'nearest' });
  }

  function open() {
    lastFocus = document.activeElement;
    overlay.hidden = false;
    // With Lenis armed, freezing the tween is the correct lock. Without it,
    // body overflow is the only thing that stops the page moving underneath.
    if (hasMotion()) stopScroll();
    else document.body.style.overflow = 'hidden';
    input.value = '';
    render('');
    input.focus();
  }

  function close() {
    overlay.hidden = true;
    if (hasMotion()) startScroll();
    else document.body.style.overflow = '';
    lastFocus?.focus?.();
  }

  function run(item) {
    if (!item) return;
    close();
    if (item.href.startsWith('#')) {
      // Route through the same scrollTo as the nav, so a pinned section is
      // never skipped by a raw scrollIntoView.
      scrollTo(item.href);
    } else {
      window.open(item.href, '_blank', 'noopener');
    }
  }

  input.addEventListener('input', () => render(input.value.trim()));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); selected = (selected + 1) % Math.max(results.length, 1); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); selected = (selected - 1 + results.length) % Math.max(results.length, 1); paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(results[selected]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.prow');
    if (btn) run(results[Number(btn.dataset.i)]);
  });

  list.addEventListener('pointermove', (e) => {
    const btn = e.target.closest('.prow');
    if (!btn) return;
    const i = Number(btn.dataset.i);
    if (i !== selected) { selected = i; paint(); }
  });

  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      overlay.hidden ? open() : close();
      return;
    }
    if (e.key === '/' && overlay.hidden && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      open();
    }
  });

  $('#paletteBtn')?.addEventListener('click', open);
}