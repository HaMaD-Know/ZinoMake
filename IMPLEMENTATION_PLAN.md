# ZinoMake implementation plan & status

Stack: React 19 + TypeScript (strict) + Vite 7 · Blockly 12 · CodeMirror 6 · acorn · idb
(IndexedDB) · fflate (ZIP) · zustand (toasts) · Vitest · Playwright (browser tests).

Decisions:
- **CodeMirror 6 instead of Monaco** — much smaller, works well on touch devices, no web-worker
  setup; provides highlighting, line numbers, search, autocomplete, undo/redo and diagnostics.
- **acorn** as the JavaScript parser (small, maintained, gives exact source positions needed to
  keep unsupported code verbatim and to instrument loops).
- **Generator and parser operate on Blockly's JSON**, not a live workspace → pure and testable.
- **Unsupported code → “custom code” block** (statement-level, verbatim) instead of refusing
  to show blocks; nothing is ever dropped.
- **DOM-based 2D runtime** (absolutely positioned elements on a stage) shared by games,
  animations, apps and websites, rather than a separate canvas engine; collision uses element
  bounding boxes.

| Phase | Status |
| --- | --- |
| A Foundation: design system, dashboard, creation flow, IndexedDB, templates | ✅ done |
| B Visual coding: Blockly, 40+ blocks, code generation, workspace persistence, undo/redo, Add-block alternative | ✅ done |
| C Live execution: sandboxed preview, Play/Stop/Restart, device sizes, friendly errors, loop guard | ✅ done |
| D Text code: CodeMirror, parser, sync states, unsupported-code preservation, round-trip tests | ✅ done |
| E Project management: folders, files, assets, ZIP import/export, web-page export, conflict-safe autosave | ✅ done |
| F Quality: phone/tablet layouts, keyboard access, browser tests, docs | ✅ done (Chromium only) |

Templates (19, all verified to run and to convert fully to blocks): Click the Target, Collect
the Coins, Catch the Falling Apples, Simple Racing Game, Basic Platformer · Click Counter,
Simple Calculator, To-Do List, Timer, Simple Quiz · Personal Portfolio, Landing Page, Profile
Card, Event Page · Bouncing Ball, Moving Character, Animated Shapes, Interactive Story, Day and
Night Scene — plus a blank project per type.

## Next steps (most valuable first)

1. Inputs for “My blocks” (function parameters) and list variables.
2. Sprite/scene editor: place and resize objects visually instead of editing HTML/CSS.
3. Shareable links / optional cloud save (needs a backend and accounts — explicitly out of scope so far).
4. Optional AI assistant behind a server-side key, returning the same code the rule-based helper does.
5. Cross-browser automated tests (WebKit/Firefox) and a screen-reader audit of the Blockly workspace.
