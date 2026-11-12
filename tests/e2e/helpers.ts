import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Wait for the app to have booted.
 *
 * The inline script in `index.html` arms the page before React mounts, so
 * `js-armed` alone is not proof that the keyboard shortcuts and the journey
 * controller are listening. `__local3dBooted` is set by the app itself, once
 * it is alive.
 */
export async function waitForApp(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__local3dBooted === true, undefined, {
    timeout: 15_000,
  });
  await expect(page.locator('html')).toHaveClass(/js-armed/);

  // The first paint of the app can lag behind the flag while the scene chunk
  // and the WebGL context are set up, so wait for the interface itself
  // rather than for a class that is already there.
  await page.waitForSelector('.gate, .journey-view', {
    state: 'visible',
    timeout: 15_000,
  });
}

/** The site header, which is the one that carries the Hire me button. */
export function headerCta(page: Page) {
  return page.locator('.site-header a[href^="mailto:"]');
}

/**
 * Pick a station on the map with a real pointer.
 *
 * The map is an SVG inside a fixed overlay. Firefox will not scroll that
 * overlay for Playwright's synthetic scroll-into-view, so the overlay is
 * scrolled here by hand and the click is sent to the coordinates the browser
 * reports afterwards. That is the same route a visitor's mouse takes.
 */
export async function pickStation(page: Page, map: Locator, stopId: string): Promise<void> {
  const station = map.locator(`[data-stop="${stopId}"]`);

  await station.evaluate((element) => {
    const overlay = element.closest('.app__overlay');
    if (!overlay) return;
    const rect = element.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    overlay.scrollTop += rect.top - overlayRect.top - overlay.clientHeight / 2;
  });

  const box = await station.boundingBox();
  if (!box) throw new Error(`The map station ${stopId} has no box.`);

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
