# ZinoMake project archive (`.zinomake.zip`), format version 1

```
zinomake.json        manifest (UTF-8 JSON)
files/<path>         each text file in the project, at its project path
assets/<id>-<name>   each picture or sound, raw bytes
```

`zinomake.json`:

```json
{
  "format": "zinomake-project",
  "formatVersion": 1,
  "exportedAt": "2026-11-02T10:00:00.000Z",
  "project": {
    "schemaVersion": 1,
    "id": "proj_…", "name": "…", "type": "game|app|website|animation",
    "templateId": "…", "description": "…", "createdAt": 0, "updatedAt": 0, "revision": 3,
    "folderId": null,
    "files": [{ "path": "index.html", "kind": "file" }, { "path": "scripts", "kind": "folder" }],
    "blocksFile": "main.js",
    "workspace": { "blocks": { … }, "variables": [ … ] },
    "syncState": "in-sync",
    "assets": [{ "id": "asset_…", "name": "cat.png", "mime": "image/png", "size": 1234 }]
  }
}
```

`workspace` is Blockly's JSON serialisation of the block workspace.

## Import rules

* The file must be a ZIP containing `zinomake.json` with `format: "zinomake-project"`.
* Archives from a newer `formatVersion` are refused with a clear message.
* Paths containing `..`, empty segments or a leading `/` are ignored.
* Missing or damaged fields are repaired with safe defaults (see `src/storage/migrate.ts`).
* Imports are limited to 50 MB.
* If a project with the same id already exists, ZinoMake asks whether to keep both or replace.

## Other downloads

* **Download web page (.html)** — one self-contained HTML file that runs the project in any
  browser (runtime, CSS, code and pictures inlined).
* **Download source files (.zip)** — `source/` (your files and assets) plus `build/index.html`.
