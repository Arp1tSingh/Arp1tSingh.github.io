import { expect, type Page } from '@playwright/test';

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
