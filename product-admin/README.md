# Gear carousel and private editor

The public site remains a static GitHub Pages site. `gear/config.js` supplies the HTTPS origin of a separate Cloudflare-compatible backend. `/admin/` redirects to that backend's editor, so secure cookies are first-party and the site does not need a hosting migration.

## Features

- Swipeable carousel with desktop arrows and keyboard access; hidden when no products are published.
- Product images, names, brands, personal notes, and independent HTTPS affiliate links.
- Password-only editor: add, edit, delete, reorder, show/hide, upload JPG/PNG/WebP, change password, sign out.
- D1 catalog storage with revision checks; R2 image storage.
- Single-use initial password setup, PBKDF2 password hashing, expiring HttpOnly sessions, CSRF and origin checks, login throttling, upload size/type checks.

## Backend deployment contract

`product-admin/worker.mjs` is a Cloudflare Worker entry point. Configure these bindings with your hosting provider:

- `DB`: D1 database with `product-admin/schema.sql` applied once as a schema migration.
- `BUCKET`: R2 bucket for product images.
- `SETUP_TOKEN`: cryptographically random secret, at least 32 bytes. Store only in hosted secrets; never in the repo or browser configuration.

Bundle `admin.html`, `editor.js`, and `editor.css` as text modules when using the standalone Worker entry point. A framework adapter can instead serve these as static assets and pass API requests to `handle()` in `backend.mjs`.

After deploying, open `https://BACKEND/admin#setup=SECRET_TOKEN` privately and create a password of 14–128 characters. The fragment is removed immediately and setup is disabled after the first successful use. Normal sign-in is at `/admin`. No password is shipped with this repository. A password change revokes all earlier sessions.

Set `window.GEAR_API_ORIGIN` in `gear/config.js` to the deployed HTTPS backend origin. The public API intentionally allows read-only cross-origin fetches; editor writes require a same-origin session and CSRF token. Only visible products are returned by the public endpoint. Uploaded image URLs are public assets; hiding a product removes it from the carousel, not from image storage.

GitHub Pages serves `/admin/` as a static redirect to the secure editor. An exact same-origin backend at `in-motion.run/admin` would require a reverse proxy or moving the site's hosting.

## Verification

Run `node tests/gear-api.mjs` with Node 22.20 or later. Tests use an isolated in-memory SQLite database and mock R2 storage and never touch hosted products.

Run `node tests/gear-preview.mjs` for a disposable local preview at `http://localhost:4187`. Its local-only setup token is printed by the server. All preview data is in memory and disappears when stopped. This preview is not production hosting.

## Product content

No invented product recommendations are seeded. Add individual Rendezvu links or other retailer affiliate links through the editor. The existing full Rendezvu shop and 1st Phorm links remain on the public page. There is no automatic Rendezvu sync.

## Current Sites deployment

The hosted backend is https://tristan-inmotion-gear.easytick4097.chatgpt.site. Its project and saved-version references are in `deployment.json`. The local Sites source checkout is `hosted-service/` (a separate source repository, ignored by the GitHub Pages repository). Future edits should reopen this same Sites project rather than create another.

The hosted adapter is `hosted-service/gear/handler.ts`, called from the starter Worker entry point while preserving the Sites build integration. The D1 migration is generated from `hosted-service/db/schema.ts`. Before deploying an editor change, copy the four canonical files from `product-admin/` to `hosted-service/gear/`, then build and publish through the Sites workflow. The bootstrap setup secret is in hosted runtime configuration and is deliberately absent from both repositories.

## Headlamp import

`catalog-imports.mjs` adds the Fenix HM55R once, using the image, original personal note, and host-tagged URL from Tristan's Rendezvu collection. It is applied transactionally to the existing catalog on its next read after deployment. A durable marker prevents duplicates and preserves all future edits, hiding, or deletion through the editor. This is runtime content initialization, separate from schema migrations. Copy this module to `hosted-service/gear/` with future source updates. Verify with `node tests/gear-import.mjs`.
