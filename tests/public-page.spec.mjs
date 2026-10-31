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

// "Next up" card. The clock is pinned so the schedule is tested on known days.
const schedule = config => route => route.fulfill({ contentType: 'text/javascript', body: `window.NEXT_UP=${JSON.stringify(config)};` });
const at = (page, day) => page.clock.setFixedTime(new Date(`${day}T12:00:00`));

test('next up shows the shipped race with countdown and link', async ({ page }) => {
  await at(page, '2026-11-01');
  await page.goto('/');
  const card = page.locator('[data-next-up] .nu-card');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('href', 'https://runsignup.com/Race/PA/Pittsburgh/LastTrailStanding');
  await expect(card).toHaveAttribute('target', '_blank');
  await expect(card).toHaveAttribute('rel', /noopener/);
  await expect(card.locator('.nu-title')).toHaveText('Last Trail Standing');
  await expect(card.locator('.nu-date')).toHaveText('Sat · Nov 14, 2026');
  await expect(card.locator('.nu-date')).toHaveAttribute('datetime', '2026-11-14');
  await expect(card.locator('.nu-count')).toHaveText('13Days');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('next up shows on race day and the next race takes over the day after', async ({ page }) => {
  await at(page, '2026-11-14');
  await page.goto('/');
  await expect(page.locator('.nu-count')).toHaveText('Today');
  await at(page, '2026-11-15');
  await page.reload();
  await expect(page.locator('.nu-title')).toHaveText('Pittsburgh Marathon');
  await at(page, '2027-05-03');
  await page.reload();
  await expect(page.locator('.nu-title')).toHaveText('Rabid Raccoon 100');
  await at(page, '2027-06-06');
  await page.reload();
  await expect(page.locator('.nu-count')).toHaveText('Today');
});

test('every entry in the shipped schedule is valid', async ({ page }) => {
  await page.goto('/');
  const bad = await page.evaluate(() => window.NEXT_UP.items
    .filter(item => !window.NextUpCard.normalize({ ...item, off: false }))
    .map(item => item.title || '(no title)'));
  expect(bad).toEqual([]);
});

test('next up hides with no gap when nothing is live', async ({ page }) => {
  await page.route('**/next-up/schedule.js*', schedule({ enabled: true, items: [{ title: 'Past', date: '2026-01-01' }] }));
  await page.goto('/');
  await expect(page.locator('[data-next-up]')).toBeHidden();
  expect(await page.locator('[data-next-up]').boundingBox()).toBeNull();
  await expect(page.getByRole('link', { name: /YouTube/ })).toBeVisible();
});

test('next up hands off to the next scheduled entry', async ({ page }) => {
  await page.route('**/next-up/schedule.js*', schedule({ enabled: true, items: [
    { title: 'Later race', date: '2027-06-05', showFrom: '2026-12-01', link: 'https://example.com/later' },
    { title: 'First race', date: '2026-11-14', showUntil: '2026-11-16' },
    { title: 'Standing challenge', description: 'No date on this one.' },
  ] }));
  await at(page, '2026-11-16');
  await page.goto('/');
  await expect(page.locator('.nu-title')).toHaveText('First race');
  await expect(page.locator('div.nu-card')).toBeVisible();            // no link -> plain card
  await at(page, '2026-11-20');
  await page.reload();
  await expect(page.locator('.nu-title')).toHaveText('Standing challenge');
  await expect(page.locator('.nu-date')).toHaveCount(0);
  await expect(page.locator('.nu-count')).toHaveCount(0);
  await at(page, '2026-12-01');
  await page.reload();
  await expect(page.locator('.nu-title')).toHaveText('Later race');
  await expect(page.locator('a.nu-card')).toHaveAttribute('href', 'https://example.com/later');
});

test('next up skips unsafe or broken entries and renders text literally', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/next-up/schedule.js*', schedule({ enabled: true, items: [
    { title: 'Bad link', link: 'javascript:alert(1)' },
    { title: 'Bad date', date: '2026-13-40' },
    { title: 'Paused', off: true },
    { title: '<img src=x onerror=alert(1)> ' + 'Supercalifragilisticexpialidocious'.repeat(3), label: '<b>Label</b>' },
  ] }));
  await at(page, '2026-11-01');
  await page.goto('/');
  await expect(page.locator('.nu-card')).toHaveCount(1);
  await expect(page.locator('.nu-title')).toContainText('<img src=x');
  await expect(page.locator('.nu-label')).toHaveText('<b>Label</b>');
  await expect(page.locator('.nu-card img, .nu-card b:not(.nu-count b)')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
});

test('next up stays hidden when switched off', async ({ page }) => {
  await page.route('**/next-up/schedule.js*', schedule({ enabled: false, items: [{ title: 'Hidden' }] }));
  await page.goto('/');
  await expect(page.locator('[data-next-up]')).toBeHidden();
  await expect(page.locator('.nu-card')).toHaveCount(0);
});
