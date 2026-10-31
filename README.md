# links-inMotion

Personal link page for tristan.inmotion at https://in-motion.run, with an animated runner, Hooper, a trail mini-game, optional music, social links, and a managed gear carousel.

## Local setup

Use Node.js 22.20 or later and npm. From the repository root:

```sh
npm ci
npm run preview
```

Open http://127.0.0.1:4187. It serves the same static files GitHub Pages does. The editor is at /admin/, but it always saves to the real repo on GitHub. Stop the preview with Ctrl+C.

## Repository layout

- `index.html`: public page, styles, social destinations, sharing metadata, and audio controls.
- `next-up/`: the "Next up" card and its schedule (`schedule.json`).
- `scene/`: runner/game logic, character images, and scenery.
- `audio/`: optional background music.
- `gear/`: gear carousel, its product list (`products.json`), and uploaded photos.
- `admin/`: the editor for gear and Next up.
- `tests/`: local preview server and browser checks for the page and the editor.
- `CNAME`: custom domain for GitHub Pages.

## Editing gear and Next up

Everything the page shows lives in two files in this repo:

- `gear/products.json`: the "In my rotation" carousel. Uploaded photos go in `gear/images/`.
- `next-up/schedule.json`: the "Next up" card.

The easy way to change them is the editor at **https://in-motion.run/admin/**. It has two tabs, Next up and Gear. Each save is a commit to `main`, and the page updates about a minute later. There is no server: the editor talks to GitHub directly.

**Signing in.** The editor uses a GitHub fine-grained personal access token that only works on this repo. Make one at GitHub → Settings → Developer settings → Fine-grained tokens: repository access "Only select repositories" → links-inMotion, permission Contents: Read and write, nothing else. Paste it into the editor. It is saved only in that browser on that device; Sign out removes it. If a token leaks, delete it on GitHub and make a new one.

**How Next up decides what to show.** The card shows the soonest race that is on and hasn't passed. Each race shows until its race date (or its "last day it shows"), then the next one takes over. "Start showing on" holds a race back until that day. Races that are off, have a typo'd date, or a non-https link never show. Private notes are only visible in the editor. With nothing live, the card hides with no gap.

**Gear.** Products show in list order; hidden ones stay in the editor but not on the page. Links and image links must be https. Photos are shrunk to 1000px WebP before upload.

You can also edit either JSON file directly on GitHub; the fields match the editor's form.

## Verification

Install the test browser once after installing dependencies:

```sh
npx playwright install chromium
npm test
```

Browser checks start and stop their own preview on port 4187; stop a manually running preview first. They run on desktop and mobile sizes and cover the social links, sharing metadata, the game/Hooper/sound controls, the gear carousel, the Next up schedule, and the editor. External requests are blocked and GitHub is faked, so tests never change the real repo.

## Deployment

The public page is a static GitHub Pages site using the domain in `CNAME`. Public files need no build step; npm dependencies are development tools. Publish changes through the repository's GitHub Pages deployment configuration. Keep sharing metadata in `index.html` aligned with the custom domain and keep `og-links.png` available at the site root.

Gear and Next up are plain files in this repo, so there is nothing else to host or deploy.
