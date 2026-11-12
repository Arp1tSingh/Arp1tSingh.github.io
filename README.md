# The Local 3D

Personal portfolio and project archive for **Arpit Singh** — computer engineering student at Vidyalankar Institute of Technology, Mumbai.

Live: **[https://arp1tsingh.github.io/](https://arp1tsingh.github.io/)**

---

## The idea

The portfolio answers one question: for this visitor's intent and time budget, which evidence should they see, and in what order? The train is one way to show that answer, not the product.

```
Route(i, b) = order({ e ∈ E : relevance(e, i) ≥ τ(b) })
```

`E` is all the evidence, `i` is the visitor's intent (skim, verify, explore) and `b` is their time budget. The threshold τ falls as the budget grows: a short budget keeps only the flagship stops (Express), a long one keeps all of them (All stations).

This buys three things. The 3D line, a flat Text view and a network map become interchangeable renderers of one route. The metaphor can change later without touching content. And every design choice gets a test: does it help a visitor reach evidence faster, or judge it better?

The full brief is in [`docs/blueprint.md`](docs/blueprint.md). What is still open - the résumé, the Kalyan Junction card, the two clips that only Arpit can record - is in [`docs/placeholders.md`](docs/placeholders.md). The five-phase gate, ride, map and ticket pass is recorded in [`docs/ux-plan.md`](docs/ux-plan.md).

## One dataset, many renderers

`content/` is the source of truth. It is validated at build time, read once, and handed to every renderer as the same immutable object. No renderer ever copies a value out of it, so a fix in the data updates the scene, the map and the Text view together.

```
content/
  profile.json          name, role, links, contact
  route.json            stop order, the three lines, pacing weights
  stops/                one file per stop
```

Every stop is one record:

```json
{
  "id": "slot-03",
  "kind": "project",
  "title": "RegimeTrader",
  "oneLiner": "A regime-aware Nifty 50 predictor on a SQLite star schema.",
  "tier": "express",
  "domain": "ai",
  "role": "solo",
  "stack": ["Python", "SQLite", "scikit-learn"],
  "claim": "Locks the test period before running it, then reports that the strategy has no reliable edge.",
  "proof": { "metrics": [], "media": [], "architecture": "" },
  "links": { "repo": "", "demo": "", "caseStudy": "" },
  "period": { "start": "2026-10", "end": "present" },
  "station": "Mulund",
  "prop": "ticker tape"
}
```

`npm run validate` fails the build on a missing required field, a bad enum, an orphaned stop or a broken link in `route.order`. `npm run validate:strict` additionally refuses any `TBD` left in the content — that is the launch gate.

## The three renderers

```
content/  ──validated at build──▶  src/core/  ──pure──▶  src/renderers/
```

| Layer | What it owns |
| --- | --- |
| `src/core/` | `route()`, `pacing()`, the journey state machine. No DOM, no React, no three.js. |
| `src/renderers/classic/` | The flat, static, SEO-friendly view. Also tier 3 and tier 4. |
| `src/renderers/map2d/` | The network map, with skills as transfer lines. |
| `src/renderers/scene3d/` | The 3D line: the train, the track, the stations, the sky. |
| `src/ui/` | The gate, the ticket, the indicator and the wallet. |

Any of the three can be opened on its own: `T` (or `C`) for the Text view, `M` for the map, and `?view=classic` or `?view=map` opens one straight away, which is a link anyone can share.

Because the core is pure, it gets unit tests instead of screenshots: `npm test` covers the route function, the pacing function, every journey transition **and the 3D triangle budgets** without opening a browser.

## The journey

```
Gate ──▶ Boarding ──▶ Traveling ◀──▶ Dwelling ──▶ Terminus
```

Scroll is the only clock. Nothing auto-plays past a stop, and the visitor sets the pace. The pacing function maps a scroll distance in viewport heights to a route position: the train holds at a stop for that stop's dwell weight, then travels to the next one over a fixed weight.

The weights are tuned for the way people actually scroll. Express takes **7.4 viewport heights** and All stations **10.6**, down from 11.8 and 17.0: about 60% more of the line per turn of the wheel, with every stop still held long enough to read.

A map click, a progress dot or a deep link jumps straight to `Dwelling` at any stop. **Every stop is reachable in one interaction from anywhere**, and that is asserted in the test suite rather than assumed.

### The three lines

| Line | Intent | Budget | What it keeps |
| --- | --- | --- | --- |
| **Express** | skim | short | The flagship stops and the terminus, in 7.4 viewport heights. |
| **All stations** | explore | long | Every stop, local stops included. |
| **Network map** | verify | long | The whole network, filterable by skill. |

In Express mode a local stop's dwell collapses to zero: the train passes through it without opening its doors.

## Degrade by layers

| Tier | Condition | What changes |
| --- | --- | --- |
| 0 Full | WebGL works, motion allowed | The journey, the gate, the map and the 3D line. |
| 1 Calm | `prefers-reduced-motion` | The camera cuts between stops instead of sweeping. |
| 2 Light | A low-end device | Fewer instances and a lower pixel ratio; antialiasing stays on. |
| 3 Text view | No WebGL, or the context was lost | The poster scene, then the Text view. |
| 4 Plain | No JavaScript | The Text view, prerendered to static HTML at build time. |

The Text view (the Classic renderer in the source tree) is prerendered into a `<noscript>` block at build time, so the page is complete and readable with zero scripting — and because `<noscript>` content is inert while scripting is on, the document never carries the content twice.

If the app fails to boot, an inline timer puts the static page back. There is no state in which a visitor gets a blank page.

## The 3D line

The scene is built entirely from primitives. There is no glTF, no texture map and no model file, so **the whole 3D payload is 0 bytes** and the geometry budget is the only budget that matters.

- **The train** is three articulated cars in the metro livery: a silver shell, a blue band, a red line under the windows, a lit window band, tapered cab ends and four wheels per car. The roof pod, vents, underframe and bogie boxes are gone; parts that share a material are merged, so the set is 6,804 triangles in eight draw calls.
- **The track** weaves between two lanes. It holds the line through each platform, then changes lane on a four-round Chaikin wave; the tangent is blended between samples, so the heading never steps at a vertex. The ballast bed, both running rails, the third rail and its cover are profiled ribbons extruded along that path; the sleepers lie across the rails and, with the city, are `InstancedMesh`. 37,512 triangles and seven draw calls for the whole line, with no catenary and no pantograph.
- **The stations** are a modular kit: a platform, a canopy, a board, a bench and a lamp.
- **The dioramas** are one prop per stop, chosen from the project's domain, so a station is recognisable before its name is read.
- **The sky** is one inverted sphere and one shader with no texture. Six keys take it from dawn through day, golden hour and dusk to night, and the fog is the horizon colour so the city dissolves into it. The sun sets below the line, the moon rises on its own arc and the stars fade in behind them; all three are placed from world directions, so they stay put while the train moves.
- **The bloom** is on at night and on the high tier only: the train's window band, the station lamps and the platform edges glow, and nothing else does.

The camera obeys three rules: it eases behind the train rather than being rigidly attached to it, its **angular velocity is capped** so a sweep never exceeds a gentle turn rate, and the horizon stays level - there is no roll, ever.

The budgets are asserted by the unit tests, not by convention. These are the numbers the tests check against:

| Element | Budget | Built | Draw calls |
| --- | --- | --- | --- |
| The train | under 10,000 triangles | 6,804 | 8 |
| The track and the city | under 60 draw calls | 7 | 7 |
| A station | under 8,000 triangles | 212 (worst) | 6 |
| A diorama prop | under 3,000 triangles | 748 (worst) | 1 |
| The whole scene | under 60 draw calls | about 51 | |
| 3D assets on the wire | under 3.5 MB | **0 bytes** | |

The last row is the interesting one: there is no glTF, no texture atlas and no model file. The geometry is built in the browser from primitives, so the 3D payload costs nothing to download.

### Loading the scene

Nothing is loaded that the visitor has not asked for. The chunks are:

| Chunk | Raw | Gzipped | When |
| --- | --- | --- | --- |
| The app | 277 KB | **87.4 KB** | With the page |
| The 3D scene | 968 KB | 259 KB | With the line, on a wide screen |
| The Text view | 7 KB | 2 KB | When `T` (or `C`) is pressed |
| The network map | 11 KB | 3 KB | When `M` is pressed |

The blueprint's budget is 350 KB of initial JavaScript gzipped. The app is 88 KB of it.

Two things were worth the trouble of finding. The classic view's build-time renderer imports `react-dom/server`, which is a hundred and eighty kilobytes of machinery for rendering on a server - it now lives in its own module, and the browser chunk is 7 KB instead of 209 KB. And the train and the dioramas use Lambert rather than Standard shading: the art direction is flat colour and flat shading, and Standard's physical shading is a lot of shader to compile for an effect nobody can see in a faceted scene.

A visitor whose browser cannot run WebGL never downloads the scene chunk at all: the check happens before the import, and the poster scene stands in. On a narrow screen the gate covers the whole viewport, so there is nothing to see behind it and the scene is not loaded until the ride starts. And at the gate the scene draws one frame and waits, because the train is standing still and sixty frames a second of it costs the main thread for nothing.

### Performance

The blueprint's targets are a largest contentful paint of 2.5 s or less, accessibility of 95 or more, and performance of 85 or more on mobile. Lighthouse runs in CI against the mobile preset and fails the build if any of them slips. The report is kept as a run artifact, because a layout shift that only appears on a throttled connection is otherwise invisible.

Measured in CI, on the mobile preset:

| | |
| --- | --- |
| Performance | 0.80 to 0.96, median above the 0.85 target |
| Accessibility | 0.95 |
| Best practices | 1.00 |
| SEO | 1.00 |
| Largest contentful paint | 2.3 s |
| Cumulative layout shift | 0.018 |
| Transferred | 219 KB |

The 3D line is the expensive part of this site: evaluating three.js is about half a second of main-thread time on a throttled phone, which is most of the difference between the two performance scores above. That is why the scene is a separate chunk, why the gate does not load it on a phone, and why the Classic view exists.

The layout shift was the web fonts arriving after the first paint and reflowing the gate panel. Each font stack now names a metric-matched fallback, so the swap changes the letter shapes and nothing else: the shift fell from 0.113 to 0.018.

## The ten-second contract

Within ten seconds a visitor knows who you are, what you do and how to reach you. Contact is the one thing nobody should have to hunt for, so there are three redundant affordances and none of them depends on the others working:

1. A solid board-yellow **Hire me** button in the fixed header — painted on frame one, at every width, never scrolls away. It is a `mailto:`, so there is no form and nothing to fail.
2. The email address itself, in the gate, as a real `mailto:` link.
3. The footer, on every page.

## Design system

- **Palette** is the concept's own: `#101216` ink, `#fdf3d0` paper, `#ffc52e` board yellow and `#d92d3a` signal red. `--accent-text` is the readable tint of the red on ink.
- Board yellow means *act*, or *you are here*: the contact button, the ticket board, the current stop and the progress fill. Red is the signal: focus rings, map lines and the live marker. There is no decorative colour in either.
- **Fraunces** for everything that matters. **Inter Tight** for text. **JetBrains Mono** only where it is genuinely a machine readout — the dot-matrix indicator, a station board, a stack.
- `border-radius: 0` throughout. Flat colour: no shadows, no blur, no glass.
- Hairlines at 14% cream are the only structural device.

## Stack

| Concern | Choice |
| --- | --- |
| Build | Vite 8 |
| Framework | React 19 + TypeScript 5.9 |
| 3D | React Three Fiber + three.js |
| Tests | Vitest for the core and the budgets, Playwright for the browser |
| Hosting | GitHub Pages, deployed by GitHub Actions |

The only runtime dependencies are React, React DOM, three.js and React Three Fiber. The three fonts are self-hosted from `src/assets/fonts`, so there is no request to `fonts.googleapis.com` anywhere in the project.

## Running it

```
npm install
npm run dev
```

ES modules need HTTP — opening `index.html` from the filesystem will not work.

## Verifying

```
npm run validate        # the content, before anything else
npm test                # the core and the 3D budgets
npm run typecheck
npm run test:e2e        # the browser, in Chromium, Firefox and WebKit
```

The end-to-end suite covers the ten-second contract at three widths, the Text view with JavaScript disabled, the gate, the ticket lifecycle, the map's selection model, the mobile view menu and station sheet, the terminus wallet, the deep links, the content parity between the renderers, and the 3D scene with its degradation to the poster.

## Licence

Hand-written apart from the three OFL fonts in `src/assets/fonts`. The project screenshots belong to the projects they depict.
