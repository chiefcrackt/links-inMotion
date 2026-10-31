import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// A fake GitHub that holds the repo's real data files in memory.
function fakeGitHub(page, { push = true, conflictOnce = false } = {}) {
  const files = new Map(['gear/products.json', 'next-up/schedule.json'].map(path => [path, { text: readFileSync(path, 'utf8'), sha: 'sha-0' }]));
  const puts = [];
  let version = 0, conflict = conflictOnce;
  page.route('https://api.github.com/**', async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.headers().authorization !== 'Bearer good-key') return route.fulfill({ status: 401, json: { message: 'Bad credentials' } });
    if (url.pathname === '/repos/chiefcrackt/links-inMotion') return route.fulfill({ json: { permissions: { push } } });
    const path = decodeURIComponent(url.pathname.replace('/repos/chiefcrackt/links-inMotion/contents/', ''));
    if (request.method() === 'GET') {
      const file = files.get(path);
      if (!file) return route.fulfill({ status: 404, json: { message: 'Not Found' } });
      return route.fulfill({ json: { sha: file.sha, content: Buffer.from(file.text).toString('base64') } });
    }
    const body = request.postDataJSON();
    const current = files.get(path);
    if (conflict || (current && body.sha !== current.sha)) {
      conflict = false; if (current) current.sha = 'sha-other';
      return route.fulfill({ status: 409, json: { message: 'does not match' } });
    }
    const sha = 'sha-' + (++version), bytes = Buffer.from(body.content, 'base64');
    files.set(path, { text: bytes.toString('utf8'), sha });
    puts.push({ path, message: body.message, branch: body.branch, bytes });
    return route.fulfill({ status: 200, json: { content: { sha } } });
  });
  return { files, puts, json: path => JSON.parse(files.get(path).text) };
}
async function signIn(page) {
  await page.goto('/admin/');
  await page.getByLabel('GitHub access key').fill('good-key');
  await page.getByRole('button', { name: 'Sign in →' }).click();
  await expect(page.locator('#workspace')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  await page.clock.setFixedTime(new Date('2026-11-01T12:00:00'));
});

test('rejects a bad key and a read-only key', async ({ page }) => {
  fakeGitHub(page, { push: false });
  await page.goto('/admin/');
  await page.getByLabel('GitHub access key').fill('wrong');
  await page.getByRole('button', { name: 'Sign in →' }).click();
  await expect(page.locator('#notice')).toContainText('didn\'t accept that key');
  await page.getByLabel('GitHub access key').fill('good-key');
  await page.getByRole('button', { name: 'Sign in →' }).click();
  await expect(page.locator('#notice')).toContainText('can\'t edit links-inMotion');
  await expect(page.locator('#workspace')).toBeHidden();
});

test('next up: lists races with status, adds and turns on a race', async ({ page }) => {
  const gh = fakeGitHub(page);
  await signIn(page);
  await expect(page.locator('#nu-now')).toContainText('Showing now: Last Trail Standing');
  const row = name => page.locator('#nu-list li').filter({ hasText: name });
  await expect(row('Last Trail Standing').locator('.pill')).toHaveText('Showing now');
  await expect(row('Pittsburgh Marathon').locator('.pill')).toHaveText('Queued');
  await expect(row('Pain in Moraine').locator('.pill')).toHaveText('Off');

  await page.getByRole('button', { name: '+ Add' }).first().click();
  await page.getByLabel('Title', { exact: true }).fill('Turkey Trot');
  await page.getByLabel(/^Label/).fill('Race · 5K');
  await page.getByLabel('Race date').fill('2026-11-26');
  await page.getByLabel(/^Link/).fill('http://not-secure.example');
  await page.locator('#nu-form').getByRole('button', { name: 'Save →' }).click();
  await expect(page.locator('#notice')).toContainText('https://');
  expect(gh.puts).toHaveLength(0);
  await page.getByLabel(/^Link/).fill('https://example.com/trot');
  await page.locator('#nu-form').getByRole('button', { name: 'Save →' }).click();
  await expect(page.locator('#notice')).toContainText('Saved');
  const saved = gh.json('next-up/schedule.json');
  expect(saved.items.map(i => i.title).slice(0, 3)).toEqual(['Last Trail Standing', 'Turkey Trot', 'Pittsburgh Marathon']);
  expect(gh.puts[0]).toMatchObject({ path: 'next-up/schedule.json', message: 'Next up: add Turkey Trot', branch: 'main' });

  await page.getByRole('button', { name: 'Turn on Pain in Moraine' }).click();
  await expect(row('Pain in Moraine').locator('.pill')).toHaveText('Queued');
  expect(gh.json('next-up/schedule.json').items.find(i => i.title === 'Pain in Moraine').off).toBeUndefined();
});

test('next up: hiding the card and a save conflict', async ({ page }) => {
  const gh = fakeGitHub(page, { conflictOnce: true });
  await signIn(page);
  await page.getByLabel('Show the Next up card on my page').uncheck();
  await expect(page.locator('#notice')).toContainText('changed somewhere else');
  await expect(page.getByLabel('Show the Next up card on my page')).toBeChecked();
  await page.getByLabel('Show the Next up card on my page').uncheck();
  await expect(page.locator('#notice')).toContainText('Saved');
  expect(gh.json('next-up/schedule.json').enabled).toBe(false);
  await expect(page.locator('#nu-now')).toContainText('hidden');
});

test('gear: add with photo upload, reorder, hide', async ({ page }) => {
  const gh = fakeGitHub(page);
  await signIn(page);
  await page.getByRole('tab', { name: 'Gear' }).click();
  await expect(page.locator('#gear-list li')).toHaveCount(1);
  await page.locator('#gear-add').click();
  await page.getByLabel('Product name').fill('Trail shoe');
  await page.getByLabel('Brand').fill('Test');
  await page.getByLabel(/^Affiliate link/).fill('https://example.com/shoe');
  await page.getByLabel(/^Photo/).setInputFiles({ name: 'shoe.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
  await expect(page.locator('#gear-preview')).toBeVisible();
  await page.locator('#gear-form').getByRole('button', { name: 'Save →' }).click();
  await expect(page.locator('#notice')).toContainText('Saved');
  expect(gh.puts[0].path).toMatch(/^gear\/images\/trail-shoe-[a-z0-9]+\.webp$/);
  expect(gh.puts[0].bytes.subarray(8, 12).toString()).toBe('WEBP');
  const products = gh.json('gear/products.json').products;
  expect(products.map(p => p.name)).toEqual(['Fenix HM55R Rechargeable Headlamp', 'Trail shoe']);
  expect(products[1].image).toBe(gh.puts[0].path);

  await page.getByRole('button', { name: 'Move Trail shoe up' }).click();
  await expect(page.locator('#gear-list li').first()).toContainText('Trail shoe');
  expect(gh.json('gear/products.json').products[0].name).toBe('Trail shoe');
  await page.getByRole('button', { name: 'Hide Trail shoe' }).click();
  await expect(page.locator('#gear-list li').first().locator('.pill')).toHaveText('Hidden');
  expect(gh.json('gear/products.json').products[0].visible).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('remembers the key on this device and signs out cleanly', async ({ page }) => {
  fakeGitHub(page);
  await signIn(page);
  await page.reload();
  await expect(page.locator('#workspace')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.locator('#login')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('tim_editor_key'))).toBeNull();
});
