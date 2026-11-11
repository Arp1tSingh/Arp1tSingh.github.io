import { expect, test } from '@playwright/test';

import { waitForApp } from './helpers';

/**
 * The 3D line.
 *
 * "Degrade by layers. WebGL falls back to a poster scene, then to the Classic
 * view, with identical content at every step."
 */

test('the scene renders on a canvas behind the journey', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.getByRole('button', { name: /express/i }).first().click();

  const canvas = page.locator('.scene3d__canvas canvas');
  await expect(canvas).toHaveCount(1);

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(600);
  expect(box!.height).toBeGreaterThan(400);
});

test('the scene does not swallow the clicks meant for the page', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.getByRole('button', { name: /express/i }).first().click();

  // The ticket opens on its own at the first station. Put it away so the
  // progress dots are the thing under the cursor.
  await page.keyboard.press('Escape');

  const dot = page.locator('.journey-view__dot').nth(2);
  await expect(dot).toBeVisible();
  await dot.click();
});

test('the pause control stops the scene rendering', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.getByRole('button', { name: /express/i }).first().click();

  const pause = page.locator('.site-header__pause');
  await expect(pause).toHaveAttribute('aria-pressed', 'false');
  await expect(pause).toHaveText(/pause/i);

  await pause.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'true');
  await expect(pause).toHaveText(/resume/i);

  await pause.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'false');
});

test.describe('without WebGL', () => {
  test.use({
    viewport: { width: 1280, height: 900 },
  });

  test.beforeEach(async ({ page }) => {
    // Take WebGL away before the page can use it.
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function patched(
        this: HTMLCanvasElement,
        type: string,
        ...rest: unknown[]
      ) {
        if (typeof type === 'string' && type.includes('webgl')) return null;
        return (original as (...args: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof HTMLCanvasElement.prototype.getContext;
    });
  });

  test('the poster scene takes over and the content is still there', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    await page.getByRole('button', { name: /express/i }).first().click();

    await expect(page.locator('.poster')).toHaveCount(1);
    await expect(page.locator('.scene3d__canvas canvas')).toHaveCount(0);

    // The journey still works: the ticket still opens at the first station.
    await expect(page.getByRole('dialog')).toContainText('Kurla');
  });

  test('the classic view still carries every stop', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    await page.keyboard.press('c');

    const classic = page.locator('.classic-view').first();
    await expect(classic).toBeVisible();
    await expect(classic.locator('article')).toHaveCount(12);
  });
});

test('the scene mirrors the line for a screen reader', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.getByRole('button', { name: /express/i }).first().click();

  const index = page.locator('.journey-view__index');
  await expect(index).toHaveCount(1);
  await expect(index.locator('li')).toHaveCount(8); // the Express line
  await expect(index.locator('a').first()).toHaveAttribute('href', '#slot-01');
});
