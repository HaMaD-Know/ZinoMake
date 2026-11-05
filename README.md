# ZinoMake

**Create anything. No coding experience needed.**

ZinoMake is a website where anyone can make games, apps, websites and animations by snapping
blocks together — **Choose → Build → Play**. It runs entirely in your web browser on a computer,
tablet or phone. No account, no installs for users, no paid services.

## What works today

- **Start in seconds** — press *Create Something*, choose Game / App / Website / Animation,
  pick one of 19 working starters (or a blank project) and press *Start Creating*.
- **Real block coding** (Blockly): events, movement, looks, sound, numbers & text, decisions,
  repeat, variables (“Remember”), your own blocks (“My blocks”), and time. Blocks snap,
  nest, undo/redo, zoom and pan, and work with touch.
- **Design view (visual editor)** — build screens by adding components and changing them in a
  properties panel, like App Inventor or a page builder: nav bar, sections, rows, columns, cards,
  game stage, titles, text, lists, links, your own pictures, emoji characters, shapes, buttons,
  text boxes, big text boxes, checkboxes, dropdowns and sliders. Change words, pictures, colours,
  sizes, spacing, borders, shadows and layout; drag things on a game stage and resize them with the
  corner handle. Each thing has **When tapped** (go to a screen, show a message, play a sound, open
  a link) and a button that opens Blocks with “when … is clicked” ready. Several **screens** with
  a nav bar, a project **theme** (main colour, font, corners), phone/tablet/desktop canvas sizes,
  undo/redo. Saved as `design.json`; try the *Shop App* and *Business Website* starters.
- **Make things with blocks** — the *Make things* category adds a stage, emoji characters,
  boxes, circles, pictures, words, titles, buttons, typing boxes and phone arrow buttons, and
  *Looks* can resize, restyle and turn them. You never need to edit `index.html` or
  `style.css`; blank projects start as blocks only.
- **Scratch-style game blocks** — speed, gravity, bounce off edges, point at an angle, copies
  (like clones: “make a copy of wall”; touching checks every copy; copies leaving the stage tidy
  themselves up), “is being pressed” for on-screen picture buttons, and messages
  (“send message” / “when I get message”). Names and your pictures are picked from dropdowns,
  and **＋ Add to stage** in *Pictures & sounds* adds a picture with one tap. Try the
  *Fly Through the Gaps* starter.
- **Add block without dragging** — the *Add block* dialog inserts a block next to the selected
  one (keyboard and touch friendly). *Delete block* removes the selected block.
- **Real code** — Code view shows the JavaScript your blocks make. Simple edits in the code
  update the blocks; code that blocks can't show is **kept exactly as you wrote it** as a grey
  “custom code” block. Syntax mistakes never erase anything.
- **Play / Stop / Restart** in a sandboxed preview, with full-size / tablet / phone sizes and
  plain-language error messages. Runaway loops are stopped automatically.
- **My Projects** — recent projects, search, sort, folders, rename, duplicate, move, delete.
- **Files** — create, rename, move and delete files and folders inside a project.
- **Pictures & sounds** — add PNG/JPG/GIF/WebP/SVG pictures and MP3/WAV/OGG sounds, use them with
  blocks (*show picture*, *play audio file*) or in HTML/CSS as `assets/name.png`.
- **Autosave** to this browser (IndexedDB) with visible *Saving… / Saved / Not saved* states,
  recovery after refresh, and protection against overwriting newer work from another tab.
- **Export / import** — download a project as `.zinomake.zip` and open it again later or on
  another device; download a single runnable `.html` web page; download the source files.
- **“Describe it” helper** — type “Make the player move when I press the arrow keys” and get
  blocks. It works offline using simple rules (it is *not* an AI and understands a limited set
  of phrases).
- Optional **quick tour**, **Help & ideas**, “What can I do next?” suggestions, *Start over*.
- Light and dark theme, keyboard navigation, visible focus, reduced-motion support.

## Running it on your computer

