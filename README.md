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

This buys three things. The 3D line, a flat Classic view and a network map become interchangeable renderers of one route. The metaphor can change later without touching content. And every design choice gets a test: does it help a visitor reach evidence faster, or judge it better?

The full brief is in [`docs/blueprint.md`](docs/blueprint.md).

## One dataset, many renderers

`content/` is the source of truth. It is validated at build time, read once, and handed to every renderer as the same immutable object. No renderer ever copies a value out of it, so a fix in the data updates the scene, the map and the Classic view together.

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

## Three layers, three renderers

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

Because the core is pure, it gets unit tests instead of screenshots: `npm test` covers the route function, the pacing function, every journey transition **and the 3D triangle budgets** without opening a browser.

## The journey

```
Gate ──▶ Boarding ──▶ Traveling ◀──▶ Dwelling ──▶ Terminus
```

Scroll is the only clock. Nothing auto-plays past a stop, and the visitor sets the pace. The pacing function maps a scroll distance in viewport heights to a route position: the train holds at a stop for that stop's dwell weight, then travels to the next one over a fixed weight.

A map click, a progress dot or a deep link jumps straight to `Dwelling` at any stop. **Every stop is reachable in one interaction from anywhere**, and that is asserted in the test suite rather than assumed.

### The three lines

| Line | Intent | Budget | What it keeps |
| --- | --- | --- | --- |
| **Express** | skim | short | The flagship stops and the terminus. About a minute. |
| **All stations** | explore | long | Every stop, local stops included. |
| **Network map** | verify | long | The whole network, filterable by skill. |

In Express mode a local stop's dwell collapses to zero: the train passes through it without opening its doors.

## Degrade by layers

| Tier | Condition | What changes |
| --- | --- | --- |
| 0 Full | WebGL works, motion allowed | The journey, the gate, the map and the 3D line. |
| 1 Calm | `prefers-reduced-motion` | The camera cuts between stops instead of sweeping. |
| 2 Light | A low-end device | Fewer instances, a lower pixel ratio, no antialiasing. |
| 3 Classic | No WebGL, or the context was lost | The poster scene, then the Classic view. |
| 4 Plain | No JavaScript | The Classic view, prerendered to static HTML at build time. |

The Classic view is prerendered into a `<noscript>` block at build time, so the page is complete and readable with zero scripting — and because `<noscript>` content is inert while scripting is on, the document never carries the content twice.

If the app fails to boot, an inline timer puts the static page back. There is no state in which a visitor gets a blank page.

## The 3D line

The scene is built entirely from primitives. There is no glTF, no texture map and no model file, so **the whole 3D payload is 0 bytes** and the geometry budget is the only budget that matters.

- **The train** is three articulated cars sharing one body style: a chassis, a roof, an emissive window band, a skirt, six wheels and a red lamp at each end. Parts that share a material are merged, so the whole set is a handful of draw calls.
- **The track** is two rails and a ballast ribbon, with the sleepers, the catenary masts and the city behind them as `InstancedMesh`. Six draw calls for the whole line.
- **The stations** are a modular kit: a platform, a canopy, a board, a bench and a lamp.
- **The dioramas** are one prop per stop, chosen from the project's domain, so a station is recognisable before its name is read.
- **The sky** is one inverted sphere and one shader with no texture. It runs from dawn to night across the journey, and the fog is the horizon colour so the city dissolves into it.

The camera obeys three rules: it eases behind the train rather than being rigidly attached to it, its **angular velocity is capped** so a sweep never exceeds a gentle turn rate, and the horizon stays level - there is no roll, ever.

The budgets are asserted by the unit tests, not by convention. These are the numbers the tests check against:

| Element | Blueprint budget | Built | Draw calls |
| --- | --- | --- | --- |
| The train | 12,000 to 20,000 triangles | 15,076 | 10 |
| The track and the city | under 60 draw calls | 6 | 6 |
| A station | under 8,000 triangles | 212 (worst) | 6 |
| A diorama prop | under 3,000 triangles | 748 (worst) | 1 |
| The whole scene | under 60 draw calls | about 51 | |
| 3D assets on the wire | under 3.5 MB | **0 bytes** | |

The last row is the interesting one: there is no glTF, no texture atlas and no model file. The geometry is built in the browser from primitives, so the 3D payload costs nothing to download.

### Loading the scene

The scene is a separate chunk. The first paint is the poster and the page, and three.js arrives afterwards:

| Chunk | Raw | Gzipped |
| --- | --- | --- |
| The app | 500 KB | **155 KB** |
| The 3D scene, lazy | 945 KB | 253 KB |

The blueprint's budget is 350 KB of initial JavaScript gzipped. The app is 155 KB of it; the rest is the train, and it arrives after the visitor can already read the page.

## The ten-second contract

Within ten seconds a visitor knows who you are, what you do and how to reach you. Contact is the one thing nobody should have to hunt for, so there are three redundant affordances and none of them depends on the others working:

1. A solid accent **Hire me** button in the fixed header — painted on frame one, at every width, never scrolls away. It is a `mailto:`, so there is no form and nothing to fail.
2. The email address itself, in the gate, as a real `mailto:` link.
3. The footer, on every page.

## Design system

- **Palette** is `#000016` navy, `#f1f1f1` off-white, `#9797a5` grey and `#e4032e` signal red.
- One accent colour means one thing: red is *actionable*, or you are *here*. No decorative red anywhere else.
- **Fraunces** for everything that matters. **Inter Tight** for text. **JetBrains Mono** only where it is genuinely a machine readout — a serial number, a dot-matrix board, a stack.
- `border-radius: 0` throughout. Flat colour: no shadows, no blur, no glass.
- Hairlines at 13% white are the only structural device.

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

The end-to-end suite covers the ten-second contract at three widths, the Classic view with JavaScript disabled, the gate, the ticket lifecycle, the deep links, the content parity between the renderers, and the 3D scene with its degradation to the poster.

## Licence

Hand-written apart from the three OFL fonts in `node_modules`. The project screenshots belong to the projects they depict.
