import { expect, test } from '@playwright/test';

import { pickStation, waitForApp } from './helpers';

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

  // The header stays usable while the ticket is open, so this is a dialog,
  // not a modal.
  await expect(dialog).not.toHaveAttribute('aria-modal');

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

test('the map opens from the header while the ticket is open, and the ticket closes', async ({
  page,
}) => {
  await page.goto('/');
  await waitForApp(page);
  await page.getByRole('button', { name: /express/i }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // The header sits above the ticket on purpose: the visitor can leave the
  // line without closing the panel first.
  await page.getByRole('button', { name: /^map$/i }).click();

  await expect(page.getByRole('region', { name: /network map/i })).toBeVisible();
  await expect(dialog).toHaveCount(0);

  await page.getByRole('button', { name: /back to the line/i }).click();
  await expect(page.getByRole('region', { name: /network map/i })).toBeHidden();
});

test('the arrow keys scroll the ticket, and jump only when it is closed', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 600 });
  await page.goto('/');
  await waitForApp(page);
  await page.getByRole('button', { name: /express/i }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Dadar');
  // The panel takes the focus when it opens; the arrow key is the browser's
  // scroll only once that has happened.
  await expect(dialog).toBeFocused();

  const before = await dialog.evaluate((node) => node.scrollTop);
  await page.keyboard.press('ArrowDown');
  await expect
    .poll(() => dialog.evaluate((node) => node.scrollTop), { timeout: 5_000 })
    .toBeGreaterThan(before);

  // The station did not move: the arrow key read the ticket.
  await expect(dialog).toContainText('Dadar');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  // With the ticket out of the way, the shortcut is the journey's again.
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog')).toContainText('Kurla');
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

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^map$/i }).click();
  const map = page.getByRole('region', { name: /network map/i });
  await expect(map).toBeVisible();

  const stations = map.locator('svg [role="button"]');
  expect(await stations.count()).toBeGreaterThanOrEqual(12);
});

test('the map selects a station without moving the train', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.getByRole('button', { name: /express/i }).first().click();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /^map$/i }).click();
  const map = page.getByRole('region', { name: /network map/i });
  await expect(map).toBeVisible();

  await pickStation(page, map, 'slot-05');

  // The map stays; the card changes. Reading a station is not riding to it.
  await expect(map).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const card = map.locator('.map2d__detail');
  await expect(card).toContainText('BillBox');
  await expect(card).toContainText('Ride here');

  // The one action that moves the train is explicit.
  await card.getByRole('button', { name: /ride here/i }).click();
  await expect(map).toBeHidden();
  await expect(page.getByRole('dialog')).toContainText('BillBox');
});

test('keeping a ticket confirms it and counts it on the line', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.getByRole('button', { name: /express/i }).first().click();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /keep ticket/i }).click();

  await expect(dialog.getByRole('status')).toContainText('Saved for the terminus.');
  await expect(page.locator('.station-card__kept')).toContainText('1 ticket kept');
});

test('the terminus hands over to the wallet, not another ticket', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.getByRole('button', { name: /express/i }).first().click();
  await page.keyboard.press('Escape');

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

  const wallet = page.locator('.app__wallet');
  await expect(wallet).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(wallet).toContainText('You have reached the end of the line.');
  await expect(wallet.locator('a[href^="mailto:"]').first()).toBeVisible();
  await expect(wallet.getByRole('link', { name: /résumé/i })).toBeVisible();

  // The closing screen can start the ride again.
  await wallet.getByRole('button', { name: /^ride again$/i }).click();
  await expect(wallet).toBeHidden();
  await expect(page.getByRole('dialog')).toContainText('Dadar');
});

test('the header carries a résumé link', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);

  const resume = page.locator('.site-header a[href$="resume.pdf"]');
  await expect(resume).toBeVisible();
  await expect(resume).toHaveAttribute('download', '');
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 664 } });

  test('the view menu reaches the map and the back control returns', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);

    await page.getByRole('button', { name: /views/i }).click();
    // The sheet entry reads "Map by skill", not just "Map".
    await page.getByRole('button', { name: /^map\b/i }).click();

    await expect(page.getByRole('region', { name: /network map/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /back to the line/i })).toBeVisible();

    await page.getByRole('button', { name: /back to the line/i }).click();
    await expect(page.getByRole('region', { name: /network map/i })).toBeHidden();
    await expect(page.locator('.gate')).toBeVisible();
  });

  test('the skill filter is above the drawing, and a station opens a sheet', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);

    await page.getByRole('button', { name: /views/i }).click();
    await page.getByRole('button', { name: /^map\b/i }).click();

    const map = page.getByRole('region', { name: /network map/i });
    await expect(map).toBeVisible();

    const skills = await map.locator('.map2d__skills').boundingBox();
    const plot = await map.locator('.map2d__plot').boundingBox();
    expect(skills, 'the filter has a box').not.toBeNull();
    expect(plot, 'the plot has a box').not.toBeNull();
    expect(skills!.y + skills!.height).toBeLessThan(plot!.y);

    await pickStation(page, map, 'slot-01');
    const card = map.locator('.map2d__detail');
    await expect(card).toBeVisible();
    await expect(card).toContainText('MeshStream');
    await expect(card.getByRole('button', { name: /ride here/i })).toBeVisible();
  });
});
