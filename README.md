Grade Unboxing — Chrome extension

What this does
- Hides grade text on https://fsweb.no/studentweb/resultater.jsf
- Replaces each grade with an "Åpne sak" button
- Plays a case-opening animation and reveals the real grade at the end

Files added
- `manifest.json` — extension manifest (Manifest V3)
- `content_scripts/content.js` — main content script that finds grades, injects buttons, and runs the animation
- `content_scripts/content.css` — styles for the overlay and buttons
- `icons/*` — simple SVG icon placeholders (replace with your own if desired)

How to install locally (developer mode)
1. Open Chrome and go to `chrome://extensions/`.
2. Enable "Developer mode" (toggle top-right).
3. Click "Load unpacked" and select the `grade-unboxing` folder (the folder that contains `manifest.json`).
4. Navigate to `https://fsweb.no/studentweb/resultater.jsf` and log in. The extension will run automatically.

Customization / assets
- Replace `icons/*.svg` with artwork you prefer (keep names or update `manifest.json`).
- The animation uses simple textual cards for grades. To create richer visuals:
  - Add images in a new `assets/` folder and update `content_scripts/content.js` to create `.gu-card` with background images.
  - You can also add sound effects by loading audio files from `web_accessible_resources` and playing them during the animation.

Privacy & safety
- This extension runs entirely in the browser and does not send data to any remote server.
- It only reads grade text from the page to reveal it locally in the animation.

Notes and TODOs
- Add richer card art and per-grade rarity animations.
- Allow user to toggle animation speed or skip by default.

If you want, I can:
- Add images/sample assets and audio cues.
- Extend the animation to be more like CS:GO (rarities, particle effects).
- Add an options UI for toggling features and customizing grade sets.
