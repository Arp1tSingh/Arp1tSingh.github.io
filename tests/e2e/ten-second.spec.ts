import { expect, test } from '@playwright/test';

import { headerCta, waitForApp } from './helpers';

/**
 * The ten-second contract.
 *
 * "Within ten seconds a visitor knows who you are, what you do and how to
 * reach you." Contact is the one thing a visitor must never have to hunt for,
 * so the header carries a `mailto:` on frame one, at every width, and the
 * address itself is on the first screen.
 */

const WIDTHS = [1280, 1440, 1920];
const EMAIL = 'arpitsingh8534@gmail.com';

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('the header carries a mailto in the first viewport', async ({ page }) => {
      await page.goto('/');
      await waitForApp(page);

      const cta = headerCta(page);
      await expect(cta).toHaveCount(1);
      await expect(cta).toHaveAttribute('href', `mailto:${EMAIL}`);

      const box = await cta.boundingBox();
      expect(box, 'the header CTA has a box').not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(900);
    });

    test('the first screen says who, what and how to reach', async ({ page }) => {
      await page.goto('/');
      await waitForApp(page);

      await expect(page.getByText('Arpit Singh').first()).toBeVisible();

      const mailto = page.locator(`.gate a[href="mailto:${EMAIL}"]`);
      await expect(mailto.first()).toBeVisible();

      const box = await mailto.first().boundingBox();
      expect(box, 'the address has a box').not.toBeNull();
      expect(box!.y + box!.height).toBeLessThanOrEqual(900);
    });

    test('nothing is clipped past the edge of the viewport', async ({ page }) => {
      await page.goto('/');
      await waitForApp(page);

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth - doc.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(1);
    });
  });
}
