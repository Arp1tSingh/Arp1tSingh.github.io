# arp1tsingh.github.io

Personal portfolio for **Arpit Singh** — Computer Engineering student at Vidyalankar
Institute of Technology, Mumbai.

Live: **https://arp1tsingh.github.io/**

---

## The idea

**Evidence, not narration.**

One accent colour means one thing: red is *actionable*, or you are *here*. No decorative red
anywhere else on the page. When the email address is red, red means something.

`<main>` carries **~317 words**. Eight of the nine screens hold under twenty of them. Most screens
are a picture, a number, or eight words. Where a project deserves more than one line, the detail
lives in the ⌘K palette rather than on the page.

## The ten-second rule

Contact is the one thing a visitor must never have to hunt for, so three redundant affordances exist
and none depends on the others working:

1. **A solid accent `Hire me` button in the fixed header** — painted on frame one, every width, never
   scrolls away. It is a `mailto:`, so there is no form and nothing to fail.
2. **The email address itself, set at 4.2vw in red, in the hero.** The most important thing on the
   page is the second biggest thing on the page.
3. **A floating dock** (email + copy-to-clipboard) that fades in once the hero is behind you and hides
   again over the contact block, so it is always a shortcut and never an obstruction.

Plus the close: the same address at 7.4vw, filling with red from the left on hover.

`tools/verify.cjs` asserts all of it — the header and hero CTAs must be inside the first viewport at
every width, and both must be `mailto:`.

---

## Stack

No `npm install`, no build step, no framework. Third-party code is **committed**, not fetched, because
GitHub Pages deploys the branch root and anything uncommitted would not ship.

