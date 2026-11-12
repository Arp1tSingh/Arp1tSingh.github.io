# The Local 3D: Portfolio Blueprint

> Converted from `The Local 3D Portfolio Blueprint.docx` (Nov 10, 2026, @Arpit Singh).
> The original document is the source of truth; this is the same text, in the repository.

# The Local 3D: Portfolio Blueprint

Nov 10, 2026 · @Arpit Singh

## Thesis

The portfolio answers one question: for this visitor's intent and time budget, which evidence should they see, and in what order? The train is one way to show that answer, not the product.

\text{Route}(i, b) = \operatorname{order}\big(\{\, e \in E : \operatorname{relevance}(e, i) \ge \tau(b) \,\}\big)

E is all your evidence (projects and roles), i is the visitor's intent (skim, verify or explore), and b is their time budget. The threshold τ falls as b grows: a short budget keeps only flagship stops (Express), a long one keeps all of them (All stations).

This framing buys three things. The 3D line, a flat Classic view and a network map become interchangeable renderers of one route. The metaphor can change later without touching content. And every design choice gets a test: does it help a visitor reach evidence faster or judge it better?

## Core model

Every metaphor term maps to one system concept, and only the third column is replaceable.

| Metaphor | Abstract concept | How it shows up | Data field |
| --- | --- | --- | --- |
| Passenger | Visitor intent and time budget | Entry gate: Express, All stations or Map | intent, budget |
| Line | Ordering policy over evidence | Track path in 3D, card order in Classic view | route.order |
| Stop | One unit of evidence | Platform, station board, diorama | stops[] |
| Fast halt, slow stop | Priority tier | Express skips slow-only stops | tier |
| Ticket | A contract: claim, proof, next action | Pop-up ticket; front is the claim, back is the proof | claim, proof, links |
| Interchange | Relation between stops | Transfer lines on the map, skill filter | stack, domain |
| Timetable | Pacing | Dwell and travel lengths, snap points | pacing |
| Signage | Wayfinding and state feedback | Dot-matrix indicator, progress dots, deep links | derived |
| Sky | Progress without numbers | Dawn to night across the journey | derived |
| Terminus | Conversion | Contact ticket, résumé, repo links | cta |

The data field is the source of truth. Renderers read it and never copy it, so a fix in one place updates the scene, the map and the Classic view together.

## Invariants

Eight rules hold in every renderer. Break one and the metaphor has started to hide the work.

- One dataset, many renderers. No fact exists only in 3D. Anything a visitor learns in the scene is also in the Classic view.
- Two interactions to any stop. From anywhere, a visitor reaches any stop through the map, the progress dots, the keyboard or a deep link.
- A ticket stands alone. It holds a claim (one sentence), proof (a link, clip or metric) and a next action (repo, demo or case study).
- Motion carries information. If removing an animation loses nothing, remove it.
- Scroll is the only clock. Nothing auto-plays past a stop, and the visitor sets the pace.
- Degrade by layers. WebGL falls back to a poster scene, then to the Classic view, with identical content at every step.
- Honest evidence. Every claim links to something checkable, and no placeholder numbers ship.
- The ten-second contract. Within ten seconds a visitor knows who you are, what you do and how to reach you.
## Experience blueprint

Seven upgrades turn the prototype into a recruiter-ready product, each aimed at one visitor need.

| Prototype | Upgrade | Why it matters |
| --- | --- | --- |
| One scroll path | Entry gate with three lines: Express (flagship stops, about a minute), All stations, and Network map | Serves different intents and time budgets from the first screen |
| Ticket shows text | Ticket v2: front is the claim, back is the proof, actions carry the links and the wallet | Separates a two-second scan from a thirty-second read |
| Identical stations | One small diorama prop per stop, chosen from the project's domain | Makes each stop recognizable before its name is read |
| Progress is implicit | Dot-matrix indicator, progress dots and the sky cycle, plus a top-down Network map | Always answers where am I and what is left |
| Nothing is remembered | Ticket wallet: visitors keep tickets, and the terminus opens an email listing them | Turns browsing into a shortlist, with no backend |
| Interchange on hover | Skills drawn as transfer lines on the map; picking a skill filters stops | Lets an engineer navigate by technology, not by order |
| Desktop first | Swipe between stops, bottom-sheet tickets, stepped cuts when reduced motion is on | Keeps the journey usable on a phone and for motion-sensitive visitors |

