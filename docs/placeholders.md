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

To change it: edit `content/stops/kalyan.json`, then
`npm run generate:content` and `npm run validate`.

### `content/stops/dadar.json` and `content/stops/badlapur.json`

Both carry an empty `stack`, which is correct: the About card and the
Terminus are not a technology. The About card's `architecture` paragraph is a
draft summary of the portfolio's through-line and is worth a rewrite in the
first person.

### `content/profile.json` - the resume

`"resume": ""` on purpose.

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

The blueprint's art direction asks for "bloom at night on the high tier
only". It is **not** implemented. The night sky and the train's emissive
window band carry the mood instead, and the saving is a whole post-processing
pass. It is the one item in the art direction that is outstanding.

### The train model

The train is **built from primitives**, not modelled in Blender. That is the
blueprint's own stated mitigation - "Ship the primitive-built train from the
prototype, upgrade later" - and it keeps the whole 3D payload at zero bytes
of geometry files. A modelled train is a Phase 4b decision, not a blocker.

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
