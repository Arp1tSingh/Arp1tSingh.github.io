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

  // The claim is on the front of the ticket. Dadar is the first stop now.
  await expect(dialog).toContainText('starts being something you can break');

  // The wallet action and the repository live in the actions row, with no
  // sticky stub covering the proof.
  await expect(dialog.getByRole('button', { name: /keep ticket/i })).toBeVisible();
  await expect(dialog.getByRole('link', { name: /repository/i })).toBeVisible();
});

test('scrolling on closes the ticket and moves the line', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.getByRole('button', { name: /express/i }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Dadar');

  // Scroll, and the line moves under the visitor. The ticket at the first
  // station gives way to the ticket at the next one.
  //
  // The wheel goes over the scene, on the left of the ticket: over the ticket
  // itself the wheel reads the proof, which is what it is for.
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  await page.mouse.move(200, 300);
  await page.mouse.wheel(0, viewport!.height * 1.2);

  await expect
    .poll(async () => page.evaluate(() => window.scrollY), { timeout: 15_000 })
    .toBeGreaterThan(viewport!.height);
  await expect(dialog).toContainText('Kurla');
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
  await expect(dialog).toContainText('Dadar');

  await page.keyboard.press('ArrowRight');
  await expect(dialog).toContainText('Kurla');
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