### Ticket anatomy

- Front (two seconds): station board, claim, three stack tags, tier stamp.
- Back (thirty seconds): proof such as metrics, screenshots and an architecture sketch, plus role, period and the repo, demo and case-study actions.
- Actions: the repo, demo and case-study links, the résumé, and a Keep ticket action for the wallet.
- Station board: the name, the tier stamp and the close action on one line, so the way out sits on the board and never covers the proof.
### Entry gate

The gate asks where to, with Express, All stations and Map as three buttons. Links you control can preselect one: a résumé link opens Express, a portfolio link opens All stations. The wallet stays in the browser's local storage, so nothing leaves the visitor's device.

## Architecture

Content feeds one framework-free core, and every renderer reads from that core. Nothing in core/ touches the DOM or three.js, so it stays testable and the renderers stay swappable.

architecture · 3 layers, 3 renderers

Read it top to bottom: content is validated at build, the core turns a scroll position into a route position, and the renderers draw it.

### Repo layout

portfolio/ ├─ content/ │ ├─ stops/ # one file per stop (JSON or MDX) │ ├─ profile.json # name, role, links, résumé path │ └─ route.json # stop order, tiers, pacing weights ├─ src/ │ ├─ core/ # route(), pacing(), journey state machine │ ├─ renderers/ │ │ ├─ scene3d/ # train, track, stations, sky, dioramas │ │ ├─ map2d/ # network map, interchange lines │ │ └─ classic/ # static, SEO-friendly page │ ├─ ui/ # Gate, Ticket, Indicator, Wallet │ └─ main.ts ├─ public/models/ # train.glb, props.glb (compressed) ├─ scripts/ # validate content, OG images, sitemap └─ tests/ # unit (core) and end-to-end

### Stop schema

Every stop is one record, and placeholders mark what you fill from GitHub.

{ "id": "slot-01", "title": "TBD", "oneLiner": "What it does, in one sentence", "tier": "express", "domain": "web", "role": "solo", "stack": ["TBD"], "claim": "The result in one sentence, with a number if you have one", "proof": { "metrics": [], "media": [], "architecture": "TBD" }, "links": { "repo": "TBD", "demo": "", "caseStudy": "" }, "period": { "start": "YYYY-MM", "end": "YYYY-MM" }, "station": "Kurla", "prop": "TBD" }

Allowed values: tier is express or local; domain is web, ai, systems, hardware or tools; role is solo, lead or contributor. The build fails if a required field is empty.

### Pacing function

Scroll is the only clock. Let X be scroll distance in viewport heights; the core maps X to a route position s. It holds at stop k for that stop's dwell weight, then travels to the next stop over a fixed weight, easing in or out only at real halts. Express mode sets the dwell weight of local-only stops to zero, so the train passes through them. The function is pure, so it gets unit tests instead of screenshots.

### Journey states

- Gate: the visitor picks Express, All stations or Map.
- Boarding: the train waits at the first stop with the hero card.
- Traveling: scroll moves the train between stops.
- Dwelling: the train holds at a stop and its ticket opens; scrolling on closes it and returns to Traveling.
- Terminus: the contact ticket and the wallet summary appear.
A map click, a progress dot or a deep link jumps straight to Dwelling at any stop.

## 3D art direction and budgets

Keep the look flat-shaded and baked. It reads well at 30 fps on a phone and stays inside the budgets below.

