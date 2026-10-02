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
| Type         | Space Grotesk + JetBrains Mono (Google Fonts, with fallbacks)|
| Hosting      | GitHub Pages, deployed straight from the branch root        |

```
index.html      markup + content + inline SVG icon sprite
404.html        styled not-found page
styles.css      the whole design system
js/
  main.js       orchestration: boot, nav, drawer, typewriter, filters, heatmap, copy
  config.js     editable content — name, roles, email, projects, repo data
  particles.js  constellation canvas background
  cursor.js     custom cursor
  tilt.js       pointer-driven 3D tilt + glow tracking
  reveal.js     scroll reveals, counters, skill bars, timeline spine
  palette.js    ⌘K / Ctrl+K command palette with fuzzy search
assets/         images, favicon, Open Graph card
tools/          one-off maintenance scripts
```

The page works without JavaScript: every project, skill and bio is in the HTML. JS only adds
motion, filtering and the command palette.

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

To use a custom domain instead, add a `CNAME` file containing the domain, then point a CNAME
record at `arp1tsingh.github.io` in DNS. All asset paths in this repo are **relative**
(`./styles.css`, not `/styles.css`), so the site works unchanged at a root domain, a subpath, or
a local file server.

## Editing content

Almost everything you'll want to change lives in `js/config.js`:

- `CONFIG.email` — leave empty to hide the email card; set it and an email card appears in the
  contact section automatically.
- `CONFIG.roles` — the phrases the hero typewriter cycles through.
- `PROJECTS` — powers the ⌘K command palette. The visible cards live in `index.html`.
- `REPOS` / `GITHUB_STATS` — drive the activity heatmap and the stats cards.

The language percentages in the skills section are computed from bytes of code across all public
repositories, not hand-written. Refresh them from:

```bash
gh api users/Arp1tSingh/repos --paginate --jq '.[].languages_url'
```

## Maintenance scripts

`tools/defringe.mjs` strips the white "sticker" halo that background removers leave around a
cutout, by eroding the alpha silhouette and bleeding interior colour outward.

```bash
npm i pngjs
node tools/defringe.mjs input.png output.png 7
```

Radius `7` matched the fringe in `assets/arpit.png`. It also cut that file from 1.06 MB to 352 KB.

`assets/og-source.svg` is the source for the Open Graph card. To regenerate `assets/og.png`:

```bash
npx @resvg/resvg-js-cli --font-dir ./fonts assets/og-source.svg assets/og.png
```

## Accessibility & performance notes

- Every animation is disabled under `prefers-reduced-motion: reduce`; content that depends on
  scroll reveals falls back to visible, and the canvas background is not painted at all.
- The custom cursor and 3D tilt only initialise for `(pointer: fine)` devices.
- Keyboard: `⌘K` / `Ctrl+K` opens the command palette, `/` opens it too, `Esc` closes, arrows
  navigate. Focus is returned to the trigger on close.
- The canvas pauses when the tab is hidden and when the hero scrolls out of view.
- External links carry `rel="noopener noreferrer"`.

## Licence

Code for this site: do whatever you like with it. The project screenshots in `assets/` belong to
the projects they depict.
