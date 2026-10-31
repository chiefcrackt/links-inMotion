// Local static preview of the site, the same files GitHub Pages serves.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
const root = process.cwd(), port = Number(process.env.PORT) || 4187;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp3': 'audio/mpeg' };
createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (path.endsWith('/')) path += 'index.html';
  let file = resolve(root, '.' + path);
  if (existsSync(file) && statSync(file).isDirectory()) { res.writeHead(301, { Location: path + '/' }); return res.end(); }
  const ok = file.startsWith(root + sep) && !path.split('/').some(part => part.startsWith('.') || part === 'node_modules') && existsSync(file);
  if (!ok) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
}).listen(port, '127.0.0.1', () => console.log(`Preview: http://localhost:${port}  ·  Editor: http://localhost:${port}/admin/`));
