/* ============================================================
   verify.cjs — behaviour harness for arp1tsingh.github.io

   Run:  python3 -m http.server 8000 &
         node tools/verify.cjs http://127.0.0.1:8000

   Asserts the things a screenshot cannot: the ten-second rule, the arming
   contract, the scrub ranges, and that nothing is clipped out of reach.
   ============================================================ */

const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:8000';
const WIDTHS = [1280, 1440, 1920];   // desktop first; mobile is a later pass

const fail = [];
const pass = [];
const ok = (cond, msg) => (cond ? pass : fail).push(msg);
const label = (r) => r ? `${r.trig} [${r.y1}->${r.y2}] ${r.before} => ${r.after}` : 'no trigger';

(async () => {
  const browser = await chromium.launch();

  /* ================= 1 · desktop sweep ================= */
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [], failed = [], hosts = new Set();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('requestfailed', (r) => failed.push(`${r.url()} ${r.failure()?.errorText}`));
    page.on('request', (r) => hosts.add(new URL(r.url()).host));

    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    /* ---- no runtime noise ---- */
    ok(errors.length === 0, `${width}px: zero console errors ${JSON.stringify(errors.slice(0, 3))}`);
    ok(failed.length === 0, `${width}px: zero failed requests ${JSON.stringify(failed.slice(0, 3))}`);

    /* ---- self-contained: no third-party font host, ever ---- */
    const fontHosts = [...hosts].filter((h) => /fonts\.(googleapis|gstatic)\.com/.test(h));
    ok(fontHosts.length === 0, `${width}px: no Google Fonts request (hosts: ${JSON.stringify([...hosts])})`);

    /* ---- the display face actually applied, at the right optical size ---- */
    const type = await page.evaluate(() => {
      const fvs = (sel) => getComputedStyle(document.querySelector(sel)).fontVariationSettings;
      return {
        fam: getComputedStyle(document.querySelector('.hero__name')).fontFamily,
        fvs: fvs('.hero__name'),
        loaded: [...document.fonts].map((f) => `${f.family}:${f.status}`),
        heroSize: getComputedStyle(document.querySelector('.hero__name')).fontSize,
      };
    });
    ok(/Fraunces/.test(type.fam), `${width}px: hero set in Fraunces (${type.fam.split(',')[0]})`);
    ok(/opsz"?\s*144/.test(type.fvs), `${width}px: hero at opsz 144 (${type.fvs})`);
    ok(type.loaded.every((f) => f.endsWith('loaded')), `${width}px: all self-hosted faces loaded (${type.loaded.join(', ')})`);
    ok(parseFloat(type.heroSize) > 200, `${width}px: hero name is display scale (${type.heroSize})`);

    /* ---- the ten-second rule, with zero scrolling ---- */
    const cta = await page.evaluate(() => {
      const vh = innerHeight;
      const seen = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.top < vh && r.bottom > 0 && r.width > 0 && r.height > 0
          && cs.visibility !== 'hidden' && cs.opacity !== '0';
      };
      return {
        nav: seen('.nav__hire'),
        heroMail: seen('.hero__mail'),
        navHref: document.querySelector('.nav__hire')?.getAttribute('href'),
        heroHref: document.querySelector('.hero__mail')?.getAttribute('href'),
      };
    });
    ok(cta.nav, `${width}px: header "Hire me" in the first viewport`);
    ok(cta.heroMail, `${width}px: hero email in the first viewport`);
    ok(/^mailto:/.test(cta.navHref || ''), `${width}px: header CTA is a mailto (${cta.navHref})`);
    ok(/^mailto:/.test(cta.heroHref || ''), `${width}px: hero CTA is a mailto (${cta.heroHref})`);

    /* ---- the hero name is never left hidden by the wipe ---- */
    ok(await page.evaluate(() => [...document.querySelectorAll('.line')].every((l) => l.classList.contains('is-in'))),
      `${width}px: hero wipe completed, both lines revealed`);

    /* ---- copy budget: evidence, not narration ---- */
    const words = await page.evaluate(() =>
      document.querySelector('main').innerText.trim().split(/\s+/).filter(Boolean).length);
    ok(words <= 340, `${width}px: <main> is ${words} words (budget 340)`);

    /* ---- nothing clipped out of reach ---- */
    const bleed = await page.evaluate(() => {
      const clipped = (el) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          if (getComputedStyle(p).overflowX !== 'visible') return true;
        }
        return false;
      };
      const vw = document.documentElement.clientWidth;
      const out = [];
      document.querySelectorAll('main *, .footer *, .dock *').forEach((el) => {
        if (el.matches('.sprite, .cursor, .boot, .palette, .drawer')) return;
        if (clipped(el)) return;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        if (r.right > vw + 1 || r.left < -1) out.push(`${el.tagName}.${(el.className || '').toString().split(' ')[0]}`);
      });
      return [...new Set(out)].slice(0, 6);
    });
    ok(bleed.length === 0, `${width}px: nothing clipped past the viewport ${JSON.stringify(bleed)}`);

    /* ---- the photographs are real, duotoned, and not absurdly upscaled ---- */
    // Both image sets are lazy, so naturalWidth stays 0 until the browser has
    // actually fetched them. Walk the page top to bottom to trigger every one.
    await page.evaluate(async () => {
      const step = innerHeight * 0.8;
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 90));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1800);
    const imgs = await page.evaluate(() => [...document.querySelectorAll('.shot img, .band__img')].map((i) => ({
      cls: i.parentElement.className,
      file: (i.currentSrc || i.getAttribute('src') || '').split('/').pop(),
      nat: i.naturalWidth,
      rendered: Math.round(i.getBoundingClientRect().width),
      filter: getComputedStyle(i).filter,
    })));
    const shots = imgs.filter((i) => i.cls.includes('shot'));
    const band = imgs.find((i) => i.file.includes('landscape'));
    ok(shots.length === 2, `${width}px: both software screenshots present (${shots.map((i) => i.file).join(', ')})`);
    ok(shots.every((i) => i.nat > 0), `${width}px: screenshots actually loaded (${shots.map((i) => `${i.file} ${i.nat}px`).join(', ')})`);
    ok(shots.every((i) => /url\(/.test(i.filter)), `${width}px: screenshots carry the duotone filter (${shots.map((i) => i.filter).join(' | ')})`);
    ok(shots.every((i) => i.rendered / i.nat <= 1.35),
      `${width}px: screenshots not upscaled (${shots.map((i) => `${i.file} ${i.rendered}/${i.nat}`).join(', ')})`);
    ok(band && band.nat > 0, `${width}px: photo band loaded (${band ? `${band.nat}px` : 'missing'})`);
    ok(band && band.rendered / band.nat <= 1.6,
      `${width}px: photo band upscale is ${band ? (band.rendered / band.nat).toFixed(2) : '?'}x (limit 1.6)`);
    ok(band && !/url\(/.test(band.filter), `${width}px: photo band is full colour, not duotoned (${band?.filter})`);

    /* ---- calendar is real, generated data ---- */
    const cal = await page.evaluate(() => ({
      cells: document.querySelectorAll('#calGrid .cal__cell').length,
      lit: document.querySelectorAll('#calGrid .cal__cell:not([data-l="0"])').length,
      total: document.querySelector('#cTotal')?.textContent,
      days: document.querySelector('#cDays')?.textContent,
      first: document.querySelector('#cFirst')?.textContent,
      repos: document.querySelector('#cRepos')?.textContent,
    }));
    ok(cal.cells > 300 && cal.lit === 59, `${width}px: calendar ${cal.cells} cells, ${cal.lit} lit`);
    ok(cal.total === '248' && cal.days === '59' && cal.repos === '16',
      `${width}px: calendar figures ${cal.total}/${cal.days}/${cal.repos}`);
    ok(cal.first === 'Oct 2025', `${width}px: first commit "${cal.first}"`);

    /* ---- every pinned sequence has a real scrub range and really moves ---- */
    const scrub = await page.evaluate(async () => {
      const st = window.ScrollTrigger;
      const settle = () => new Promise((r) => setTimeout(r, 1400));
      // Lenis wins over window.scrollTo until its own tween is idle, so poll
      // until the real position matches the request.
      const goto = async (y) => {
        for (let i = 0; i < 14; i++) {
          window.scrollTo(0, y); st.update();
          await new Promise((r) => setTimeout(r, 110));
          if (Math.abs(window.scrollY - y) < 2) break;
        }
        await settle(); st.update();
      };
      const probe = async (sel, read) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const t = st.getAll().find((x) => x.trigger?.contains(el) || x.trigger === el);
        if (!t) return null;
        await goto(t.start);
        const before = read(), pr1 = +t.progress.toFixed(3), y1 = Math.round(scrollY);
        await goto(t.start + (t.end - t.start) * 0.5);
        const after = read(), pr2 = +t.progress.toFixed(3), y2 = Math.round(scrollY);
        await goto(0);
        return { trig: t.trigger.id || t.trigger.dataset.seq, start: Math.round(t.start),
                 end: Math.round(t.end), y1, pr1, before, y2, pr2, after, pin: !!t.pin };
      };
      const out = {};
      out.hero = await probe('.hero__name', () => getComputedStyle(document.querySelector('.hero__name')).transform);
      out.impact = await probe('.impact__line', () => getComputedStyle(document.querySelector('.impact__line')).color);
      out.seg = await probe('.share__seg', () => getComputedStyle(document.querySelector('.share__seg')).transform);
      out.band = await probe('.band__img', () => getComputedStyle(document.querySelector('.band__img')).transform);
      out.rail = await probe('.journey__rail', () => getComputedStyle(document.querySelector('.journey__rail')).transform);
      out.count = st.getAll().length;
      out.pins = st.getAll().filter((t) => t.pin).length;
      return out;
    });

    ok(scrub.pins === 6, `${width}px: six pinned sequences registered (${scrub.pins})`);
    const moved = (r) => r && r.after !== r.before;
    ok(moved(scrub.hero), `${width}px: hero type moves on scrub (${label(scrub.hero)})`);
    ok(moved(scrub.impact), `${width}px: impact statement shifts colour on scrub (${label(scrub.impact)})`);
    ok(moved(scrub.seg), `${width}px: share bar fills on scrub (${label(scrub.seg)})`);
    ok(moved(scrub.band), `${width}px: photo band parallaxes on scrub (${label(scrub.band)})`);
    ok(moved(scrub.rail), `${width}px: journey rail translates on scrub (${label(scrub.rail)})`);
    for (const k of ['hero', 'impact', 'seg', 'band', 'rail']) {
      ok(scrub[k].end > scrub[k].start, `${width}px: ${k} has a non-zero scrub range (${scrub[k].end - scrub[k].start}px)`);
    }
    // The impact statement must finish red, which is the whole point of it.
    const red = await page.evaluate(() => {
      const t = document.querySelectorAll('[data-seq^="impact-"]')[1];
      const st = window.ScrollTrigger.getAll().find((x) => x.trigger === t);
      // Past the end, so progress clamps to exactly 1. Sitting on `end` leaves
      // a scrub:1 tween a couple of percent short of the target colour.
      window.scrollTo(0, st.end + 400); st.update();
      return new Promise((r) => setTimeout(() => {
        r(getComputedStyle(t.querySelector('[data-impact]')).color);
      }, 2200));
    });
    ok(/228, 3, 46/.test(red), `${width}px: impact statement lands on signal red (${red})`);

    /* ---- dock lifecycle ---- */
    const dock = await page.evaluate(async () => {
      const st = window.ScrollTrigger;
      const d = document.querySelector('#dock');
      const contact = document.querySelector('#contact');
      const at = (y) => new Promise((r) => {
        window.scrollTo(0, y); st.update(); setTimeout(r, 900);
      });
      await at(0); const top = d.classList.contains('on');
      await at(innerHeight * 3); const mid = d.classList.contains('on');
      await at(contact.getBoundingClientRect().top + scrollY - 30);
      const outro = d.classList.contains('on');
      await at(0);
      return { top, mid, outro };
    });
    ok(!dock.top, `${width}px: dock off at the top (${dock.top})`);
    ok(dock.mid, `${width}px: dock on mid-page (${dock.mid})`);
    ok(!dock.outro, `${width}px: dock off over the contact block (${dock.outro})`);

    await ctx.close();
  }

  /* ================= 2 · JavaScript disabled ================= */
  {
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'load' });
    const r = await page.evaluate(() => {
      const hidden = [];
      document.querySelectorAll('main *').forEach((el) => {
        if (parseFloat(getComputedStyle(el).opacity) === 0 && el.textContent.trim()) {
          hidden.push(el.className || el.tagName);
        }
      });
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        hidden: hidden.slice(0, 5),
        cls: document.documentElement.className,
        segs: [...document.querySelectorAll('.share__seg')].map((s) => s.getBoundingClientRect().width),
        bandH: Math.round(document.querySelector('.band').getBoundingClientRect().height),
        railOverflow: document.querySelector('.journey__rail').scrollWidth,
        hasHire: !!document.querySelector('.nav__hire'),
        words: document.querySelector('main').innerText.trim().split(/\s+/).length,
      };
    });
    ok(r.overflow <= 0, `no-JS: no horizontal overflow (delta ${r.overflow})`);
    ok(r.hidden.length === 0, `no-JS: nothing invisible ${JSON.stringify(r.hidden)}`);
    ok(!r.cls.includes('js-scroll'), `no-JS: sequences not armed ("${r.cls}")`);
    ok(r.hasHire, `no-JS: header CTA is in the markup`);
    // The un-armed state must be the finished state, not an empty one.
    ok(r.segs.every((w) => w > 0), `no-JS: share bar already full with zero scripting (${r.segs.map((w) => w.toFixed(0)).join(',')})`);
    ok(r.bandH > 100, `no-JS: photo band has height (${r.bandH}px)`);
    ok(r.railOverflow > 1440, `no-JS: journey rail is complete, not collapsed (${r.railOverflow}px)`);
    ok(r.words > 250, `no-JS: content intact (${r.words} words)`);
    await ctx.close();
  }

  /* ================= 3 · vendor files blocked ================= */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.route('**/js/vendor/**', (route) => route.abort());
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => ({
      cls: document.documentElement.className,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      segs: [...document.querySelectorAll('.share__seg')].map((s) => s.getBoundingClientRect().width),
      rail: getComputedStyle(document.querySelector('.journey__rail')).transform,
      linesIn: [...document.querySelectorAll('.line')].every((l) => l.classList.contains('is-in')),
    }));
    ok(!r.cls.includes('js-scroll'), `vendor-blocked: sequences not armed ("${r.cls}")`);
    ok(r.overflow <= 0, `vendor-blocked: no horizontal overflow (delta ${r.overflow})`);
    ok(r.segs.every((w) => w > 0), `vendor-blocked: share bar filled by default CSS`);
    ok(r.rail === 'none' || r.rail === 'matrix(1, 0, 0, 1, 0, 0)', `vendor-blocked: rail not offset (${r.rail})`);
    ok(r.linesIn, `vendor-blocked: hero name revealed anyway`);
    await ctx.close();
  }

  /* ================= 4 · prefers-reduced-motion ================= */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForTimeout(900);
    const r = await page.evaluate(() => ({
      cls: document.documentElement.className,
      triggers: window.ScrollTrigger ? window.ScrollTrigger.getAll().length : 0,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      boot: !!document.querySelector('.boot'),
      dock: getComputedStyle(document.querySelector('#dock')).opacity,
      segs: [...document.querySelectorAll('.share__seg')].map((s) => s.getBoundingClientRect().width),
      words: document.querySelector('main').innerText.trim().split(/\s+/).length,
    }));
    ok(!r.cls.includes('js-scroll'), `reduced-motion: sequences not armed ("${r.cls}")`);
    ok(r.triggers === 0, `reduced-motion: zero ScrollTriggers built (${r.triggers})`);
    ok(r.overflow <= 0, `reduced-motion: no horizontal overflow (delta ${r.overflow})`);
    ok(!r.boot, `reduced-motion: boot screen removed from the DOM`);
    ok(r.dock === '0', `reduced-motion: dock hidden`);
    ok(r.segs.every((w) => w > 0), `reduced-motion: share bar filled (${r.segs.map((w) => w.toFixed(0)).join(',')})`);
    ok(r.words > 250, `reduced-motion: content intact (${r.words} words)`);
    ok(errs.length === 0, `reduced-motion: zero page errors ${JSON.stringify(errs.slice(0, 2))}`);
    await ctx.close();
  }

  /* ================= 5 · interactions ================= */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    await page.keyboard.press('Control+k');
    await page.waitForTimeout(250);
    ok(await page.locator('#paletteList .prow').count() > 0, `palette: opens with rows`);
    await page.fill('#paletteInput', 'deep');
    await page.waitForTimeout(250);
    const first = await page.locator('#paletteList .prow .lb').first().textContent();
    ok(/deepguard/i.test(first || ''), `palette: fuzzy "deep" -> "${first?.trim()}"`);
    await page.fill('#paletteInput', 'toolkit');
    await page.waitForTimeout(250);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1900);
    const landed = await page.evaluate(() => Math.round(document.querySelector('#toolkit').getBoundingClientRect().top));
    ok(Math.abs(landed) < 240, `palette: Enter eased to #toolkit (offset ${landed}px)`);

    await page.click('.nav__links a[href="#work"]');
    await page.waitForTimeout(1900);
    const work = await page.evaluate(() => Math.round(document.querySelector('#work').getBoundingClientRect().top));
    ok(Math.abs(work) < 240, `anchors: nav -> #work (offset ${work}px)`);

    await page.evaluate(() => window.scrollTo(0, innerHeight * 3));
    await page.waitForTimeout(900);
    await page.click('#dockCopy');
    await page.waitForTimeout(400);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    ok(clip === 'arpitsingh8534@gmail.com', `dock: clipboard holds "${clip}"`);

    ok(errs.length === 0, `interactions: zero page errors ${JSON.stringify(errs.slice(0, 3))}`);
    await ctx.close();
  }

  /* ================= 6 · external links ================= */
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const hrefs = await page.evaluate(() =>
      [...new Set([...document.querySelectorAll('a[href^="http"]')].map((a) => a.href))]);
    const bad = [], blocked = [];
    for (const h of hrefs) {
      // LinkedIn hard-blocks non-browser clients (999). Assert the URL only.
      if (/linkedin\.com/.test(h)) { blocked.push(h); continue; }
      try {
        const res = await page.request.get(h, { timeout: 30000, maxRedirects: 5 });
        if (res.status() >= 400) bad.push(`${res.status()} ${h}`);
      } catch { bad.push(`ERR ${h}`); }
    }
    ok(bad.length === 0, `links: ${hrefs.length - blocked.length} checkable external links resolve ${JSON.stringify(bad)}`);
    await ctx.close();
  }

  await browser.close();

  console.log('\n================ PASS ================');
  pass.forEach((p) => console.log('  ✓ ' + p));
  if (fail.length) {
    console.log('\n================ FAIL ================');
    fail.forEach((f) => console.log('  ✗ ' + f));
  }
  console.log(`\n${pass.length} passed, ${fail.length} failed`);
  process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error('HARNESS CRASH', e); process.exit(2); });