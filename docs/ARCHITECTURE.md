# ZinoMake architecture

```
src/
  app/            App shell, hash router, error boundary, toasts/preferences, project service
  pages/          HomePage (dashboard), CreatePage (Choose → Pick → Start), EditorPage (lazy)
  components/     Logo, icons, dialogs (confirm/prompt/choice), menus, thumbnails
  features/
    editor/       useProjectEditor: loading, debounced autosave, conflict handling, sync rules
    block-editor/ Blockly host component (inject, load, change events, Add-block insertion)
    code-editor/  CodeMirror 6 host (lazy chunk), diagnostics, ZinoMake autocomplete
    preview/      Sandboxed iframe preview, Play/Stop/Restart, device sizes, message console
    files/        Project file tree (create/rename/move/delete files and folders)
    assets/       Pictures & sounds (validation, IndexedDB blobs)
    helper/       Add-block dialog, “Describe it” helper, help, first-use tour
  model/          Project types, file-tree operations, project factory
  programming/
    blocks/       catalog.ts (single source of truth for blocks), register.ts (Blockly)
    generators/   blocksToCode.ts — workspace JSON → JavaScript (pure)
    parsers/      codeToBlocks.ts — JavaScript → workspace JSON via acorn (pure)
    assistant/    helper.ts — rule-based plain-English → code
  runtime/        zinoRuntime.js (injected into the preview), buildPreview.ts
  storage/        IndexedDB (idb), migrations, ZIP import/export (fflate)
  templates/      starter projects (designTemplates.ts: starters made in the Design view)
  design/         model.ts (design.json: screens, components, tree operations), render.ts (design → HTML/CSS)
  features/design DesignEditor: palette, layers, canvas, properties
```

## Design view

`design.json` holds a theme and a list of screens, each a tree of components (`src/design/model.ts`).
`renderDesign` turns it into plain HTML with one `.zm-screen` per screen; every component's
element id is its name, so blocks use designed things exactly like elements in `index.html`.
The same renderer feeds the preview, the exported page and the designer canvas. The canvas is an
`<iframe sandbox="allow-same-origin">` showing the sanitised page (no scripts run); the editor
attaches pointer listeners to select, drag (things on a stage) and resize. “When tapped” actions are
`data-zm-tap` attributes handled by the runtime, so navigation needs no code. Blocks add
`goToScreen`, `onScreen`, `onChange` and `setValue`.

## One shared representation

A `Project` (see `src/model/project.ts`) holds metadata, a flat file list, the Blockly
workspace JSON for the blocks file, the `syncState`, and asset references. The program that
actually runs is always the **text** of `main.js`; the workspace is a structured view of it.

`catalog.ts` describes every “call block” once (`fn`, arguments, shape). The Blockly
definitions, the generator and the parser are all derived from it, so a block can't exist in
one place but not the others. Generator and parser are pure functions over Blockly's JSON
format, so they are unit-tested in Node without a browser.

## Synchronisation

| Event | Result |
| --- | --- |
| Blocks change | `main.js` = `blocksToCode(workspace)`; state `in-sync` (or `unsupported` if custom-code blocks exist) |
| Code changes (debounced 350 ms) | text saved exactly as typed; parsed; on success the workspace is rebuilt (`in-sync`, `code-edited` or `unsupported`) |
| Code has a syntax error | text saved; workspace untouched; state `syntax-error`; block editor locked with “Fix it in Code” / “Use the blocks instead” |

Loads into Blockly are done with events disabled, so code → blocks never echoes back into
code (no update loops). Templates are stored as code and converted at creation; a test checks
every template converts with zero custom-code blocks and regenerates byte-for-byte.

## Persistence

IndexedDB database `zinomake` (version 1) with stores `projects`, `folders`, `assets`
(`byProject` index). Every project record has `schemaVersion` (migrated by
`migrateProject`) and `revision`. `saveProject` checks the stored revision inside the write
transaction and throws `ConflictError` instead of overwriting newer work (e.g. another tab);
the editor then offers “Keep my version” or “Load the other version”. Autosave is debounced
(700 ms) and flushed when the page is hidden or the editor closes. Small preferences
(theme, sort, tour dismissed) use `localStorage`. This is **local storage on this device only —
there is no cloud sync**.

## Preview sandbox

`buildPreviewDocument` assembles one HTML document (CSP meta, CSS, runtime, other JS files,
then `main.js` wrapped in an async function) and loads it with `<iframe sandbox="allow-scripts"
srcdoc=…>`:

* No `allow-same-origin`: user code runs in an opaque origin and can't read ZinoMake's
  IndexedDB/localStorage or touch the parent DOM.
* CSP `default-src 'none'` (inline scripts/styles, `data:` images/media only): no network.
* Loops are instrumented (via acorn positions) with `__zmGuard()`, which stops a loop that
  runs for ~3 s without yielding and reports a friendly message.
* Stop sends a stop message *and* removes the iframe.
* The parent accepts messages only from that iframe's window and only in known shapes
  (`validatePreviewMessage`).

Limitations: browsers may run the sandboxed frame in the same process as the app, so a
pathological program (e.g. huge allocations) can still slow the tab. The sandbox is a
reasonable isolation layer, not a security guarantee for hostile code.
