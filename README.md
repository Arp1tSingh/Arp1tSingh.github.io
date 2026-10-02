# arp1tsingh.github.io

Personal portfolio and project archive for **Arpit Singh** — Computer Engineering student at
Vidyalankar Institute of Technology, Mumbai.

Live site: **https://arp1tsingh.github.io/**

---

## Stack

Zero dependencies. No `npm install`, no build step, no framework.

| Concern      | Choice                                                     |
| ------------ | ---------------------------------------------------------- |
| Markup       | Semantic HTML5                                              |
| Styling      | One hand-written stylesheet, CSS custom properties          |
| Behaviour    | Vanilla ES modules, loaded natively by the browser          |
| Type         | Instrument Serif · Inter Tight · JetBrains Mono             |
| Data         | `data/commits.json`, generated from the GitHub API          |
| Hosting      | GitHub Pages, deployed straight from the branch root        |

```
index.html         markup + content + inline SVG icon sprite
404.html           styled not-found page
styles.css         the whole design system
data/commits.json   generated — per-day commit histogram
js/
  main.js          orchestration: boot, nav, drawer, typewriter, calendar, copy
  config.js        editable content — name, roles, email, socials, projects
  reveal.js        sweep-based scroll reveals, counters, skill bars, timeline
  cursor.js        corner reticle
  palette.js       ⌘K / Ctrl+K command palette with fuzzy search
assets/            portrait variants, favicon, Open Graph card
tools/
  fetch-commits.mjs  regenerates data/commits.json
```

The page works without JavaScript: every project, skill and bio is in the HTML. JS only adds
motion, filtering, the calendar and the command palette.

## Design system

Derived from three references — `landonorris.com`, `charlesleclerc.com`,
`aahana-surya.github.io` — which share a recognisable set of rules:

- **One characterful serif for display.** Instrument Serif, with its italic cut for emphasis.
- **Mono for every small technical label**, tracked out uppercase.
- **`border-radius: 0`.** Shape comes from hairline rules and clip paths, never curvature.
- **Flat colour.** Zero `box-shadow`, zero `filter: blur()`, zero glassmorphism as a system.
- **One accent hue** (`--accent: #ff5a1f`) on a tinted warm dark. Neutrals carry a hue, like
  all three references do.
- **1px hairlines** at ~11% alpha as the primary structural device.
- Sub-0.95 line-heights on display type, `0.26em` tracking on mono labels, `0.9` body leading.
- Fluid modular scale via `clamp()` — no breakpoint jumps in type size.

## Running it locally

ES modules need to be served over HTTP — opening `index.html` from the filesystem will not work.

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploying

Pushes to `main` deploy automatically via GitHub Pages (source: branch / root).

```bash
git add -A
git commit -m "update"
git push
```

The site lands at `https://arp1tsingh.github.io/` in about a minute.

All asset paths are **relative** (`./styles.css`, not `/styles.css`), so the site works unchanged
at a root domain, a subpath, or a local file server. To use a custom domain, add a `CNAME` file
and point a CNAME record at `arp1tsingh.github.io`.

## Editing content

Everything you'll want to change lives in `js/config.js`:

- `email` — shown in the contact section and About.
- `roles` — the phrases the hero typewriter cycles through.
- `PROJECTS` — powers the ⌘K palette. The visible cards live in `index.html`.
- `GITHUB_STATS` — repo count and other headline figures.

Skill percentages in the Skills section are computed from bytes of code across all public
repositories, not hand-written. To refresh them:

```bash
for r in $(gh repo list Arp1tSingh --limit 100 --json name --jq '.[].name'); do
  gh api "repos/Arp1tSingh/$r/languages"
done
```

## The commit calendar

`data/commits.json` is **generated, not hand-written.** `tools/fetch-commits.mjs` walks every
public repository with the GitHub REST API, collects each commit's author date, and writes a
per-day histogram.

```bash
gh auth login          # once
node tools/fetch-commits.mjs
```

Current contents: **248 commits across 59 active days**, 2025-10-06 → present. The stretch from
November 2025 to March 2026 has no commits. That gap is real and is deliberately left in both
the calendar and the timeline — see "A quiet stretch" in the Journey section.

Because the chart is anchored to the most recent commit rather than to today, it stays populated
however long the site sits untouched.

## The portrait

`assets/portrait.jpg` is the untouched original (720×1280). Two derived variants are committed:

| File               | Use                                             |
| ------------------ | ----------------------------------------------- |
| `portrait-720.jpg` | mobile `srcset` — native resolution, desaturated |
| `portrait-1440.jpg` | desktop `srcset` — Lanczos-upscaled, sharpened   |

Saturation is baked to 0.62 in the derivatives, which both ties the photo to the palette and
hides JPEG chroma-subsampling artefacts that would otherwise show at the 2.67× upscale a 1920px
hero requires. Regenerate with `sharp` if you swap the source photo.

The hero is a full-bleed cover with two stacked warm-black scrims. `object-position` is biased
upward (`50% 15.4%`, `0` on mobile) so the top of the head is never clipped — at a 1.6:1 desktop
viewport only 450 of 1280 rows survive, and a centred crop would cut 52px off your hair.

## Accessibility & performance notes

- Scroll reveals use a **sweep on scroll, deliberately not IntersectionObserver**. An IO only
  fires on threshold crossings: a fast scroll (deep link, restored scroll position, Find-in-page)
  can move an element from below the viewport to above it between two checks, so it never
  intersects, never fires, and stays invisible for good. A sweep cannot miss.
- Every animation is disabled under `prefers-reduced-motion: reduce`; the boot screen is removed
  from the DOM entirely and the hero name renders statically.
- The custom cursor and its native-pointer suppression only initialise for `(pointer: fine)`,
  and the suppression is applied by a class added *after* the cursor is confirmed running, so a
  JS failure can never leave you with no pointer.
- `:focus-visible` carries a 2px accent ring, which is the only keyboard focus cue once the
  native pointer is hidden.
- Keyboard: `⌘K` / `Ctrl+K` or `/` opens the palette, `Esc` closes, arrows navigate, focus returns
  to the trigger on close.
- The hero image is preloaded with `fetchpriority="high"` and served at two widths.
- External links carry `rel="noopener noreferrer"`.

## Licence

Hand-written, no frameworks. The project screenshots in `assets/` belong to the projects they
depict.