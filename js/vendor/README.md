# js/vendor

Pinned third-party builds, committed to the repository so the site has **no install step and no
runtime CDN dependency**. Pages deploys the branch root directly, so anything not committed here
would not ship.

These files are **not** hand-written. Do not edit them. To update, replace the file from the source
below, bump the version in `index.html`'s integrity-free `script` tags if the filename changes, and
re-run the motion verification described in the root `README.md`.

| File                  | Version | Source                                                                                              | Global          | Licence |
| --------------------- | ------- | ---------------------------------------------------------------------------------------------------- | --------------- | ------- |
| `gsap.min.js`         | 3.13.0  | `https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js`                                          | `window.gsap`        | GSAP Standard "no charge" licence — free for this kind of use, but **not** MIT/OSS. Read <https://gsap.com/standard-license/> before commercial redistribution. |
| `ScrollTrigger.min.js`| 3.13.0  | `https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js`                                 | `window.ScrollTrigger` | Same as GSAP. |
| `lenis.min.js`        | 1.3.11  | `https://cdn.jsdelivr.net/npm/lenis@1.3.11/dist/lenis.min.js`                                        | `window.Lenis`        | MIT. |

## Why these three

- **Lenis** supplies the smoothed scroll position that every scrubbed sequence reads from.
- **GSAP + ScrollTrigger** supply pinning, scrubbing and timeline control. `ScrollTrigger` is the
  plugin that converts scroll distance into timeline progress; GSAP alone cannot do that.
- Lenis and ScrollTrigger must be kept in step, or pinned sections drift by a frame during fast
  flicks. `js/scroll.js` handles that with the standard `lenis.on('scroll', ScrollTrigger.update)`
  plus `gsap.ticker` pairing.

## Fallback contract

`js/scroll.js` adds the `js-scroll` class to `<html>` **only after all three globals resolve**. Every
pinned container, scrubbed transform and dock rule is scoped under `.js-scroll`. So:

- JavaScript disabled → plain stacked document, everything readable.
- These files missing or blocked → plain stacked document, everything readable.
- `prefers-reduced-motion: reduce` → plain stacked document, final states rendered statically.

No visitor can end up staring at a blank or half-built page because a script failed.