| Concern       | Choice                                                                |
| ------------- | ---------------------------------------------------------------------- |
| Markup        | Semantic HTML5                                                         |
| Styling       | One hand-written stylesheet                                             |
| Display face  | **Fraunces** (variable, `opsz`/`wght`/`SOFT`/`WONK`), self-hosted      |
| Text face     | Inter Tight 300–500, self-hosted                                        |
| Mono          | JetBrains Mono 400, self-hosted                                         |
| Smooth scroll | [Lenis](https://github.com/darkroomengineering/lenis) 1.3.11 (MIT)        |
| Sequences     | [GSAP](https://gsap.com) 3.13.0 + ScrollTrigger                          |
| Data          | `data/commits.json`, generated from the GitHub API                      |
| Hosting       | GitHub Pages, branch root                                               |

Fonts total **192 KB** and there is **no request to `fonts.googleapis.com` or `fonts.gstatic.com`**
anywhere in the project. The harness asserts it.

```
index.html          markup + content + inline SVG sprite + the duotone filter
404.html            styled not-found page
styles.css          the whole design system
assets/
  fonts/            three self-hosted woff2, latin subset
  arpit-landscape.jpg   the photo band
  path-tracer.png       CPU path tracer output — duotoned in CSS
  fsrs-dashboard.png    FSRS-6 review queue — duotoned in CSS
  og.png                social card, rendered from the live design
js/
  main.js           orchestration: boot, nav, drawer, anchors, calendar, copy
  scroll.js         Lenis + ScrollTrigger, the pinned sequences, the hero wipe
  cursor.js         flat corner reticle
  palette.js        ⌘K command palette with fuzzy search
  config.js         editable content — email, socials, the ten projects
  vendor/           pinned GSAP, ScrollTrigger, Lenis builds
tools/
  fetch-commits.mjs  regenerates data/commits.json
  verify.cjs         the behaviour harness — 145 assertions
```

---

## Motion

Six pinned sequences at `scrub: 1`, so a fast flick settles rather than snapping.

| Sequence | Distance | What scrubs                                                        |
| -------- | -------- | ------------------------------------------------------------------- |
| Hero out | `200svh` | The name retreats and tightens; email and meta lift away             |
| Impact 1 | `200svh` | *I write renderers that run on a CPU.* — cream to red                |
| Toolkit  | `220svh` | The share bar wipes across; `58.8` counts up with it                |
| Photo    | `180svh` | A short parallax on the photograph                                   |
| Impact 2 | `200svh` | *248 commits. 59 days. The gaps stay.* — cream to red                |
| Journey  | `260svh` | The date rail translates by exactly its overflow width               |

The impact statements are the site's one unforgettable move: scrolling literally tightens the
sentence and turns it red. It is the `landonorris.com` mechanic and it costs nothing.

The hero entrance is a per-line clip wipe — each line is its own `overflow:hidden` box with the inner
span translated out, so CSS does the whole animation and there is no per-character DOM cost.

### The arming contract

`js-scroll` is added to `<html>` **only once GSAP, ScrollTrigger and Lenis have all resolved and the
visitor has not asked for reduced motion.** Every pinned rule and every scrubbed transform in
`styles.css` is scoped under it, so four states resolve and three of them are the plain document:

| State                             | Result                                       |
| --------------------------------- | -------------------------------------------- |
| Motion allowed, vendor files present | Sequences armed and scrubbed              |
| JavaScript disabled               | Plain stacked document, fully readable        |
| `js/vendor/` blocked or missing   | Plain stacked document, fully readable        |
| `prefers-reduced-motion: reduce`  | Plain stacked document, boot removed          |

There is no state in which a visitor sees a pinned section whose scrub never runs.

### The fallback needs no JavaScript

The un-armed state is the **finished** state by construction, not something JS repaints:

- Share segments carry their width inline and default to `scaleX(1)`; only `.js-scroll` resets them
  to zero, and only for sections that actually have a scrub.
- The journey rail is a complete flex row with no transform at rest.

That is why there is no compensating function: a fallback that is CSS cannot drift out of sync with
the armed state.

### Pin or stand still

A pin needs a one-screen viewport **and** a scroll range. Below `1080px` the sections stack, the
second condition fails, and a pin with `start === end` freezes its timeline at progress `1` — which
reads as a broken scrub rather than a layout decision. `js/scroll.js` makes the call and marks the
section `is-static`; the stylesheet keys off that class rather than re-deriving the breakpoints.
The journey rail stops pinning at `860px`. Crossing either breakpoint rebuilds the triggers.

### Lenis wiring

Lenis owns the scroll position, ScrollTrigger must read it every frame, or pinned sections drift by a
frame during a fast flick:

```js
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
```

Nav links, the ⌘K palette and the footer all route through one `scrollTo()`.

---

## Images

Three, and each earns its place.

**The photo band.** `arpit-landscape.jpg` is 1280×960, shown cropped to the top 735 rows — roughly
16:9, which excludes the shirt logo while keeping the whole head. It is **full colour on purpose**: the
sky already runs blue → pink → red, which is navy → red, so the photograph is already inside the
palette and duotoning it would subtract for nothing. Type sits in the left 45%, which is empty sky and
sea. At 1280px wide it renders 1:1; at 1920 it upscales 1.5×, acceptable here because the sky is a
smooth gradient and the jawline is the only detailed edge in frame.

**The two screenshots** are duotoned by an inline SVG `feColorMatrix` + `feComponentTransfer` filter
applied from CSS with `filter:url(#duo)`. No image tooling is committed and the originals are
untouched. On hover the image mask closes in from `ellipse(100% 52%)` to `ellipse(76% 44%)` and the
render pushes to `scale(1.1)` underneath — a spotlight tightening rather than a fade.

---

## Design system

- **Palette** is `charlesleclerc.com`'s: `#000016` navy, `#f1f1f1` off-white, `#9797a5` grey, `#e4032e`
  signal red.
- **Fraunces at `opsz 144`** for everything that matters. `WONK 1` tips the letterforms off true, which
  is what stops it reading as a default editorial serif.
- Hero `clamp(4rem, 24vw, 24rem)` at `.8` leading and `-.045em`. Impact `clamp(2.1rem, 6.4vw, 6.6rem)`.
  Email `4.2vw` in the hero, `7.4vw` at the close.
- `border-radius: 0` throughout. Flat colour: no shadows, no blur, no glass.
- Hairlines at 13% white as the only structural device.
- JetBrains Mono only where it is genuinely a machine readout — a percentage, a date, a stack.

### Patterns deliberately removed

`01 / ABOUT` section indices · the `sec-head` block repeated six times · six 1px skill bars that looked
like a loading skeleton · the typewriter · hairlines-as-texture · the portrait as a faded background
behind the hero copy.

---

## Running and deploying

ES modules need HTTP — opening `index.html` from the filesystem will not work.

```bash
python3 -m http.server 8000
```

Pushes to `main` deploy automatically via GitHub Pages. All asset paths are relative, so the site works
at a root domain, a subpath, or a local file server.

## Verifying

```bash
npm i playwright
python3 -m http.server 8000 &
node tools/verify.cjs http://127.0.0.1:8000
```

145 assertions across 1280 / 1440 / 1920, then three separate fallback contexts:

- the ten-second rule at every width, both CTAs verified as `mailto:`
- Fraunces applied at `opsz 144`, all self-hosted faces loaded, **no Google Fonts host contacted**
- copy budget, nothing clipped past the viewport edge
- both screenshots present, duotoned, and not upscaled more than 1.35×; the photo band not duotoned and
  upscaled no more than 1.6×
- six pinned sequences, each with a **non-zero scrub range** and each transform genuinely changing at
  the midpoint; the impact statement landing exactly on `#e4032e`
- calendar figures: 248 commits, 59 active days, first commit Oct 2025, 16 repositories
- ⌘K palette, anchor navigation, clipboard copy, dock lifecycle, every external link

Then **no JavaScript**, **`js/vendor/` blocked**, and **`prefers-reduced-motion`** — each asserting the
page is complete and readable with zero scripting. Two bugs in this codebase were invisible to a
document-width check and to a screenshot, and were only caught by asserting element boxes and
computed styles directly.

## Accessibility notes

- Keyboard: `⌘K` / `Ctrl+K` or `/` opens the palette, `Esc` closes, arrows navigate, focus returns to
  the trigger. Opening it freezes Lenis rather than setting `body { overflow: hidden }`, which would
  fight it.
- `:focus-visible` carries a 2px accent ring — the only keyboard focus cue once the native pointer is
  hidden. The custom cursor only initialises for `(pointer: fine)`, and its pointer suppression is
  applied only after the cursor is confirmed running, so a JS failure cannot leave you without a
  pointer.
- Every image has descriptive `alt` text; the two screenshots describe what they show, not that they
  are screenshots.
- External links carry `rel="noopener noreferrer"`.
- Both image sets are `loading="lazy"`, `decoding="async"`, and carry explicit `width`/`height` so
  layout does not shift.

## Licence

Hand-written apart from `js/vendor/` and the three OFL fonts in `assets/fonts/`. The project
screenshots belong to the projects they depict.