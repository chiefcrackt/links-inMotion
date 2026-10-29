# links-inMotion

Personal link page for tristan.inmotion at https://in-motion.run, with an animated runner, Hooper, a trail mini-game, optional music, social links, and a managed gear carousel.

## Local setup

Use Node.js 22.20 or later and npm. From the repository root:

```sh
npm ci
npm run preview
```

Open http://127.0.0.1:4187. The preview serves the public page and an isolated gear backend with in-memory data. Its editor is at http://127.0.0.1:4187/admin#setup=local-preview-setup. The local setup token is for this disposable preview only; all preview data disappears when the process stops. Stop it with Ctrl+C.

## Repository layout

- `index.html`: public page, styles, social destinations, sharing metadata, and audio controls.
- `scene/`: runner/game logic, character images, and scenery.
- `audio/`: optional background music.
- `gear/`: public gear carousel and production backend origin.
- `admin/`: redirect to the hosted private editor.
- `product-admin/`: gear backend, editor, schema, import, and deployment documentation.
- `tests/`: isolated API/import checks, local preview server, and public-page browser checks.
- `CNAME`: custom domain for GitHub Pages.

## Verification

Install the test browser once after installing dependencies:

```sh
npx playwright install chromium
npm test
```

Individual checks:

```sh
npm run test:api
npm run test:import
npm run test:browser
```

Browser checks start and stop their own preview on port 4187; stop a manually running preview first. They cover desktop and mobile viewports, expected social destinations, custom-domain sharing metadata and the local preview image, game/Hooper/sound controls, published gear, and a gear-service outage. External HTTPS requests are blocked and product responses are mocked, so tests do not change hosted data or depend on social sites being online. These checks validate configured social URLs, not remote account availability.

## Deployment

The public page is a static GitHub Pages site using the domain in `CNAME`. Public files need no build step; npm dependencies are development tools. Publish changes through the repository's GitHub Pages deployment configuration. Keep sharing metadata in `index.html` aligned with the custom domain and keep `og-links.png` available at the site root.

Gear storage and the private editor run separately. `gear/config.js` points to that hosted backend. See [the gear deployment guide](product-admin/README.md) for bindings, setup, source synchronization, and the existing Sites deployment. GitHub Pages changes do not deploy backend/editor changes.
