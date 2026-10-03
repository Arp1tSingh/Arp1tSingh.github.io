# arp1tsingh.github.io

Personal portfolio and project archive for **Arpit Singh** — Computer Engineering student at
Vidyalankar Institute of Technology, Mumbai.

Live site: **https://arp1tsingh.github.io/**

---

## Stack

No `npm install`, no build step, no framework of our own. Three third-party libraries are
**committed to the repository** rather than loaded from a CDN, because GitHub Pages deploys the
branch root directly and anything not committed would not ship.

| Concern      | Choice                                                                     |
| ------------ | --------------------------------------------------------------------------- |
| Markup       | Semantic HTML5                                                              |
| Styling      | One hand-written stylesheet, CSS custom properties                            |
| Behaviour    | Vanilla ES modules, loaded natively by the browser                            |
| Smooth scroll| [Lenis](https://github.com/darkroomengineering/lenis) 1.3.11 (MIT)            |
| Sequences    | [GSAP](https://gsap.com) 3.13.0 + ScrollTrigger (vendored, see below)         |
| Type         | Instrument Serif · Inter Tight · JetBrains Mono                              |
| Data         | `data/commits.json`, generated from the GitHub API                           |
| Hosting      | GitHub Pages, deployed straight from the branch root                         |

```
index.html          markup + content + inline SVG icon sprite
404.html            styled not-found page
styles.css          the whole design system
data/commits.json   generated — per-day commit histogram
js/
  main.js           orchestration: boot, nav, drawer, typewriter, anchors, calendar, copy
  scroll.js         Lenis + ScrollTrigger, and the pinned sequences
  reveal.js         entry reveals and hero counters
  cursor.js         flat corner reticle
  palette.js        ⌘K / Ctrl+K command palette with fuzzy search
  config.js         editable content — name, roles, email, socials, projects
  vendor/           pinned GSAP, ScrollTrigger and Lenis builds — see js/vendor/README.md
assets/             portrait variants, favicon, Open Graph card
tools/
  fetch-commits.mjs  regenerates data/commits.json
```

---

## The ten-second rule

Contact is the one thing a visitor must not have to hunt for. Three redundant affordances, so
none of them depends on the others working:

1. **A solid accent `Hire me` button in the fixed header**, on every breakpoint, visible from the
   first paint. It is a `mailto:` — no form, no page load, nothing to fail.
2. **Email leads the hero action row**, ahead of GitHub and "View work".
3. **A floating dock** (email + copy-to-clipboard) that fades in once the hero is behind you and
   hides again over the contact outro, so it is always a shortcut and never an obstruction.

Plus a one-sentence **availability band** immediately under the hero, inside the first scroll.

The verification harness asserts all of this: the header and hero CTAs must both be inside the
first viewport, and both must be `mailto:`, at every width from 360 to 1920.

---

## Motion

Five pinned scroll sequences, all driven by GSAP ScrollTrigger with `scrub: 1` so a fast flick
settles rather than snapping:

| Sequence      | Scroll distance | What scrubs                                                              |
| ------------- | --------------- | ------------------------------------------------------------------------- |
| Hero out      | `200svh`        | Portrait scales and drifts right, scrim lifts, name retreats, stats exit  |
| About         | `200svh`        | Three-step statement sequence; each step lights as it takes the stage     |
| Work          | `340svh`        | The rail translates by exactly its overflow width; panel counter ticks     |
| Toolkit       | `220svh`        | Six skill bars `scaleX` against scroll progress, percentages counting up   |
| Journey       | `320svh`        | Spine fill tied to progress, timeline dots igniting as the spine passes them |

`scrub: 1` rather than `scrub: true` is the reason the motion reads like the references instead of
like a progress bar: the timeline lags the scroll slightly and then catches up.

### The arming contract

`js/scroll.js` adds the class `js-scroll` to `<html>` **only after GSAP, ScrollTrigger and Lenis
have all resolved and the visitor has not asked for reduced motion.** Every pinned rule, every
scrubbed transform and the dock rule in `styles.css` is scoped under `.js-scroll`.

So there are four states, and three of them are the plain document:

| State                                    | Result                                                    |
| ---------------------------------------- | --------------------------------------------------------- |
| Motion allowed, vendor files present      | Sequences armed and scrubbed                               |
| JavaScript disabled                       | Plain stacked document, fully readable                     |
| `js/vendor/` blocked or missing           | Plain stacked document, fully readable                     |
| `prefers-reduced-motion: reduce`          | Plain stacked document, boot screen removed from the DOM   |

There is no state in which a visitor sees a pinned section whose scrub never runs, or an element
stranded at `opacity: 0`.

### Why the fallback needs no JavaScript

The un-armed state is the **finished** state by construction, not something JS has to repaint:

- Skill bar widths are inline on each `.bar__fill`, and the transform that GSAP scrubs is reset to
  `scaleX(0)` only under `.js-scroll`.
- The timeline spine defaults to `height: 100%` and the dots to lit; `.js-scroll` resets them.

That is why there is no `initStaticEndState`-style compensation function: the fallback is CSS, so
it cannot drift out of sync with the armed state.

### Pin or stand still

A pinned sequence needs a viewport exactly one screen tall **and** a scroll range to scrub across.
Below these widths the sections stack and the second condition fails — and a pin with `start === end`
silently freezes its timeline at progress `1`, which looks like a broken scrub rather than a layout
decision. So `js/scroll.js` makes the call and marks the section `is-static`; the stylesheet keys the
finished look off that class instead of re-deriving the same breakpoints in two places.

| Breakpoint | Sections that stop pinning                         |
| ---------- | -------------------------------------------------- |
| ≤ 1080px   | About, Toolkit, Journey (they stack)               |
| ≤ 860px    | Work — the rail becomes a natively swipeable row   |

The hero pins at every width; it is one screen of content even at 360px. Crossing either
breakpoint rebuilds the triggers, since `is-static` is otherwise a one-way decision made at load.

### Lenis wiring

Lenis owns the scroll position, ScrollTrigger must read it every frame, or pinned sections drift by
a frame during a fast flick:

```js
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
```

Every in-page link, the ⌘K palette and the footer route through one `scrollTo()` in `js/scroll.js`,
which applies the fixed-header offset and eases through Lenis when it exists and falls back to a
native jump when it does not. `scroll-behavior: smooth` is disabled under `.js-scroll` so the
browser's own smoothing does not fight Lenis.

---

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

### Copy is deliberately thin

`<main>` carries **~484 words**, down from ~1,216. Each project is a number, a title and one line.
The Journey timeline is five dated lines, and the honest five-month gap with no public commits is
still there — as is the real calendar, generated from the API, sitting beside it.

The detail was not deleted so much as relocated: `PROJECTS` in `js/config.js` still carries the
full one-line description of all nine projects, and ⌘K is where it now lives.

---

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

## Verifying

The behaviour that matters here — the ten-second rule, the arming contract, the pin ranges, the
absence of clipped layout — is all asserted by a Playwright harness rather than eyeballed:

```bash
npm i playwright        # browsers are already cached
python3 -m http.server 8000 &
node tools/verify.cjs http://127.0.0.1:8000
```

It sweeps 360 / 390 / 768 / 1024 / 1280 / 1440 / 1920 and asserts, at each one:

- no horizontal document overflow **and** nothing clipped past the viewport edge
  (`html { overflow-x: clip }` hides the second kind from the first check)
- no unpinned section reserving scroll distance it will never spend
- the header and hero CTAs are in the first viewport and are both `mailto:`
- each pinned sequence has a non-zero scrub range and its transform actually changes at the
  midpoint; each unpinned one has **no** trigger and already shows its finished values
- the calendar renders 362 cells with 59 lit, labelled Oct 2025 onward
- zero console errors and zero failed requests

Then, as separate contexts: **no JavaScript**, **`js/vendor/` blocked**, and
**`prefers-reduced-motion: reduce`** — each asserting the page is complete and readable, plus the
⌘K palette, anchor navigation, clipboard copy and every external link.

Note: LinkedIn hard-blocks non-browser clients (HTTP 999), so the link check asserts its URL and
reports it as unverifiable rather than pretending to have checked it.

## Editing content

Everything you'll want to change lives in `js/config.js`:

- `email` — shown in the header CTA, hero, availability band, dock, contact grid and footer.
- `roles` — the phrases the hero typewriter cycles through.
- `PROJECTS` — the full project descriptions, powering the ⌘K palette. The visible rail in
  `index.html` is the deliberately cut version.
- `GITHUB_STATS` — repo count and other headline figures.

Skill percentages in the Toolkit section are computed from bytes of code across all public
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

- Entry reveals use a **sweep on scroll, deliberately not IntersectionObserver**. An IO only
  fires on threshold crossings: a fast scroll (deep link, restored scroll position, Find-in-page)
  can move an element from below the viewport to above it between two checks, so it never
  intersects, never fires, and stays invisible for good. A sweep cannot miss.
- The skill bars and timeline spine are **not** in `reveal.js`. They need no entry animation, and
  keeping them in CSS means the no-JS and reduced-motion pages are correct without running a
  single line of script.
- Every animation is disabled under `prefers-reduced-motion: reduce`; the boot screen is removed
  from the DOM entirely and the hero name renders statically.
- The custom cursor and its native-pointer suppression only initialise for `(pointer: fine)`,
  and the suppression is applied by a class added *after* the cursor is confirmed running, so a
  JS failure can never leave you with no pointer.
- `:focus-visible` carries a 2px accent ring, which is the only keyboard focus cue once the
  native pointer is hidden.
- Keyboard: `⌘K` / `Ctrl+K` or `/` opens the palette, `Esc` closes, arrows navigate, focus returns
  to the trigger on close. Opening the palette freezes Lenis rather than setting
  `body { overflow: hidden }`, which would fight it.
- The hero image is preloaded with `fetchpriority="high"` and served at two widths.
- External links carry `rel="noopener noreferrer"`.
- `min-width: 0` on the sequence grid items is load-bearing. A grid item's automatic minimum size
  is min-content, so without it the 53-column calendar refuses to shrink and pushes its card past
  the right edge — and `overflow-x: clip` on the root hides that from a document-width check.

## Licence

Hand-written apart from `js/vendor/`. The project screenshots in `assets/` belong to the projects
they depict.