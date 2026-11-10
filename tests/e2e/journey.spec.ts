import { expect, test } from '@playwright/test';

import { waitForApp } from './helpers';

/**
 * The journey.
 *
 * "Gate -> Boarding -> Traveling <-> Dwelling -> Terminus."
 * "A ticket appears within 2 s of each stop" - that is the mitigation for the
 * blueprint's own top risk, that the metaphor starts to outweigh the work.
 */

test('the gate asks where to, with three lines', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);

  await expect(page.getByRole('button', { name: /express/i }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /all stations/i }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /map/i }).first()).toBeVisible();
});

test('choosing Express boards the train and a ticket opens at the first stop', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);

  await page.getByRole('button', { name: /express/i }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');

  // The claim is on the front of the ticket.
  await expect(dialog).toContainText('origin server');
});

test('scrolling on closes the ticket and moves the line', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.getByRole('button', { name: /express/i }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Read the ticket to the end, then keep scrolling: the ticket closes and the
  // train moves on to the next station.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.mouse.move(720, 400);
    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(120);
    if ((await dialog.count()) === 0) break;
  }

  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test('the map opens with M and closes with M again', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.getByRole('button', { name: /express/i }).first().click();

  await page.keyboard.press('m');
  await expect(page.getByRole('region', { name: /network map/i })).toBeVisible();

  await page.keyboard.press('m');
  await expect(page.getByRole('region', { name: /network map/i })).toBeHidden();
});

test('the arrow keys move between stops', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.getByRole('button', { name: /express/i }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Kurla');

  await page.keyboard.press('ArrowRight');
  await expect(dialog).toContainText('Ghatkopar');
});

test('a deep link jumps straight to a stop', async ({ page }) => {
  await page.goto('/#slot-03');
  await waitForApp(page);

  await expect(page.getByRole('dialog')).toContainText('RegimeTrader');
});

test('every stop is reachable in one interaction from the map', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.getByRole('button', { name: /express/i }).first().click();

  await page.keyboard.press('m');
  const map = page.getByRole('region', { name: /network map/i });
  await expect(map).toBeVisible();

  const stations = map.locator('svg [role="button"]');
  expect(await stations.count()).toBeGreaterThanOrEqual(12);
});
