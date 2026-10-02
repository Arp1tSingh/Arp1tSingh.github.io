/* ============================================================
   palette.js — ⌘K / Ctrl+K command palette
   Fuzzy subsequence match over sections, projects and socials.
   ============================================================ */

import { NAV_ITEMS, PROJECTS, CONFIG } from './config.js';

/* Subsequence match with a light contiguous bonus.
   Returns { score, hits } or null. */
function fuzzy(query, text) {
  if (!query) return { score: 0, hits: [] };

  const q = query.toLowerCase();
  const t = text.toLowerCase();

  // Exact substring is always the best result.
  const direct = t.indexOf(q);
  if (direct !== -1) {
    return {
      score: 1000 - direct * 4 + (direct === 0 ? 60 : 0),
      hits: Array.from({ length: q.length }, (_, i) => direct + i),
    };
  }

  const hits = [];
  let qi = 0;
  let score = 0;
  let streak = 0;

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

function highlight(label, hits) {
  if (!hits || !hits.length) return escapeHtml(label);
  const set = new Set(hits);
  let out = '';
  for (let i = 0; i < label.length; i++) {
    const ch = escapeHtml(label[i]);
    out += set.has(i) ? `<mark>${ch}</mark>` : ch;
  }
  return out;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function buildIndex() {
  const items = [];

  NAV_ITEMS.forEach((n) => {
    items.push({ kind: 'section', icon: n.icon, label: n.label, hint: 'Jump to section', href: n.href });
  });

  PROJECTS.forEach((p) => {
    items.push({
      kind: 'project',
      icon: 'code',
      label: p.name,
      hint: p.desc,
      href: p.href,
      meta: p.repo ? 'source' : 'live',
      extra: p.repo,
    });
  });

  items.push({ kind: 'link', icon: 'github', label: 'GitHub profile', hint: CONFIG.social.github, href: CONFIG.social.github, external: true });
  items.push({ kind: 'link', icon: 'linkedin', label: 'LinkedIn profile', hint: CONFIG.social.linkedin, href: CONFIG.social.linkedin, external: true });
  items.push({ kind: 'link', icon: 'pulse', label: 'All repositories', hint: `${PROJECTS.length} featured of 15 total`, href: CONFIG.social.repos, external: true });
  if (CONFIG.email) {
    items.push({ kind: 'link', icon: 'mail', label: 'Email me', hint: CONFIG.email, href: `mailto:${CONFIG.email}`, external: true });
  }

  return items;
}

export function initPalette() {
  const overlay = document.getElementById('palette');
  if (!overlay) return;

  const input = document.getElementById('paletteInput');
  const list = document.getElementById('paletteList');
  const trigger = document.getElementById('paletteBtn');
  if (!input || !list) return;

  const index = buildIndex();
  let results = index.slice(0, 8);
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
      list.innerHTML = `<li class="palette__empty">No matches for “${escapeHtml(query)}”</li>`;
      return;
    }

    list.innerHTML = results.map((it, i) => `
      <li role="option" aria-selected="${i === 0}">
        <button class="palette__row${i === 0 ? ' is-sel' : ''}" type="button" data-i="${i}">
          <span class="ic"><svg class="i" viewBox="0 0 24 24"><use href="#i-${it.icon}"/></svg></span>
          <span class="lb">${highlight(it.label, query ? fuzzy(query, it.label)?.hits : [])}</span>
          <span class="kind">${it.meta || it.kind}</span>
        </button>
      </li>`).join('');
  }

  function paintSelection() {
    const rows = list.querySelectorAll('.palette__row');
    rows.forEach((r, i) => {
      const on = i === selected;
      r.classList.toggle('is-sel', on);
      r.closest('li')?.setAttribute('aria-selected', String(on));
    });
    rows[selected]?.scrollIntoView({ block: 'nearest' });
  }

  function open() {
    lastFocus = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add('is-locked');
    input.value = '';
    render('');
    input.focus();
  }

  function close() {
    overlay.hidden = true;
    document.body.classList.remove('is-locked');
    lastFocus?.focus?.();
  }

  function run(item) {
    if (!item) return;
    close();
    if (item.href.startsWith('#')) {
      document.querySelector(item.href)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.open(item.href, '_blank', 'noopener');
    }
  }

  input.addEventListener('input', () => render(input.value.trim()));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selected = (selected + 1) % Math.max(results.length, 1);
      paintSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selected = (selected - 1 + results.length) % Math.max(results.length, 1);
      paintSelection();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(results[selected]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.palette__row');
    if (btn) run(results[Number(btn.dataset.i)]);
  });

  list.addEventListener('pointermove', (e) => {
    const btn = e.target.closest('.palette__row');
    if (!btn) return;
    const i = Number(btn.dataset.i);
    if (i !== selected) { selected = i; paintSelection(); }
  });

  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      overlay.hidden ? open() : close();
      return;
    }
    // `/` opens the palette unless you're already typing somewhere.
    if (e.key === '/' && overlay.hidden && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      open();
    }
  });

  trigger?.addEventListener('click', open);
}