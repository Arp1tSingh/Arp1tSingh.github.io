import { expect, test } from '@playwright/test';

import { waitForApp } from './helpers';

/**
 * The fallback needs no JavaScript.
 *
 * "Tier 4 Plain: No JavaScript - Classic view rendered to static HTML at build
 * time." The page must be complete and readable with zero scripting, and the
 * same content must be reachable in the app.
 */

const STOPS = [
  'MeshStream',
  'CPU Path Tracer',
  'RegimeTrader',
  'LeetCode Spaced Repetition Tracker',
  'BillBox',
  'DictateIt',
  'Fintech VIT 3D Vault',
  'College Bus Route Planner',
  'LeetCode Archive',
  'Technical Portfolio Lead, Fintech VIT',
  'About',
  'Terminus',
];

test.describe('with JavaScript disabled', () => {
  test.use({ javaScriptEnabled: false });

  test('every stop is on the page', async ({ page }) => {
    await page.goto('/');

    for (const title of STOPS) {
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    }
  });

  test('the address is a working mailto', async ({ page }) => {
    await page.goto('/');
    const mailto = page.locator('a[href^="mailto:"]').first();
    await expect(mailto).toBeVisible();
    await expect(mailto).toHaveAttribute('href', 'mailto:arpitsingh8534@gmail.com');
  });

  test('every stop is reachable from the index in one click', async ({ page }) => {
    await page.goto('/');

    const links = page.locator('a[href^="#"]');
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(STOPS.length);

    for (const id of ['slot-01', 'slot-05', 'badlapur']) {
      await expect(page.locator(`a[href="#${id}"]`).first()).toBeAttached();
    }
  });

  test('the repository links are real', async ({ page }) => {
    await page.goto('/');
    const repo = page.locator('a[href="https://github.com/Arp1tSingh/meshstream"]');
    await expect(repo.first()).toBeAttached();
  });
});

test.describe('with JavaScript enabled', () => {
  test('the classic view is behind the app until it is asked for', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    await expect(page.locator('html')).toHaveClass(/js-armed/);

    const classic = page.locator('.classic-view').first();
    await expect(classic).toBeHidden();

    await page.keyboard.press('c');
    await expect(classic).toBeVisible();

    await page.keyboard.press('c');
    await expect(classic).toBeHidden();
  });

  test('the app does not print a console error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');
    await waitForApp(page);
    await page.waitForTimeout(1200);

    expect(errors, errors.join('\n')).toHaveLength(0);
  });
});
