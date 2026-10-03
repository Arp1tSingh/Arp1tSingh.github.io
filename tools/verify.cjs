/* Verification harness for arp1tsingh.github.io
   Run: node tools/verify.cjs [baseUrl]
   Defaults to http://127.0.0.1:8000 */

const { chromium } = require('playwright');

const BASE = process.argv[2] || "http://127.0.0.1:8000";
const WIDTHS = [360, 390, 768, 1024, 1280, 1440, 1920];

const fail = [];
const pass = [];
const ok = (cond, msg) => (cond ? pass : fail).push(msg);

(async () => {
  const browser = await chromium.launch();

  /* ---------------- 1. standard sweep ---------------- */
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width, height: width < 500 ? 780 : 900 },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    const errors = [];
    const failed = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('requestfailed', (r) => failed.push(`${r.url()} ${r.failure()?.errorText}`));

    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2600); // boot screen + fonts

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(overflow <= 0, `${width}px: no horizontal overflow (delta ${overflow})`);
    ok(errors.length === 0, `${width}px: zero console errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
    ok(failed.length === 0, `${width}px: zero failed requests ${failed.length ? JSON.stringify(failed.slice(0, 3)) : ''}`);

    /* sequences armed */
    const armed = await page.evaluate(() => document.documentElement.classList.contains('js-scroll'));
    ok(armed, `${width}px: sequences armed (js-scroll present)`);

    /* word count */
    const words = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main.innerText.trim().split(/\s+/).filter(Boolean).length;
    });
    ok(words <= 560, `${width}px: <main> word count ${words} <= 560`);

    /* the ten-second rule: contact reachable with zero scrolling */
    const contact = await page.evaluate(() => {
      const vh = window.innerHeight;
      const seen = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.top < vh && r.bottom > 0 && r.width > 0 && r.height > 0 &&
               getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).opacity !== '0';
      };
      return {
        navHire: seen('.nav__hire'),
        heroEmail: seen('.hero__actions .btn--solid'),
        navHireHref: document.querySelector('.nav__hire')?.getAttribute('href'),
        heroEmailHref: document.querySelector('.hero__actions .btn--solid')?.getAttribute('href'),
      };
    });
    ok(contact.navHire, `${width}px: header "Hire me" visible in first viewport`);
    ok(contact.heroEmail, `${width}px: hero Email button visible in first viewport`);
    ok(/^mailto:/.test(contact.navHireHref || ''), `${width}px: header CTA is a mailto`);
    ok(/^mailto:/.test(contact.heroEmailHref || ''), `${width}px: hero CTA is a mailto`);

    /* `html{overflow-x:clip}` hides real layout overflow from a document-width
       check, so measure the boxes themselves. Anything sticking out past the
       right edge is being clipped away from the visitor.
       An element inside a scroll/clip container is legitimately off-screen —
       that is what a horizontal rail is — so those are skipped. */
    const bleed = await page.evaluate(() => {
      const clipped = (el) => {
        for (let p = el.parentElement; p; p = p.parentElement) {
          if (p === document.body) return false;
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
        if (r.width === 0 || r.height === 0) return;
        if (r.right > vw + 1 || r.left < -1) {
          out.push(`${el.tagName}.${(el.className || '').toString().split(' ')[0]} [${Math.round(r.left)},${Math.round(r.right)}]`);
        }
      });
      return [...new Set(out)].slice(0, 6);
    });
    ok(bleed.length === 0, `${width}px: nothing clipped past the viewport edge ${JSON.stringify(bleed)}`);

    /* An unpinned section must hug its content. Reserving scroll distance for
       a pin that was never created leaves a tall empty hole in the page, and it
       is invisible to both a document-height check and a horizontal-overflow
       check. */
    const slack = await page.evaluate(() =>
      [...document.querySelectorAll('.pin')].map((el) => {
        const vp = el.querySelector('.pin__vp');
        const cs = getComputedStyle(vp);
        const content = [...vp.children]
          .filter((k) => !k.classList.contains('hero__bg') && !k.classList.contains('hero__scrim'))
          .reduce((sum, k) => sum + k.getBoundingClientRect().height, 0);
        const needed = content + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
        return {
          id: el.id || el.className.split(' ')[0],
          static: el.classList.contains('is-static'),
          slack: Math.round(el.getBoundingClientRect().height - needed),
        };
      }).filter((x) => x.static && x.slack > 120));
    ok(slack.length === 0, `${width}px: no unpinned section reserving empty space ${JSON.stringify(slack)}`);

    /* dock is hidden while the hero is on screen */
    const dockHidden = await page.evaluate(() => {
      const d = document.querySelector('#dock');
      return d ? !d.classList.contains('on') : false;
    });
    ok(dockHidden, `${width}px: dock hidden while hero is in view`);

    /* calendar populated */
    if (width >= 1024) {
      const cal = await page.evaluate(() => ({
        cells: document.querySelectorAll('#calGrid .cal__cell').length,
        lit: document.querySelectorAll('#calGrid .cal__cell:not([data-l="0"])').length,
        months: [...document.querySelectorAll('#calMonths span')].map((s) => s.textContent).filter(Boolean),
        total: document.querySelector('#cTotal')?.textContent,
        days: document.querySelector('#cDays')?.textContent,
        first: document.querySelector('#cFirst')?.textContent,
      }));
      ok(cal.cells > 300 && cal.lit === 59, `${width}px: calendar ${cal.cells} cells, ${cal.lit} lit`);
      ok(cal.total === '248' && cal.days === '59', `${width}px: calendar totals ${cal.total}/${cal.days}`);
      ok(cal.first === 'Oct 2025', `${width}px: first commit label "${cal.first}"`);
      ok(cal.months.length >= 10, `${width}px: month labels present (${cal.months.join(',')})`);
    }

    /* scrub each pinned sequence and confirm it actually moves */
    if (width >= 1024) {
      const expectPins = width > 1080;
      const scrub = await page.evaluate(async () => {
        const out = {};
        const dist = (s) => document.querySelector(s)?.scrollHeight || 0;
        const st = window.ScrollTrigger;
        if (!st) return { error: 'no ScrollTrigger global' };

        // Two Lenis complications the probe has to respect:
        //  1. Lenis is mid-tween when the probe starts, and it will win over a
        //     window.scrollTo until its own tween is idle. So poll until the
        //     real scroll position matches the request.
        //  2. `scrub: 1` eases toward the target over roughly a second, so
        //     reading a transform in the same tick as the scroll just reads the
        //     old value.
        const settle = () => new Promise((r) => setTimeout(r, 1300));
        const goto = async (y) => {
          for (let i = 0; i < 12; i++) {
            window.scrollTo(0, y);
            st.update();
            await new Promise((r) => setTimeout(r, 120));
            if (Math.abs(window.scrollY - y) < 2) break;
          }
          await settle();
          st.update();
        };
        const probe = async (sel, read) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const t = st.getAll().find((x) => x.trigger?.contains(el) || x.trigger === el);
          if (!t) return null;
          await goto(t.start);
          const before = read(); const pr1 = +t.progress.toFixed(3); const y1 = Math.round(window.scrollY);
          await goto(t.start + (t.end - t.start) * 0.5);
          const after = read();  const pr2 = +t.progress.toFixed(3); const y2 = Math.round(window.scrollY);
          await goto(0);
          return { trig: t.trigger.id, start: Math.round(t.start), end: Math.round(t.end),
                   y1, pr1, before, y2, pr2, after, pin: !!t.pin };
        };

        out.hero = await probe('.hero__inner', () => getComputedStyle(document.querySelector('.hero__name')).transform);
        out.bars = await probe('.bar__fill', () => getComputedStyle(document.querySelector('.bar__fill')).transform);
        out.rail = await probe('[data-rail-track]', () => getComputedStyle(document.querySelector('[data-rail-track]')).transform);
        out.spine = await probe('#tlFill', () => getComputedStyle(document.querySelector('#tlFill')).height);
        out.count = st.getAll().length;
        out.staticCount = document.querySelectorAll('[data-seq].is-static').length;
        out.pageHeight = dist('body');
        return out;
      });

      if (scrub.error) fail.push(`scrub probe failed: ${scrub.error}`);
      else {
        ok(scrub.count >= 4, `${width}px: ${scrub.count} ScrollTriggers registered`);
        const moved = (r) => r && r.value !== r.before;
        const ranged = (r) => r && r.pin && r.end > r.start;
        const label = (r) => r
          ? `${r.trig} [${r.y1}->${r.y2}] ${r.before} => ${r.after}`
          : 'no trigger';
        const pinOf = (r) => (r ? !!r.pin : false);

        /* The hero always pins: it is one screen of content at every width. */
        ok(moved(scrub.hero) && scrub.hero.pin, `${width}px: hero type moves on scrub (${label(scrub.hero)})`);

        if (expectPins) {
          /* Wide enough to pin, so a scrub range must exist AND move. */
          ok(ranged(scrub.bars) && moved(scrub.bars), `${width}px: skill bars scrub (${label(scrub.bars)})`);
          ok(ranged(scrub.rail) && moved(scrub.rail), `${width}px: work rail scrubs (${label(scrub.rail)})`);
          ok(ranged(scrub.spine) && moved(scrub.spine) && parseFloat(scrub.spine.after) > 0,
             `${width}px: timeline spine scrubs (${label(scrub.spine)})`);
          ok(scrub.staticCount === 0, `${width}px: no section left static (${scrub.staticCount})`);
        } else {
          /* Stacked: the sections must NOT be pinned, because a pin with no
             scroll range freezes its timeline at progress 1 and reads as a
             broken scrub. They must already show their finished values. */
          const statics = await page.evaluate(() =>
            [...document.querySelectorAll('[data-seq]')].map((s) => ({
              id: s.dataset.seq, static: s.classList.contains('is-static'),
              h: Math.round(s.getBoundingClientRect().height),
            })));
          // about / toolkit / journey go static at <=1080 because they stack.
          // work only goes static at <=860, so at 1024 the rail is still pinned.
          const railPins = width > 860;
          const expected = { about: true, toolkit: true, journey: true, work: !railPins };
          const actual = Object.fromEntries(statics.map((s) => [s.id, s.static]));
          // Compare per key: JSON.stringify preserves insertion order, and the
          // DOM order is not the order the expectation is written in.
          const wrong = Object.keys(expected).filter((k) => actual[k] !== expected[k]);
          ok(wrong.length === 0,
             `${width}px: is-static set correctly (${JSON.stringify(actual)}, wanted ${JSON.stringify(expected)}, wrong: ${wrong})`);
          ok(!pinOf(scrub.bars) && !pinOf(scrub.spine),
             `${width}px: stacked sections are not pinned (bars=${pinOf(scrub.bars)} journey=${pinOf(scrub.spine)})`);
          ok(pinOf(scrub.rail) === railPins,
             `${width}px: work rail pin matches the 860px rule (pinned=${pinOf(scrub.rail)}, wanted ${railPins})`);
          if (railPins) ok(ranged(scrub.rail) && moved(scrub.rail), `${width}px: work rail scrubs (${label(scrub.rail)})`);
          const barW = await page.evaluate(() => document.querySelector('.bar__fill').getBoundingClientRect().width);
          const spineH = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#tlFill')).height));
          ok(barW > 0, `${width}px: stacked skill bar shows its value (${barW.toFixed(1)}px)`);
          ok(spineH > 0, `${width}px: stacked timeline spine is painted (${spineH}px)`);
          const railX = await page.evaluate(() => getComputedStyle(document.querySelector('[data-rail-track]')).transform);
          ok(railX === 'none' || railX === 'matrix(1, 0, 0, 1, 0, 0)', `${width}px: stacked rail is not offset (${railX})`);
        }
      }

      /* dock appears after the hero and hides over the contact outro */
      const dockFlow = await page.evaluate(async () => {
        const st = window.ScrollTrigger;
        const dock = document.querySelector('#dock');
        const contact = document.querySelector('[data-seq="contact"]');
        const yMid = (sel) => document.querySelector(sel).getBoundingClientRect().top + window.scrollY;
        window.scrollTo(0, window.innerHeight * 2);
        st.update();
        const mid = dock.classList.contains('on');
        window.scrollTo(0, yMid('#contact') - 20);
        st.update();
        const outro = dock.classList.contains('on');
        window.scrollTo(0, 0);
        st.update();
        return { mid, outro, top: dock.classList.contains('on'), contactTop: yMid('#contact') };
      });
      ok(dockFlow.mid === true, `${width}px: dock on mid-page (${dockFlow.mid})`);
      ok(dockFlow.outro === false, `${width}px: dock off over the contact outro (${dockFlow.outro})`);
      ok(dockFlow.top === false, `${width}px: dock off at the top (${dockFlow.top})`);
    }

    await ctx.close();
  }

  /* ---------------- 2. no JavaScript ---------------- */
  {
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'load' });

    const r = await page.evaluate(() => {
      const hidden = [];
      document.querySelectorAll('main *').forEach((el) => {
        const cs = getComputedStyle(el);
        if (parseFloat(cs.opacity) === 0 && el.textContent.trim()) hidden.push(el.className || el.tagName);
      });
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        hidden: hidden.slice(0, 5),
        hasJsClass: document.documentElement.className,
        hasBoot: !!document.querySelector('.boot'),
        hasHire: !!document.querySelector('.nav__hire'),
        dockOpacity: getComputedStyle(document.querySelector('#dock')).opacity,
        bars: [...document.querySelectorAll('.bar__fill')].map((b) => b.getBoundingClientRect().width),
      };
    });

    ok(r.overflow <= 0, `no-JS: no horizontal overflow (delta ${r.overflow})`);
    ok(r.hidden.length === 0, `no-JS: nothing invisible ${JSON.stringify(r.hidden)}`);
    ok(!r.hasJsClass.includes('js-scroll'), `no-JS: js-scroll absent ("${r.hasJsClass}")`);
    ok(r.hasBoot, `no-JS: boot overlay present but page content is behind it and readable`);
    ok(r.hasHire, `no-JS: header "Hire me" is in the markup`);
    ok(parseFloat(r.dockOpacity) === 0, `no-JS: dock hidden (opacity ${r.dockOpacity})`);
    ok(r.bars.every((w) => w > 0), `no-JS: skill bars already at full width with zero scripting (${r.bars.map((w) => w.toFixed(0)).join(',')})`);

    /* and with JS but the vendor files blocked */
    const ctx2 = await browser.newContext({ javaScriptEnabled: true, viewport: { width: 1280, height: 900 } });
    const p2 = await ctx2.newPage();
    await p2.route('**/js/vendor/**', (route) => route.abort());
    const errs = [];
    p2.on('pageerror', (e) => errs.push(String(e)));
    await p2.goto(BASE, { waitUntil: 'load' });
    await p2.waitForTimeout(1200);
    const r2 = await p2.evaluate(() => ({
      cls: document.documentElement.className,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      railX: getComputedStyle(document.querySelector('[data-rail-track]')).transform,
      barW: document.querySelector('.bar__fill').getBoundingClientRect().width,
      tlFill: getComputedStyle(document.querySelector('#tlFill')).height,
      tlLit: getComputedStyle(document.querySelector('.tl__dot')).borderTopColor,
      tlFill: getComputedStyle(document.querySelector('#tlFill')).height,
    }));
    ok(!r2.cls.includes('js-scroll'), `vendor-blocked: js-scroll absent ("${r2.cls}")`);
    ok(r2.overflow <= 0, `vendor-blocked: no horizontal overflow (delta ${r2.overflow})`);
    ok(r2.railX === 'none', `vendor-blocked: rail not transformed (${r2.railX})`);
    ok(r2.barW > 0, `vendor-blocked: skill bar filled statically (${r2.barW.toFixed(1)}px)`);
    ok(parseFloat(r2.tlFill) > 0, `vendor-blocked: timeline spine painted statically (${r2.tlFill})`);
    ok(/255, 90, 31/.test(r2.tlLit), `vendor-blocked: timeline dots lit by default CSS (${r2.tlLit})`);
    await ctx2.close();
    await ctx.close();
  }

  /* ---------------- 3. prefers-reduced-motion ---------------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => ({
      cls: document.documentElement.className,
      lenis: typeof window.Lenis,
      triggers: window.ScrollTrigger ? window.ScrollTrigger.getAll().length : 0,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      boot: !!document.querySelector('.boot'),
      dockOpacity: getComputedStyle(document.querySelector('#dock')).opacity,
      heroChOpacity: getComputedStyle(document.querySelector('.hero__name .ch')).opacity,
      counter: document.querySelector('[data-count]').textContent,
      barW: document.querySelector('.bar__fill').getBoundingClientRect().width,
      tlFill: getComputedStyle(document.querySelector('#tlFill')).height,
    }));
    ok(!r.cls.includes('js-scroll'), `reduced-motion: sequences not armed ("${r.cls}")`);
    ok(r.triggers === 0, `reduced-motion: zero ScrollTriggers built (${r.triggers})`);
    ok(r.overflow <= 0, `reduced-motion: no horizontal overflow (delta ${r.overflow})`);
    ok(!r.boot, `reduced-motion: boot screen removed from the DOM`);
    ok(r.dockOpacity === '0', `reduced-motion: dock hidden`);
    ok(r.heroChOpacity === '1', `reduced-motion: hero name fully visible`);
    ok(r.counter === '248', `reduced-motion: counters rendered statically (${r.counter})`);
    ok(r.barW > 0, `reduced-motion: skill bar filled (${r.barW.toFixed(1)}px)`);
    ok(parseFloat(r.tlFill) > 0, `reduced-motion: timeline spine painted (${r.tlFill})`);
    ok(errs.length === 0, `reduced-motion: zero page errors ${JSON.stringify(errs.slice(0, 3))}`);
    await ctx.close();
  }

  /* ---------------- 4. palette, anchors, clipboard ---------------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2600);

    await page.keyboard.press('Control+k');
    await page.waitForTimeout(250);
    const openRows = await page.locator('#paletteList .prow').count();
    ok(openRows > 0, `palette: opens with ${openRows} rows`);

    /* Project rows carry an external href, so test the fuzzy match there... */
    await page.fill('#paletteInput', 'deep');
    await page.waitForTimeout(250);
    const first = await page.locator('#paletteList .prow .lb').first().textContent();
    ok(/deepguard/i.test(first || ''), `palette: fuzzy "deep" -> "${first?.trim()}"`);

    /* ...and test in-page navigation with a section, which is what proves
       scrollTo is wired through Lenis rather than a raw scrollIntoView. */
    await page.fill('#paletteInput', 'toolkit');
    await page.waitForTimeout(250);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1800);
    const landed = await page.evaluate(() => ({
      top: Math.round(document.querySelector('#toolkit').getBoundingClientRect().top),
      hidden: document.querySelector('#palette').hidden,
    }));
    ok(Math.abs(landed.top) < 220, `palette: Enter eased to #toolkit (offset ${landed.top}px)`);
    ok(landed.hidden, `palette: closed after Enter`);

    await page.click('.nav__links a[href="#toolkit"]');
    await page.waitForTimeout(1600);
    const tk = await page.evaluate(() => Math.round(document.querySelector('#toolkit').getBoundingClientRect().top));
    ok(Math.abs(tk) < 220, `anchors: nav -> #toolkit (offset ${tk}px)`);

    /* scroll past the hero, then copy from the dock */
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2.5));
    await page.waitForTimeout(700);
    ok(await page.evaluate(() => document.querySelector('#dock').classList.contains('on')), `dock: visible after the hero`);
    await page.click('#dockCopy');
    await page.waitForTimeout(400);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    ok(clip === 'arpitsingh8534@gmail.com', `dock: clipboard holds "${clip}"`);
    ok(await page.evaluate(() => document.querySelector('.dock__mail span').textContent === 'Email copied'), `dock: copy confirmation shown`);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await page.click('#copyHandle').catch(() => {});
    ok(errs.length === 0, `interactions: zero page errors ${JSON.stringify(errs.slice(0, 3))}`);
    await ctx.close();
  }

  /* ---------------- 5. link inventory ---------------- */
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const hrefs = await page.evaluate(() =>
      [...new Set([...document.querySelectorAll('a[href^="http"]')].map((a) => a.href))]);
    let bad = [];
    let blocked = [];
    for (const h of hrefs) {
      // LinkedIn hard-blocks non-browser clients (999), so it cannot be
      // verified automatically. Assert the URL only.
      if (/linkedin\.com/.test(h)) { blocked.push(h); continue; }
      try {
        // GET, not HEAD: Render's free tier answers 501 to a HEAD.
        const res = await page.request.get(h, { timeout: 30000, maxRedirects: 5 });
        if (res.status() >= 400) bad.push(`${res.status()} ${h}`);
      } catch (e) { bad.push(`ERR ${h}`); }
    }
    ok(bad.length === 0, `links: ${hrefs.length - blocked.length} checkable external links resolve ${JSON.stringify(bad)}`);
    ok(blocked.length === 1 && /linkedin\.com\/in\/rpitsingh$/.test(blocked[0]), `links: ${blocked.length} unverifiable-by-bot URL recorded (${blocked.join(', ')})`);
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