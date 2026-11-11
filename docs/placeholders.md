# Open items

Everything here is a decision that belongs to Arpit, or an asset that has not
been made yet. Nothing on this page is a placeholder that ships to a visitor:
where a value is missing the site renders nothing rather than a lie.

## Content

### `content/stops/kalyan.json` - the Kalyan Junction card

The blueprint says: "Write the Kalyan Junction card on your Fintech committee
role (one claim, one proof)."

What is there now is a **draft**, written from the committee's own content
model in `Arp1tSingh/fintech-vit`:

- **claim** - "Built and shipped the committee's scroll-driven 3D vault site -
  11 members, 6 portfolios and 3 events behind one scroll journey."
- **proof.metrics** - "11 students across 3-person leadership and 6
  portfolios", "3 events run, 170 attendees in total", "The site shipped with
  a scripted camera audit and a motion diagnostic in CI".
- **role** - `lead`, **period** - 2026-09 to 2026-10.

These numbers come from `content.md` in `fintech-vit`, which is the committee's
own record. What is missing is the part only Arpit can write: **what the
technical portfolio actually did, and what changed because of it.** The
figures above describe the committee; they do not describe the work.

**Decided (2026-11-11):**

- **Role** - Arpit **leads the technical team** of the Fintech committee at
  VIT Mumbai. (An earlier answer picked "core committee member"; this
  correction supersedes it.) The draft's `role: lead` is therefore **correct
  and stays**. Say "technical team" in the card's text so it is not read as
  leading the whole committee, which has its own 3-person leadership.
- **What changed** - the 3D vault site **replaced a basic or missing earlier
  site**. That is the "one proof". It is a before/after claim, so the claim
  line should say what the committee had before, not just what was built.
- **Suggested claim** (for Arpit to confirm or reword, since it is built only
  from the answers above): "Led the Fintech committee's technical team in
  building its scroll-driven 3D vault site, replacing a basic earlier web
  presence." Drop "11 members, 6 portfolios and 3 events", which describes the
  committee rather than the work.

**Still open:** one number that proves the before/after (visits, sign-ups, or
what the old site lacked), and which parts of the build were Arpit's own
versus the team's. Without those the card can state the claim but not
evidence it. `validate:strict` will not catch this, so check it by hand before
the site is shared.

To change it: edit `content/stops/kalyan.json`, then
`npm run generate:content` and `npm run validate`.

### `content/stops/dadar.json` and `content/stops/badlapur.json`

Both carry an empty `stack`, which is correct: the About card and the
Terminus are not a technology. The About card's `architecture` paragraph is a
draft summary of the portfolio's through-line and is worth a rewrite in the
first person.

### `content/profile.json` - the resume

`"resume": ""` on purpose. **Decided (2026-11-11): no resume PDF is ready, so
this stays empty for now.** A resume draft was attached later the same day.
Its contact fields (city, phone, email, LinkedIn handle, CGPA) are bracketed
placeholders, deliberately, for online safety. That is fine for a draft, but
do not publish it as `public/resume.pdf` while the brackets are still in it,
because a public file with a literal `[Phone Number]` reads as an unfinished
template. Either publish a version with only the details Arpit is happy to
make public (for example GitHub and a dedicated email), or keep the field empty.
Two content gaps to fix in the PDF first: it does not mention the Fintech
technical-team lead role, and it does not list MeshStream, the path tracer,
RegimeTrader, BillBox or DictateIt, which are the stops the site is built
around. The LinkedIn handle should also match the profile that is public.

The terminus renders the resume action **only** when this is a non-empty
string, so an unreleased PDF never becomes a dead link. Drop the file in
`public/resume.pdf` and set the field to `resume.pdf`.

### Media still missing

`content/stops/*.json` reference eight images, all present in `public/media/`.
These are the ones the blueprint asks for that do not exist yet:

| Stop | Blueprint asks for | Status |
| --- | --- | --- |
| `slot-01` MeshStream | Cover image, 45 s clip, architecture sketch | **Missing.** A screen recording of the swarm dashboard would be the strongest evidence here - the offload ratio is measured live and the number is real. |
| `slot-02` CPU Path Tracer | Diagram, terminal recording | A render exists. A terminal recording of the renderer running would finish it. |
| `slot-03` RegimeTrader | Result chart, sample output | Two charts exist. |
| `slot-04` LeetCode Tracker | Screenshots, a user quote | One screenshot exists. **A quote from a real user would be worth more than another dashboard.** |
| `slot-05` BillBox | Screenshots, a live link | Two receipt screens exist. The hosted deployment is still pending on the project's own roadmap, so `links.demo` is empty. |
| `slot-06` DictateIt | Short clip | **Missing.** The tool reads assignments aloud; the clip is the proof. |
| `slot-07` Fintech VIT 3D Vault | Photo or render | The committee's own asset export exists. |
| `slot-08` Bus Route Planner | Screenshot | **Missing.** |
| `slot-09` LeetCode Archive | Screenshot, status note | **Missing.** |

