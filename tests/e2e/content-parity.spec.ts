import { expect, test } from '@playwright/test';

import { waitForApp } from './helpers';

/**
 * Content parity.
 *
 * "Every stop field appears in all three renderers." The classic view is the
 * one that can be asserted without a canvas, so it carries the contract.
 */

const EXPECTED = [
  {
    title: 'MeshStream',
    claim: 'origin server stops carrying every byte',
    repo: 'https://github.com/Arp1tSingh/meshstream',
  },
  {
    title: 'CPU Path Tracer',
    claim: 'global illumination on the CPU alone',
    repo: 'https://github.com/Arp1tSingh/cpp-path-tracer',
  },
  {
    title: 'RegimeTrader',
    claim: 'no reliable edge',
    repo: 'https://github.com/Arp1tSingh/regimetrader',
  },
  {
    title: 'LeetCode Spaced Repetition Tracker',
    claim: 'paces the backlog',
    repo: 'https://github.com/Arp1tSingh/Leetcode-Practice-Tracker',
  },
  {
    title: 'BillBox',
    claim: 'Only the API writes',
    repo: 'https://github.com/Arp1tSingh/BillBox',
  },
  {
    title: 'DictateIt',
    claim: 'silent gap sized to what you have to write',
    repo: 'https://github.com/Arp1tSingh/dictateit',
  },
  {
    title: 'Fintech VIT 3D Vault',
    claim: 'ships every asset inside a budget',
    repo: 'https://github.com/Arp1tSingh/fintech-websiteV2',
  },
  {
    title: 'College Bus Route Planner',
    claim: 'three ways',
    repo: 'https://github.com/Arp1tSingh/Bus-Route-Planner-TSP',
  },
  {
    title: 'LeetCode Archive',
    claim: 'never drifts from what was actually submitted',
    repo: 'https://github.com/Arp1tSingh/LeetCode',
  },
];

test('the classic view carries every stop, its claim and its repository', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.keyboard.press('c');

  const classic = page.locator('.classic-view').first();
  await expect(classic).toBeVisible();

  for (const stop of EXPECTED) {
    await expect(classic.getByRole('heading', { name: stop.title, exact: true })).toBeVisible();
    await expect(classic).toContainText(stop.claim);
    await expect(classic.locator(`a[href="${stop.repo}"]`).first()).toBeAttached();
  }
});

test('the classic view has one h1 and a heading per stop', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.keyboard.press('c');

  const classic = page.locator('.classic-view').first();
  await expect(classic.locator('h1')).toHaveCount(1);
  await expect(classic.locator('article')).toHaveCount(12);
});

test('nothing in the shipped page is a placeholder', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.keyboard.press('c');

  const text = await page.locator('.classic-view').first().innerText();
  expect(text).not.toContain('TBD');
});
