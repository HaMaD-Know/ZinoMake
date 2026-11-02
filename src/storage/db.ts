/**
 * Local persistence in IndexedDB (via the small `idb` wrapper).
 * This is LOCAL storage in this browser only — not cloud sync.
 *
 * Stores:
 *  - projects: Project records (text files + block workspace), keyPath "id"
 *  - folders:  dashboard folders, keyPath "id"
 *  - assets:   { id, projectId, blob } — binary data kept out of project records
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { DashboardFolder, Project } from '../model/project';
import { migrateProject } from './migrate';

export const DB_NAME = 'zinomake';
export const DB_VERSION = 1;

interface AssetRecord {
  id: string;
  projectId: string;
  blob: Blob;
}

interface ZinoDB extends DBSchema {
  projects: { key: string; value: Project };
  folders: { key: string; value: DashboardFolder };
  assets: { key: string; value: AssetRecord; indexes: { byProject: string } };
}

export class ConflictError extends Error {
  constructor(public stored: Project) {
    super('This project was changed somewhere else (maybe another tab).');
  }
}

let dbPromise: Promise<IDBPDatabase<ZinoDB>> | null = null;

export function db(): Promise<IDBPDatabase<ZinoDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ZinoDB>(DB_NAME, DB_VERSION, {
      upgrade(database, oldVersion) {
        // Versioned migrations: add a new `if (oldVersion < N)` block for each schema change.
        if (oldVersion < 1) {
          database.createObjectStore('projects', { keyPath: 'id' });
          database.createObjectStore('folders', { keyPath: 'id' });
          const assets = database.createObjectStore('assets', { keyPath: 'id' });
          assets.createIndex('byProject', 'projectId');
        }
      },
      blocking() {
        // A newer ZinoMake tab wants to upgrade: close so it can.
        void dbPromise?.then((d) => d.close());
        dbPromise = null;
      },
    });
  }
  return dbPromise;
}

/** For tests. */
export function resetDbConnection(): void {
  void dbPromise?.then((d) => d.close());
  dbPromise = null;
}

export async function listProjects(): Promise<{ projects: Project[]; damaged: number }> {
  const d = await db();
  const raw = await d.getAll('projects');
  const projects: Project[] = [];
  let damaged = 0;
  for (const r of raw) {
    const p = migrateProject(r);
    if (p) projects.push(p);
    else damaged++;
  }
  return { projects, damaged };
}

export async function getProject(id: string): Promise<Project | null> {
  const d = await db();
  const raw = await d.get('projects', id);
  return raw ? migrateProject(raw) : null;
}

export async function addProject(p: Project): Promise<Project> {
  const d = await db();
  await d.add('projects', p);
  return p;
}

/**
 * Save with optimistic concurrency: the stored revision must equal `p.revision`,
 * otherwise a ConflictError is thrown and nothing is written.
 */
export async function saveProject(p: Project): Promise<Project> {
  const d = await db();
  const tx = d.transaction('projects', 'readwrite');
  const stored = await tx.store.get(p.id);
  if (stored && stored.revision !== p.revision) {
    tx.abort();
    await tx.done.catch(() => undefined);
    throw new ConflictError(migrateProject(stored) ?? stored);
  }
  const next: Project = { ...p, revision: p.revision + 1, updatedAt: Date.now() };
  await tx.store.put(next);
  await tx.done;
  return next;
}

/** Metadata-only updates from the dashboard (rename, move); bumps the revision too. */
export async function updateProjectMeta(id: string, patch: Partial<Pick<Project, 'name' | 'folderId'>>): Promise<Project | null> {
  const d = await db();
  const tx = d.transaction('projects', 'readwrite');
  const stored = await tx.store.get(id);
  if (!stored) return null;
  const next = { ...stored, ...patch, revision: stored.revision + 1, updatedAt: Date.now() };
  await tx.store.put(next);
  await tx.done;
  return next;
}

export async function deleteProject(id: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(['projects', 'assets'], 'readwrite');
  await tx.objectStore('projects').delete(id);
  const keys = await tx.objectStore('assets').index('byProject').getAllKeys(id);
  for (const k of keys) await tx.objectStore('assets').delete(k);
  await tx.done;
}

export async function listFolders(): Promise<DashboardFolder[]> {
  const d = await db();
  return (await d.getAll('folders')).sort((a, b) => a.name.localeCompare(b.name));
}

export async function putFolder(f: DashboardFolder): Promise<void> {
  await (await db()).put('folders', f);
}

/** Delete a folder; its projects move back to the top level (they are never deleted). */
export async function deleteFolder(id: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(['folders', 'projects'], 'readwrite');
  await tx.objectStore('folders').delete(id);
  const all = await tx.objectStore('projects').getAll();
  for (const p of all) {
    if (p.folderId === id) await tx.objectStore('projects').put({ ...p, folderId: null, revision: p.revision + 1 });
  }
  await tx.done;
}

export async function putAsset(projectId: string, id: string, blob: Blob): Promise<void> {
  await (await db()).put('assets', { id, projectId, blob });
}

export async function getAsset(id: string): Promise<Blob | null> {
  const r = await (await db()).get('assets', id);
  return r?.blob ?? null;
}

export async function deleteAsset(id: string): Promise<void> {
  await (await db()).delete('assets', id);
}
