import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { handle } from '../product-admin/backend.mjs';
const sqlite = new DatabaseSync(':memory:'); sqlite.exec(readFileSync(new URL('../product-admin/schema.sql', import.meta.url), 'utf8'));
class Statement {
  constructor(sql, values = []) { this.sql = sql; this.values = values; }
  bind(...values) { return new Statement(this.sql, values); }
  async first() { return sqlite.prepare(this.sql).get(...this.values) || null; }
  async run() { const result = sqlite.prepare(this.sql).run(...this.values); return { meta: { changes: Number(result.changes) } }; }
}
const images = new Map();
const env = { SETUP_TOKEN: 'test-only-setup-token', DB: { prepare: sql => new Statement(sql), batch: async statements => { sqlite.exec('BEGIN'); try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; } catch (e) { sqlite.exec('ROLLBACK'); throw e; } } }, BUCKET: { put: async (key, bytes, options) => images.set(key, { body: bytes, ...options }), get: async key => images.get(key) } };
const origin = 'https://gear.test'; let cookie = '', csrf = '';
async function request(path, { method = 'GET', body, anonymous = false, headers = {}, raw = false } = {}) {
  const h = { origin, ...headers }; if (!anonymous && cookie) h.cookie = cookie; if (!anonymous && csrf && !h['x-csrf-token']) h['x-csrf-token'] = csrf;
  if (body && !(body instanceof FormData)) h['content-type'] = 'application/json';
  const response = await handle(new Request(origin + path, { method, headers: h, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined }), env);
  if (raw) return response;
  const data = await response.json(); return { status: response.status, data, response };
}
function signIn(result) { cookie = result.response.headers.get('set-cookie').split(';')[0]; csrf = result.data.csrf; }
assert.equal((await request('/api/admin/products', { anonymous: true })).status, 401);
assert.equal((await request('/api/session')).data.setupRequired, true);
assert.equal((await request('/api/setup', { method: 'POST', body: { token: 'wrong', password: 'a long test password' }, anonymous: true })).status, 403);
assert.equal((await request('/api/setup', { method: 'POST', body: { token: env.SETUP_TOKEN, password: 'short' }, anonymous: true })).status, 400);
const setup = await request('/api/setup', { method: 'POST', body: { token: env.SETUP_TOKEN, password: 'a long test password' }, anonymous: true });
assert.equal(setup.status, 200); assert.match(setup.response.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Strict/); signIn(setup);
assert.equal((await request('/api/session')).data.authenticated, true);
assert.equal((await request('/api/setup', { method: 'POST', body: { token: env.SETUP_TOKEN, password: 'another long password' }, anonymous: true })).status, 409);
assert.equal((await request('/api/admin/products')).data.revision, 0);
const shown = { id: crypto.randomUUID(), name: 'Daily trainer', brand: 'Running', note: '<img src=x onerror=alert(1)>', url: 'https://shop.example/shoes?affiliate=tristan&x=1', image: '', visible: true };
const hidden = { ...shown, id: crypto.randomUUID(), name: 'Hidden gear', visible: false };
assert.equal((await request('/api/admin/products', { method: 'PUT', anonymous: true, body: { products: [shown], revision: 0 } })).status, 401);
assert.equal((await request('/api/admin/products', { method: 'PUT', headers: { 'x-csrf-token': 'wrong' }, body: { products: [shown], revision: 0 } })).status, 403);
assert.equal((await request('/api/admin/products', { method: 'PUT', headers: { origin: 'https://evil.test' }, body: { products: [shown], revision: 0 } })).status, 403);
assert.equal((await request('/api/admin/products', { method: 'PUT', body: { products: [{ ...shown, url: 'javascript:alert(1)' }], revision: 0 } })).status, 400);
assert.equal((await request('/api/admin/products', { method: 'PUT', body: { products: [shown, hidden], revision: 0 } })).status, 200);
assert.equal((await request('/api/admin/products', { method: 'PUT', body: { products: [], revision: 0 } })).status, 409);
const published = await request('/api/products', { anonymous: true }); assert.equal(published.data.products.length, 1); assert.equal(published.data.products[0].url, shown.url); assert.equal(published.response.headers.get('access-control-allow-origin'), '*');
assert.equal(published.data.products[0].visible, undefined);
const badImage = new FormData(); badImage.append('image', new File(['<svg/>'], 'bad.png', { type: 'image/png' }));
assert.equal((await request('/api/admin/upload', { method: 'POST', body: badImage })).status, 400);
const image = new FormData(); image.append('image', new File([Buffer.from('89504e470d0a1a0a0000000049454e44ae426082', 'hex')], 'test.png', { type: 'image/png' }));
assert.equal((await request('/api/admin/upload', { method: 'POST', body: image, anonymous: true })).status, 401);
const uploaded = await request('/api/admin/upload', { method: 'POST', body: image }); assert.equal(uploaded.status, 200);
assert.equal((await request(uploaded.data.image, { anonymous: true, raw: true })).headers.get('content-type'), 'image/png');
assert.equal((await request('/api/admin/products', { method: 'PUT', body: { products: [{ ...shown, image: uploaded.data.image }], revision: 1 } })).status, 200);
assert.ok((await request('/api/products', { anonymous: true })).data.products[0].image.startsWith(origin));
const oldCookie = cookie;
assert.equal((await request('/api/password', { method: 'POST', body: { currentPassword: 'wrong', password: 'new long test password' } })).status, 401);
const changed = await request('/api/password', { method: 'POST', body: { currentPassword: 'a long test password', password: 'new long test password' } }); assert.equal(changed.status, 200); signIn(changed);
assert.equal((await handle(new Request(origin + '/api/session', { headers: { cookie: oldCookie } }), env)).status, 200);
assert.equal((await (await handle(new Request(origin + '/api/session', { headers: { cookie: oldCookie } }), env)).json()).authenticated, false);
assert.equal((await request('/api/logout', { method: 'POST' })).status, 200);
assert.equal((await request('/api/admin/products')).status, 401);
const login = await request('/api/login', { method: 'POST', body: { password: 'new long test password' }, anonymous: true }); assert.equal(login.status, 200); signIn(login);
assert.equal((await request('/api/admin/products', { method: 'PUT', body: { products: [], revision: 2 } })).status, 200);
assert.deepEqual((await request('/api/products', { anonymous: true })).data.products, []);
let limited = false;
for (let i = 0; i < 10; i++) { const result = await request('/api/login', { method: 'POST', body: { password: 'wrong' }, anonymous: true }); if (result.status === 429) limited = true; }
assert.equal(limited, true);
sqlite.close();
console.log('PASS: setup, login, sessions, CSRF/origin protection, hidden products, affiliate URL preservation, concurrent saves, uploads, password changes, logout, rate limits.');
