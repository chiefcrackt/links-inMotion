import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Keep checks deterministic and prevent requests to external services.
  await page.route('https://**/*', route => route.abort());
});

test('social destinations and sharing image remain valid', async ({ page, request }) => {
  await page.goto('/');
  const destinations = [
    ['YouTube', 'https://www.youtube.com/@tristan.inmotion'],
    ['Instagram', 'https://www.instagram.com/tristan.inmotion/'],
    ['TikTok', 'https://www.tiktok.com/@tristan.inmotion'],
    ['Facebook', 'https://www.facebook.com/share/1CPjZXfsof/'],
    ['Strava', 'https://www.strava.com/athletes/136190678'],
  ];
  for (const [name, href] of destinations) {
    const link = page.getByRole('link', { name: new RegExp(name) });
    await expect(link).toHaveAttribute('href', href);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  }
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://in-motion.run/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://in-motion.run/og-links.png');
  const image = await request.get('/og-links.png');
  expect(image.ok()).toBeTruthy();
  expect(image.headers()['content-type']).toContain('image/png');
  expect((await image.body()).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
});

test('runner, Hooper, game and sound controls work', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const hooper = page.getByRole('button', { name: 'Bring Hooper along' });
  await hooper.click();
  await expect(hooper).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Make him jump' }).click();
  await page.getByRole('button', { name: 'Play the trail game' }).click();
  await expect(page.locator('.ghud')).toBeVisible();
  await expect(hooper).toBeHidden();
  await page.getByRole('button', { name: 'Stop the trail game' }).click();
  await expect(page.locator('.hm')).toHaveText('Run ended.');
  await expect(page.getByRole('button', { name: 'Play the trail game' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.getByRole('button', { name: 'Turn background music on' }).click();
  await expect(page.locator('#snd')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Turn background music off' }).click();
  await expect(page.locator('#snd')).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});

test('gear outage leaves social links and game available', async ({ page }) => {
  await page.route('**/api/products', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('/');
  await expect(page.locator('[data-gear]')).toBeHidden();
  await expect(page.getByRole('link', { name: /YouTube/ })).toBeVisible();
  await page.getByRole('button', { name: 'Play the trail game' }).click();
  await expect(page.getByRole('button', { name: 'Stop the trail game' })).toBeVisible();
});

test('published gear renders and opens the configured product', async ({ page }) => {
  await page.route('**/api/products', route => route.fulfill({ json: { products: [
    { name: 'Test headlamp', brand: 'Test brand', note: 'Night runs', url: 'https://example.com/headlamp' },
  ] } }));
  await page.goto('/');
  await expect(page.locator('[data-gear]')).toBeVisible();
  await expect(page.locator('.gear-card')).toHaveAttribute('href', 'https://example.com/headlamp');
  await expect(page.locator('.gear-card')).toContainText('Night runs');
});
