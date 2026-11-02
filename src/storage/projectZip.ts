/**
 * ZinoMake project archive format (.zinomake.zip), version 1:
 *
 *   zinomake.json      manifest: { format: "zinomake-project", formatVersion: 1, project: <Project without file contents> }
 *   files/<path>       every project text file, at its project path (folders are listed in the manifest)
 *   assets/<id>-<name> binary asset data
 *
 * See docs/EXPORT_FORMAT.md.
 */
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { PROJECT_SCHEMA_VERSION, type Project } from '../model/project';
import { migrateProject } from './migrate';
import { buildPreviewDocument } from '../runtime/buildPreview';

export const ARCHIVE_FORMAT = 'zinomake-project';
export const ARCHIVE_VERSION = 1;
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

export class ImportError extends Error {
  name = 'ImportError';
}

export interface AssetData {
  id: string;
  name: string;
  mime: string;
  bytes: Uint8Array;
}

export function exportProjectZip(project: Project, assets: AssetData[]): Uint8Array {
  const manifest = {
    format: ARCHIVE_FORMAT,
    formatVersion: ARCHIVE_VERSION,
    exportedAt: new Date().toISOString(),
    project: {
      ...project,
      files: project.files.map((f) => ({ path: f.path, kind: f.kind })),
    },
  };
  const entries: Zippable = { 'zinomake.json': strToU8(JSON.stringify(manifest, null, 2)) };
  for (const f of project.files) if (f.kind === 'file') entries[`files/${f.path}`] = strToU8(f.content);
  for (const a of assets) entries[`assets/${a.id}-${a.name}`] = a.bytes;
  return zipSync(entries, { level: 6 });
}

export interface ImportedProject {
  project: Project;
  assets: AssetData[];
}

function safePath(p: string): boolean {
  return !!p && !p.startsWith('/') && !p.split('/').some((s) => s === '..' || s === '');
}

export function importProjectZip(data: Uint8Array): ImportedProject {
  if (data.byteLength > MAX_IMPORT_BYTES) throw new ImportError('This file is too big to import (the limit is 50 MB).');
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(data);
  } catch {
    throw new ImportError('This file doesn’t look like a valid ZinoMake project.');
  }
  const manifestBytes = entries['zinomake.json'];
  if (!manifestBytes) throw new ImportError('This file doesn’t look like a valid ZinoMake project.');
  let manifest: { format?: unknown; formatVersion?: unknown; project?: Record<string, unknown> };
  try {
    manifest = JSON.parse(strFromU8(manifestBytes));
  } catch {
    throw new ImportError('This project file is damaged (its description can’t be read).');
  }
  if (manifest.format !== ARCHIVE_FORMAT || !manifest.project) throw new ImportError('This file doesn’t look like a valid ZinoMake project.');
  if (typeof manifest.formatVersion !== 'number' || manifest.formatVersion > ARCHIVE_VERSION) {
    throw new ImportError('This project was made with a newer version of ZinoMake.');
  }
  const rawFiles = Array.isArray(manifest.project.files) ? manifest.project.files : [];
  const files = [];
  for (const f of rawFiles as { path?: unknown; kind?: unknown }[]) {
    if (typeof f?.path !== 'string' || !safePath(f.path)) continue;
    if (f.kind === 'folder') files.push({ path: f.path, kind: 'folder', content: '' });
    else {
      const bytes = entries[`files/${f.path}`];
      files.push({ path: f.path, kind: 'file', content: bytes ? strFromU8(bytes) : '' });
    }
  }
  const project = migrateProject({ ...manifest.project, files, schemaVersion: Math.min(Number(manifest.project.schemaVersion) || 1, PROJECT_SCHEMA_VERSION) });
  if (!project) throw new ImportError('This project file is damaged and can’t be opened.');
  const assets: AssetData[] = [];
  for (const ref of project.assets) {
    const bytes = entries[`assets/${ref.id}-${ref.name}`];
    if (bytes) assets.push({ id: ref.id, name: ref.name, mime: ref.mime, bytes });
  }
  // Drop references to assets that were missing from the archive.
  project.assets = project.assets.filter((r) => assets.some((a) => a.id === r.id));
  return { project, assets };
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(bin)}`;
}

/** A single self-contained index.html that runs the project in any browser (no ZinoMake needed). */
export function exportStandaloneHtml(project: Project, assets: AssetData[]): string {
  const assetUrls: Record<string, string> = {};
  for (const a of assets) assetUrls[a.name] = bytesToDataUrl(a.bytes, a.mime);
  return buildPreviewDocument({ project, assetUrls });
}

/** A ZIP of plain source files (index.html, style.css, main.js, …) plus a runnable build. */
export function exportSourceZip(project: Project, assets: AssetData[]): Uint8Array {
  const entries: Zippable = {};
  for (const f of project.files) if (f.kind === 'file') entries[`source/${f.path}`] = strToU8(f.content);
  for (const a of assets) entries[`source/assets/${a.name}`] = a.bytes;
  entries['build/index.html'] = strToU8(exportStandaloneHtml(project, assets));
  entries['README.txt'] = strToU8(
    `${project.name} — exported from ZinoMake\n\nOpen build/index.html in a web browser to run it.\nThe source/ folder contains your files. main.js uses the ZinoMake runtime functions (say, move, onStart, …), which are included in build/index.html.\n`,
  );
  return zipSync(entries, { level: 6 });
}