| Element | Approach | Budget |
| --- | --- | --- |
| Train | Three articulated cars sharing one mesh, baked ambient occlusion, emissive window map, wheel spin tied to speed, doors that open at a stop | 12k to 20k triangles, one 1024 px atlas |
| Track and city | Instanced sleepers, masts and buildings; ribbons for rails and ballast | Under 60 draw calls |
| Stations | A modular kit (platform, canopy, board) with baked light | Under 8k triangles each |
| Dioramas | One prop per stop, built from the project's domain | Under 3k triangles each |
| Sky | A gradient shader keyed to journey progress, with fog matching the horizon | No skybox texture |
| Lighting | One directional and one hemisphere light; bloom at night on the high tier only | No real-time shadows |

### Asset pipeline

- Model and bake in Blender, then export glTF.
- Compress with gltf-transform: Draco or Meshopt for geometry, KTX2 for textures, deduplicated meshes.
- Split into chunks (train and track first, each station's props on approach) so first paint never waits on dioramas.
- Check a build report that totals stay under the budgets in the acceptance table.
### Camera rules

- Cap camera angular velocity so diagonal sweeps never exceed a gentle turn rate, and tune it on a phone.
- Keep the horizon level, with no roll.
- Ease the camera behind the train instead of rigidly attaching it.
- On reduced motion, replace sweeps with cuts between stops.
## Content plan

Pick for coverage first, then for quality: nine project slots, each with a job, so the line shows range instead of nine variations of one skill. Fill the Repo column from your GitHub; every other cell is already decided.

| Slot | Station | Tier | Job it must do | Repo | Media needed |
| --- | --- | --- | --- | --- | --- |
| 1 | Kurla | Express | Flagship: your strongest end-to-end build | TBD | Cover image, 45 s clip, architecture sketch |
| 2 | Ghatkopar | Express | Systems depth: networking, OS or low-level work | TBD | Diagram, terminal recording |
| 3 | Mulund | Express | Data or AI: a model or pipeline with a measured result | TBD | Result chart, sample output |
| 4 | Thane | Express | Product: something real people used | TBD | Screenshots, a user quote if you have one |
| 5 | Dombivli | Express | Full stack: frontend, backend and deployment | TBD | Cover image, live link |
| 6 | Sion | Local | Tooling: a utility you use yourself | TBD | Short clip |
| 7 | Diva | Local | Hardware or graphics: physical or visual work | TBD | Photo or render |
| 8 | Ulhasnagar | Local | Early work: shows how far you have come | TBD | Screenshot |
| 9 | Ambernath | Local | Newest: what you are building now | TBD | Screenshot, status note |

Kalyan Junction holds experience rather than a repo: your technical-lead role in the college Fintech committee. Dadar Junction is About, and Badlapur is the terminus with contact and résumé.

### Selection rubric

Score each candidate repo out of 100. Feature it at 60 or more; below that, fix the README or drop it.

| Criterion | What to check | Points |
| --- | --- | --- |
| Clarity | README states the problem, the approach and shows a screenshot | 15 |
| Runs fresh | Cloning it and running one command works | 15 |
| Evidence | Live demo or a clip under a minute | 15 |
| Fit | Matches the job the slot needs | 15 |
| Role | Your part is clear, especially on team work | 10 |
| Quality | Tests or CI, readable history, no secrets committed | 10 |
| Recency | Touched in the last year, or clearly finished | 10 |
| Originality | Not a tutorial clone | 10 |

## Accessibility, performance and fallbacks

Every visitor lands on a working page: five tiers degrade the experience step by step while the content stays identical.

| Tier | Condition | What changes |
| --- | --- | --- |
| 0 Full | WebGL works, motion allowed | Everything in this blueprint |
| 1 Calm | Reduced motion is on | Cuts between stops, no camera sweeps, a static sky per stop |
| 2 Light | Low-end GPU or slow device | Lower pixel ratio, fewer instances, 30 fps cap, no bloom |
| 3 Classic | No WebGL, or context lost | Poster image plus the Classic view |
| 4 Plain | No JavaScript | Classic view rendered to static HTML at build time |

### Accessibility

- A visually hidden list of stops mirrors the scene, with real headings, so screen readers and search engines see all the content.
- Keyboard: arrow keys move between stops, E picks Express, M opens the map, C opens the Classic view, and the ticket is a dialog that traps focus.
- An aria-live region announces Now at and Next as the indicator changes.
- Text on the dot-matrix board and tickets meets WCAG AA contrast.
- A pause control stops all ambient animation.
### Performance habits

- Show a poster image first so the largest paint lands before the 3D loads.
- Pause rendering when the tab is hidden or the canvas is off screen.
- Lazy-load media per stop, and skip clips when the visitor has data saver on.
- Handle WebGL context loss by restoring the scene or dropping to tier 3.
## Roadmap

The line is shippable after the third phase, and about five to six weeks of steady effort covers all six phases.

roadmap · 6 phases, 5 gates

If a gate fails, extend that phase instead of starting the next, and stretch the durations around exams.

- Content: choose the repos, score them with the rubric, fill the slots table.
- Core path: build route(), the pacing function and the journey states, with a placeholder train on the track.
- Tickets: drive stops and tickets from the data, then add the Classic view and deep links.
- Art pass: glTF train, station kit, dioramas, sky and lighting within budgets.
- Harden: accessibility, performance tiers, cross-browser tests and analytics.
- Launch: deploy, add social images and the résumé link, then share.
## Acceptance criteria and metrics

The build is done when every row passes, and each target has a named way to measure it.

| Area | Target | How to measure |
| --- | --- | --- |
| Ten-second contract | 3 of 3 test visitors name who you are, what you do and how to contact you within 10 s | Watch three people, no hints |
| Largest contentful paint, mobile on 4G | 2.5 s or less | Lighthouse CI |
| Initial JavaScript | 350 KB gzip or less | Build size report |
| 3D assets | 3.5 MB or less in total (models 1.5 MB, textures 2 MB) | Build size report |
| Frame rate | 55 fps or more on a laptop, 30 fps or more on a mid-range phone | Dev FPS meter on real devices |
| Lighthouse scores | Accessibility 95 or more; performance 85 or more on mobile, 95 or more on Classic | Lighthouse CI |
| Stop reachability | Every stop within 2 interactions | End-to-end test |
| Content parity | Every stop field appears in all three renderers | Unit test against the schema |
| Browser errors | Zero console errors in Chrome, Safari and Firefox | Playwright run |

Conversion targets (tickets opened, repo clicks, résumé downloads) wait for two weeks of baseline data, so you set them from evidence instead of guessing.

## Risks as derailments

The biggest risk is not technical: the metaphor can start to outweigh the work it carries.

| Derailment | Early signal | Mitigation |
| --- | --- | --- |
| Gimmick overshadows the work | Visitors mention the train but no project | A ticket appears within 2 s of each stop; test with strangers |
| Scope creep | Sound, weather and extra modes arrive before the MVP gate | Park them on a later list; nothing extra ships before the third gate |
| Weak repos | Several candidates score under 60 | Time-box a fix to two days per repo, or drop the slot |
| Heavy assets | Frame rate dips on a mid-range phone | Budgets checked in CI, tier 2 settings, lazy chunks |
| Motion discomfort | Visitors report dizziness or skip the scene | Angular-velocity cap, reduced-motion tier, a pause control |
| Invisible to search | Content exists only inside the canvas | Static Classic view and a hidden stop list, both built from the same data |
| Modeling bottleneck | The train model takes more than a week | Ship the primitive-built train from the prototype, upgrade later |

## Open decisions for Arpit

Nine choices are yours, and the first two unblock the rest.

- ☐ Pick nine repos using the rubric and fill the Repo column in the content plan
- ☐ Choose the framework: vanilla three.js, or React Three Fiber with a framework-free core (recommended, since you already know React)
- ☐ Pick the default entry line: Express or All stations
- ☐ Write the Kalyan Junction card on your Fintech committee role (one claim, one proof)
- ☐ Decide on sound: none, or off by default with a toggle
- ☐ Choose hosting and a domain: GitHub Pages, Vercel or Netlify
- ☐ Decide the train model source: build it in Blender, adapt a freely licensed model (check the license), or keep the primitive-built one
- ☐ Finalize a one-page résumé PDF for the terminus
- ☐ Choose analytics: a privacy-friendly tool or none
