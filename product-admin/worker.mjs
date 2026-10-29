import adminHTML from './admin.html';
import editorJS from './editor.js';
import editorCSS from './editor.css';
import { handle } from './backend.mjs';
const headers = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow'
};
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (request.method === 'GET') {
      const asset = path === '/' || path === '/admin' || path === '/admin/' ? [adminHTML, 'text/html; charset=utf-8'] : path === '/editor.js' ? [editorJS, 'text/javascript; charset=utf-8'] : path === '/editor.css' ? [editorCSS, 'text/css; charset=utf-8'] : null;
      if (asset) return new Response(asset[0], { headers: { ...headers, 'Content-Type': asset[1] } });
    }
    const response = await handle(request, env);
    const wrapped = new Response(response.body, response);
    for (const [key, value] of Object.entries(headers)) if (!wrapped.headers.has(key)) wrapped.headers.set(key, value);
    return wrapped;
  }
};