You need **Node.js 20 or newer** (download the “LTS” version from <https://nodejs.org>).

1. Open a terminal:
   - **Windows:** press the Windows key, type `PowerShell`, press Enter.
   - **Mac:** open *Terminal* (in Applications → Utilities).
2. Go to the project folder (replace the path with where you saved ZinoMake):
   ```
   cd path/to/zinomake
   ```
3. Install the parts ZinoMake needs (only the first time):
   ```
   npm install
   ```
4. Start ZinoMake:
   ```
   npm run dev
   ```
5. Open the address it prints (normally <http://localhost:5173/>) in your browser.
   To stop it, go back to the terminal and press `Ctrl + C`.

### Build the website for publishing

```
npm run build
```

This creates a `dist/` folder with plain static files. Upload the contents of `dist/` to any
static host (GitHub Pages, Netlify, Cloudflare Pages, your own web server). Paths are relative,
so it also works from a sub-folder. To try the built version locally: `npm run preview`.
No server or database is needed — each visitor's projects are stored in their own browser.

### Tests

```
npm test            # unit tests (Vitest): parser, generator, round trips, storage, files, ZIP, preview, helper
npm run typecheck   # TypeScript strict type check
npm run test:e2e    # browser tests (needs `npm run dev` running and Playwright + Chromium installed)
```

For the browser tests, start `npm run dev` in one terminal and run `npm run test:e2e` in
another. Set `BASE_URL` if ZinoMake runs on another address.

## iPhone / iPad app (unsigned .ipa)

The same website is also packaged as an iOS app with [Capacitor](https://capacitorjs.com)
(`ios/` folder, bundle id `com.zinomake.app`, iOS 16.4 or newer, iPhone and iPad).

**Building it (no Mac needed):** every push to GitHub runs the *iOS build* workflow
(`.github/workflows/ios-build.yml`) on GitHub's macOS computers. When it finishes, open the run
on the repository's **Actions** tab and download the artifact
**“ZinoMake-unsigned-ipa (re-sign before installing)”**. You can also start it by hand:
Actions → *iOS build* → *Run workflow*.

**Installing it:** an *unsigned* .ipa can't be installed directly. Unzip the downloaded
artifact to get `ZinoMake-unsigned.ipa`, then sign and install it with your own Apple ID using a
sideloading tool such as **Sideloadly** or **AltStore** (Windows or Mac). With a free Apple ID
the app must be re-signed every 7 days.

**In the app:** projects are stored on the device inside the app. “Download …” buttons open the
iOS share sheet, so you can save files to the Files app or AirDrop them; “Open a file” imports a
`.zinomake.zip` from Files.

**Building on a Mac yourself:** `npm install`, `npm run ios:sync`, then open
`ios/App/App.xcodeproj` in Xcode, choose your team under *Signing & Capabilities* and press Run.

## How to make something

1. Press **Create Something** → choose what to make → pick a starter → **Start Creating**.
2. Press **▶ Play** to see it working. Press **Stop** to end it.
3. Change it: drag blocks from the categories on the left into a *“when…”* block, or use
   **Add block**. Change numbers and words by tapping them.
4. Press **Play** again to see your change.
5. Curious about code? Open **Code**. Change `"Hello!"` to `"Hi!"`, go back to **Blocks**,
   and the block has changed too.

Make things with the **Make things** blocks (for example *add character player looking like 🐱*)
and then use the same name in other blocks (*move player by x 10*). Things written in
`index.html` with an **id** (for example `<div id="player">`) can be used the same way. On phones, game starters include on-screen arrow buttons
(`<button data-key="ArrowLeft">`) that work like keyboard keys.

## How saving works

Projects are saved automatically in **this browser on this device** (IndexedDB) a moment after
each change. They are still there after a refresh or restart. They are **not** uploaded anywhere
and are **not** synced between devices — clearing your browser's site data deletes them. Use
**Download project (.zip)** to keep a backup or move a project, and **Open a file** on the home
page to bring it back.

## How Blocks and Code stay in sync

`main.js` is linked to the blocks (marked “blocks” in the file list).

- Change blocks → `main.js` is regenerated from the blocks.
- Change `main.js` → if the code is valid, the blocks are rebuilt from it. Supported statements
  become normal blocks; anything else becomes a grey **custom code** block that keeps the exact
  original text. The status bar says *Blocks and code match*, *Blocks updated from code*,
  *Some code is shown as custom blocks*, or *Code has a mistake*.
- If the code has a mistake, your text is kept as typed, the blocks keep the last working
  version and are locked until you fix it (or choose *Use the blocks instead*).

The exact supported code is listed in [docs/SUPPORTED_CODE.md](docs/SUPPORTED_CODE.md).
Other files (`index.html`, `style.css`, extra `.js` files) are edited as text only.

## Known limitations

- Two-way conversion covers only the [documented subset](docs/SUPPORTED_CODE.md) of JavaScript.
  After you edit blocks, `main.js` is re-formatted in ZinoMake's style.
- Custom blocks (“My blocks”) have no inputs yet; variables are numbers or text (no lists).
- Projects you make are previewed as web pages; ZinoMake does not turn *your projects* into native apps.
- The ZinoMake iOS app is built unsigned; you must sign it yourself to install it. No Android app yet.
- Sound needs a click or tap inside the preview first (browser rule).
- Keyboard controls need the preview to have focus (click the game first).
- The preview sandbox (iframe without same-origin + no-network CSP + loop guard) is a strong
  isolation layer but not a perfect security boundary.
- There is no cloud sync, sharing link or one-click publishing; publishing means uploading an
  exported web page or the built site yourself.
- The “Describe it” helper only understands a few kinds of sentences.
- The block editor and code editor are large downloads (loaded only when a project opens).
- Browser end-to-end tests were run in Chromium only; Safari/Firefox are not automatically tested.

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/EXPORT_FORMAT.md](docs/EXPORT_FORMAT.md),
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).
