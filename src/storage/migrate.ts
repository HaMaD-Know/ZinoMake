import { PROJECT_SCHEMA_VERSION, PROJECT_TYPES, type FileEntry, type Project, type SyncState } from '../model/project';

const SYNC_STATES: SyncState[] = ['in-sync', 'unsupported', 'syntax-error', 'code-edited'];

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Validate and upgrade a stored or imported project record.
 * Returns null when the data is too damaged to use. Never throws.
 *
 * Migration history:
 *  - (no schemaVersion): pre-release records — treated as version 1 if the shape matches.
 *  - 1: current.
 */
export function migrateProject(raw: unknown): Project | null {
  if (!isObj(raw)) return null;
  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1;
  if (version > PROJECT_SCHEMA_VERSION) return null; // made by a newer ZinoMake; don't guess
  if (typeof raw.id !== 'string' || !raw.id) return null;
  if (!Array.isArray(raw.files)) return null;
  const files: FileEntry[] = [];
  for (const f of raw.files) {
    if (!isObj(f) || typeof f.path !== 'string' || !f.path) continue;
    const kind = f.kind === 'folder' ? 'folder' : 'file';
    files.push({ path: f.path.replace(/^\/+/, ''), kind, content: kind === 'file' && typeof f.content === 'string' ? f.content : '' });
  }
  const type = PROJECT_TYPES.includes(raw.type as never) ? (raw.type as Project['type']) : 'app';
  const now = Date.now();
  const blocksFile = typeof raw.blocksFile === 'string' && files.some((f) => f.path === raw.blocksFile) ? raw.blocksFile : 'main.js';
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: raw.id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.slice(0, 120) : 'Untitled project',
    type,
    templateId: typeof raw.templateId === 'string' ? raw.templateId : `blank-${type}`,
    description: typeof raw.description === 'string' ? raw.description : '',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now,
    revision: typeof raw.revision === 'number' ? raw.revision : 0,
    folderId: typeof raw.folderId === 'string' ? raw.folderId : null,
    files,
    blocksFile,
    workspace: isObj(raw.workspace) ? (raw.workspace as Project['workspace']) : null,
    syncState: SYNC_STATES.includes(raw.syncState as SyncState) ? (raw.syncState as SyncState) : 'code-edited',
    assets: Array.isArray(raw.assets)
      ? raw.assets.filter((a): a is Project['assets'][number] => isObj(a) && typeof a.id === 'string' && typeof a.name === 'string')
          .map((a) => ({ id: a.id, name: a.name, mime: typeof a.mime === 'string' ? a.mime : 'application/octet-stream', size: typeof a.size === 'number' ? a.size : 0 }))
      : [],
  };
}
