// Framework-independent Cloudflare backend. No credentials belong in this file.
const enc = new TextEncoder();
const COOKIE = '__Host-gear_session';
const SESSION_TTL = 8 * 60 * 60 * 1000;
const MAX_IMAGE = 5 * 1024 * 1024;
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } });
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const digest = async text => hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
const equal = (a, b) => { if (a.length !== b.length) return false; let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0; };
const problem = (status, message) => { const e = new Error(message); e.status = status; throw e; };
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256));
}
async function readBody(request, max) {
  if (Number(request.headers.get('content-length')) > max) problem(413, 'File or request is too large.');
  const reader = request.body?.getReader(); if (!reader) return new Uint8Array();
  const parts = []; let length = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > max) { await reader.cancel(); problem(413, 'File or request is too large.'); } parts.push(value); }
  const result = new Uint8Array(length); let offset = 0; for (const part of parts) { result.set(part, offset); offset += part.length; } return result;
}
async function bodyJSON(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) problem(415, 'Send JSON.');
  try { const body = JSON.parse(new TextDecoder().decode(await readBody(request, 131072))); if (!body || typeof body !== 'object' || Array.isArray(body)) problem(400, 'Invalid request.'); return body; } catch (e) { if (e.status) throw e; problem(400, 'Invalid request.'); }
}
function validPassword(value) { if (typeof value !== 'string' || value.length < 14 || value.length > 128) problem(400, 'Use a password between 14 and 128 characters.'); }
async function throttle(env, key, limit, windowMs) {
  const now = Date.now();
  const row = await env.DB.prepare('INSERT INTO gear_limits (key, hits, resets) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET hits = CASE WHEN resets <= ? THEN 1 ELSE hits + 1 END, resets = CASE WHEN resets <= ? THEN excluded.resets ELSE resets END RETURNING hits').bind(key, now + windowMs, now, now).first();
  if (row.hits > limit) problem(429, 'Too many attempts. Please try again later.');
}
async function session(request, env) {
  const value = request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (!value || !/^[a-f0-9]{64}$/.test(value)) return null;
  return env.DB.prepare('SELECT hash, csrf FROM gear_sessions WHERE hash = ? AND expires > ?').bind(await digest(value), Date.now()).first();
}
async function newSession(env) {
  const token = random(), csrf = random();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM gear_sessions WHERE expires <= ?').bind(Date.now()),
    env.DB.prepare('DELETE FROM gear_limits WHERE resets <= ?').bind(Date.now()),
    env.DB.prepare('INSERT INTO gear_sessions (hash, csrf, expires) VALUES (?, ?, ?)').bind(await digest(token), csrf, Date.now() + SESSION_TTL)
  ]);
  return { csrf, cookie: COOKIE + '=' + token + '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800' };
}
function validateProducts(products) {
  if (!Array.isArray(products) || products.length > 100) problem(400, 'A maximum of 100 products is supported.');
  const ids = new Set();
  return products.map(p => {
    if (!p || typeof p.id !== 'string' || !/^[a-f0-9-]{36}$/.test(p.id) || ids.has(p.id)) problem(400, 'Invalid product ID.'); ids.add(p.id);
    const text = (key, max, required = false) => { if (typeof p[key] !== 'string' || p[key].length > max || (required && !p[key].trim())) problem(400, 'Check the product ' + key + '.'); return p[key].trim(); };
    const name = text('name', 100, true), brand = text('brand', 60), note = text('note', 300), url = text('url', 4096, true), image = text('image', 4096);
    function https(value) { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } }
    if (!https(url) || (image && !https(image) && !/^\/api\/images\/[a-f0-9-]{36}$/.test(image))) problem(400, 'Product links and external images must use HTTPS.');
    if (typeof p.visible !== 'boolean') problem(400, 'Choose product visibility.');
    return { id: p.id, name, brand, note, url, image, visible: p.visible };
  });
}
export async function handle(request, env) {
  const path = new URL(request.url).pathname;
  try {
    if (!env.DB || !env.BUCKET || !env.SETUP_TOKEN) return json({ error: 'The editor is not configured yet.' }, 503);
    const method = request.method;
    if (path === '/api/products' && method === 'GET') {
      const row = await env.DB.prepare('SELECT products FROM gear_catalog WHERE id = 1').first();
      const products = JSON.parse(row?.products || '[]').filter(p => p.visible).map(({ visible, ...p }) => ({ ...p, image: p.image?.startsWith('/api/images/') ? new URL(p.image, request.url).href : p.image }));
      return json({ products }, 200, { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' });
    }
    if (path.startsWith('/api/images/') && method === 'GET') {
      const id = path.slice('/api/images/'.length); if (!/^[a-f0-9-]{36}$/.test(id)) problem(404, 'Image not found.');
      const object = await env.BUCKET.get('gear/' + id); if (!object) problem(404, 'Image not found.');
      return new Response(object.body, { headers: { 'Content-Type': object.httpMetadata.contentType, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
    }
    const auth = await session(request, env);
    if (path === '/api/session' && method === 'GET') {
      const setting = await env.DB.prepare("SELECT value FROM gear_settings WHERE key = 'password'").first();
      return json({ authenticated: !!auth, setupRequired: !setting, csrf: auth?.csrf });
    }
    if (!['GET', 'HEAD'].includes(method)) {
      if (request.headers.get('origin') !== new URL(request.url).origin) problem(403, 'Please open the editor directly and try again.');
      if (path !== '/api/login' && path !== '/api/setup') {
        if (!auth) problem(401, 'Please sign in again.');
        if (!equal(request.headers.get('x-csrf-token') || '', auth.csrf)) problem(403, 'Your session changed. Refresh and try again.');
      }
    }
    if ((path === '/api/login' || path === '/api/setup') && method === 'POST') {
      const ip = request.headers.get('cf-connecting-ip') || 'local';
      await throttle(env, 'login:' + await digest(env.SETUP_TOKEN + ip), 8, 15 * 60 * 1000);
      const body = await bodyJSON(request);
      if (typeof body.password !== 'string' || body.password.length > 128) problem(400, 'Enter your password.');
      if (path === '/api/setup') {
        validPassword(body.password);
        if (typeof body.token !== 'string' || body.token.length > 256 || !equal(await digest(body.token), await digest(env.SETUP_TOKEN))) problem(403, 'Invalid setup link.');
        const salt = random(), hash = await passwordHash(body.password, salt);
        const result = await env.DB.prepare("INSERT OR IGNORE INTO gear_settings (key, value) VALUES ('password', ?)").bind(salt + ':' + hash).run();
        if (!result.meta.changes) problem(409, 'Setup is already complete. Sign in with your password.');
      } else {
        const setting = await env.DB.prepare("SELECT value FROM gear_settings WHERE key = 'password'").first();
        if (!setting) problem(401, 'Finish setup using your private setup link.');
        const [salt, hash] = setting.value.split(':');
        if (!equal(await passwordHash(body.password, salt), hash)) problem(401, 'Incorrect password.');
      }
      const created = await newSession(env); return json({ ok: true, csrf: created.csrf }, 200, { 'Set-Cookie': created.cookie });
    }
    if (!auth) problem(401, 'Please sign in again.');
    if (path === '/api/logout' && method === 'POST') {
      await env.DB.prepare('DELETE FROM gear_sessions WHERE hash = ?').bind(auth.hash).run();
      return json({ ok: true }, 200, { 'Set-Cookie': COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' });
    }
    if (path === '/api/password' && method === 'POST') {
      await throttle(env, 'password:' + auth.hash, 5, 15 * 60 * 1000);
      const body = await bodyJSON(request); validPassword(body.password);
      if (typeof body.currentPassword !== 'string' || body.currentPassword.length > 128) problem(400, 'Enter your current password.');
      const setting = await env.DB.prepare("SELECT value FROM gear_settings WHERE key = 'password'").first();
      const [oldSalt, oldHash] = setting.value.split(':');
      if (!equal(await passwordHash(body.currentPassword, oldSalt), oldHash)) problem(401, 'Incorrect current password.');
      const salt = random(), hash = await passwordHash(body.password, salt);
      await env.DB.batch([env.DB.prepare("UPDATE gear_settings SET value = ? WHERE key = 'password'").bind(salt + ':' + hash), env.DB.prepare('DELETE FROM gear_sessions')]);
      const created = await newSession(env); return json({ ok: true, csrf: created.csrf }, 200, { 'Set-Cookie': created.cookie });
    }
    if (path === '/api/admin/products' && method === 'GET') {
      const row = await env.DB.prepare('SELECT products, revision FROM gear_catalog WHERE id = 1').first();
      return json({ products: JSON.parse(row?.products || '[]'), revision: row?.revision || 0 });
    }
    if (path === '/api/admin/products' && method === 'PUT') {
      const body = await bodyJSON(request), products = validateProducts(body.products);
      if (!Number.isSafeInteger(body.revision)) problem(400, 'Refresh your product list.');
      await env.DB.prepare('INSERT OR IGNORE INTO gear_catalog (id) VALUES (1)').run();
      const result = await env.DB.prepare('UPDATE gear_catalog SET products = ?, revision = revision + 1 WHERE id = 1 AND revision = ?').bind(JSON.stringify(products), body.revision).run();
      if (!result.meta.changes) problem(409, 'Products changed in another tab. Refresh before editing again.');
      return json({ products, revision: body.revision + 1 });
    }
    if (path === '/api/admin/upload' && method === 'POST') {
      await throttle(env, 'uploads:' + auth.hash, 50, 60 * 60 * 1000);
      const data = await new Response(await readBody(request, MAX_IMAGE + 16384), { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData();
      const file = data.get('image');
      if (!(file instanceof File) || !file.size || file.size > MAX_IMAGE) problem(400, 'Choose a JPG, PNG, or WebP image up to 5 MB.');
      const bytes = new Uint8Array(await file.arrayBuffer()); let type = '';
      if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) type = 'image/jpeg';
      if (hex(bytes.slice(0, 8)) === '89504e470d0a1a0a') type = 'image/png';
      if (new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP') type = 'image/webp';
      if (!type || file.type !== type) problem(400, 'Use a real JPG, PNG, or WebP image.');
      const id = crypto.randomUUID(); await env.BUCKET.put('gear/' + id, bytes, { httpMetadata: { contentType: type } });
      return json({ image: '/api/images/' + id });
    }
    return json({ error: 'Not found.' }, 404);
  } catch (error) {
    if (!error.status) console.error('Gear request failed', error.message);
    return json({ error: error.status ? error.message : 'Something went wrong. Please try again.' }, error.status || 500);
  }
}