The four **Missing** rows are the ones worth doing next. Each is one clip or
one screenshot, and each is evidence the ticket currently cannot carry.

**Decided (2026-11-11):**

| Stop | Plan |
| --- | --- |
| `slot-01` MeshStream | **Arpit to record** the swarm dashboard clip, with the live offload ratio visible. |
| `slot-06` DictateIt | **Arpit to record** the short clip of it reading an assignment aloud. |
| `slot-08` Bus Route Planner | Not planned. Leave the stop without a screenshot for now. |
| `slot-09` LeetCode Archive | Not planned. Leave the stop without a screenshot or status note for now. |

Nothing renders for a missing image, so the two skipped stops are safe to ship.

**Seen on GitHub (read 2026-11-11):** `leetcode-practice-tracker.vercel.app` is
set as the homepage of `Leetcode-Practice-Tracker`, so `slot-04` can carry a
`links.demo`. `BillBox` has no homepage set, which agrees with `links.demo`
being empty on `slot-05`. `meshstream` and `dictateit` both have public repos
but no homepage. I could read only the first part of the repo list, so I did
not confirm repos for Bus Route Planner or LeetCode Archive.

## Product

### Analytics

**None.** The blueprint lists "a privacy-friendly tool or none" as an open
decision, and none is the honest answer for a site that measures nothing
about its visitors. The ticket wallet lives in `localStorage` and nothing
leaves the browser.

If analytics are ever wanted, the number to watch is the one the wallet
already keeps: tickets kept, tickets emailed, repositories opened.

### Sound

**None.** The blueprint asks whether the train should make a noise. It does
not, and the mute button that would come with it is not in the interface.

### Bloom

**Done (2026-11-11).** The blueprint's art direction asks for "bloom at night
on the high tier only", and that is what it does: the composer's bloom pass
runs once the journey is more than half way through and the sky has gone
dark, and only on the high tier.

The threshold is high on purpose. The rails are the brightest mark on the
ground and they should not turn into a laser beam; only the train's window
band, the station lamps and the platform edges are meant to glow.

The cost is one extra pass and a render target, so the scene is still a lazy
chunk and a visitor without WebGL never fetches it.

### A modelled train

The train is **built from primitives**, not modelled in Blender. That is the
blueprint's own stated mitigation - "Ship the primitive-built train from the
prototype, upgrade later" - and it keeps the whole 3D payload at zero bytes
of geometry files. A modelled train is a Phase 4b decision, not a blocker.

The numbers the primitives currently hit, all asserted by the unit tests:

| Element | Blueprint budget | Built |
| --- | --- | --- |
| The train | 12,000 to 20,000 triangles | 15,076 |
| The track | under 60 draw calls | 6 |
| A station | under 8,000 triangles | 212 (worst) |
| A diorama | under 3,000 triangles | 748 (worst) |

### A curved line

The track runs straight along the X axis. The camera rig already caps its
angular velocity and eases behind the train, so a curve can be added without
touching either rule - but the curve itself is not there.

## How to change any of this

```
# 1. edit content/*.json
npm run generate:content   # rebuild src/data/generated.ts
npm run validate           # the build gate
npm test                   # the core
npm run test:e2e           # the browser
```

`npm run validate:strict` additionally refuses any `TBD` left in the content.
That is the launch gate: it should pass before the site is shared.

### Adding a stop

1. Write `content/stops/<id>.json`. The shape is in the README; `npm run
   validate` will tell you exactly what is missing.
2. Add the id to `content/route.json` under `order`. The validator refuses a
   file that is not on the order and an order entry with no file.
3. Give it a `prop` from the list in
   `src/renderers/scene3d/Dioramas.tsx`. A prop that is not on the list draws
   nothing at the station rather than a placeholder box, so a typo is quiet
   in the scene and obvious in the code.
4. `npm run generate:content && npm run validate && npm test`.

The station's sign is drawn from `stop.station` at runtime, so a new station
needs no image work at all.