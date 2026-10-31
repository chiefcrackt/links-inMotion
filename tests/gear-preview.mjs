// Local-only preview. Its fixed setup token is never a production credential.
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { handle } from '../product-admin/backend.mjs';
const database = new DatabaseSync(':memory:'); database.exec(readFileSync('product-admin/schema.sql', 'utf8'));
class Statement {
  constructor(sql, values = []) { this.sql = sql; this.values = values; }
  bind(...values) { return new Statement(this.sql, values); }
  async first() { return database.prepare(this.sql).get(...this.values) || null; }
  async run() { return { meta: { changes: Number(database.prepare(this.sql).run(...this.values).changes) } }; }
}
const images = new Map(), root = process.cwd();
const env = { SETUP_TOKEN: 'local-preview-setup', DB: { prepare: sql => new Statement(sql), batch: async statements => { database.exec('BEGIN'); try { const result = []; for (const statement of statements) result.push(await statement.run()); database.exec('COMMIT'); return result; } catch (error) { database.exec('ROLLBACK'); throw error; } } }, BUCKET: { put: async (key, bytes, options) => images.set(key, { body: bytes, ...options }), get: async key => images.get(key) } };
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.json': 'application/json' };
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost:4187'); let response;
    if (url.pathname.startsWith('/api/')) {
      const body = []; for await (const chunk of req) body.push(chunk);
      response = await handle(new Request(url, { method: req.method, headers: req.headers, body: body.length ? Buffer.concat(body) : undefined }), env);
    } else {
      let path = url.pathname;
      if (path === '/admin' || path === '/admin/') path = '/product-admin/admin.html';
      if (path === '/editor.js') path = '/product-admin/editor.js';
      if (path === '/editor.css') path = '/product-admin/editor.css';
      if (path === '/') path = '/index.html';
      if (path === '/gear/config.js') response = new Response("window.GEAR_API_ORIGIN='http://localhost:4187';", { headers: { 'Content-Type': 'text/javascript' } });
      else { const file = resolve(root, '.' + decodeURIComponent(path)); const publicFile = file.startsWith(root + sep) && !path.includes('/.') && !path.endsWith('.mjs') && !path.endsWith('.sql');
        response = publicFile && existsSync(file) ? new Response(readFileSync(file), { headers: { 'Content-Type': mime[extname(file)] || 'application/octet-stream' } }) : new Response('Not found', { status: 404 }); }
    }
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { console.error(error); res.writeHead(500); res.end('Preview error'); }
}).listen(4187, '127.0.0.1', () => console.log('Local: http://localhost:4187 · Editor: /admin#setup=local-preview-setup'));
