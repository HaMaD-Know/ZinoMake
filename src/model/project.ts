/**
 * ZinoMake shared project representation.
 *
 * A project is a small, serialisable bundle:
 *  - metadata (name, type, timestamps, folder on the dashboard)
 *  - a flat list of file-tree entries (files and folders, addressed by path)
 *  - the Blockly workspace state for the "blocks file" (normally main.js)
 *  - references to assets (binary data lives in a separate IndexedDB store)
 *
 * The JavaScript in the blocks file is the executable program. The block
 * workspace is a *view* of the supported subset of that JavaScript: blocks are
 * converted to code by `blocksToCode` and code back to blocks by `codeToBlocks`.
 */

export const PROJECT_SCHEMA_VERSION = 1;

export type ProjectType = 'game' | 'app' | 'website' | 'animation';

export const PROJECT_TYPES: readonly ProjectType[] = ['game', 'app', 'website', 'animation'];

export interface FileEntry {
  /** Path inside the project, using "/" separators, no leading slash. e.g. "scripts/helpers.js" */
  path: string;
  kind: 'file' | 'folder';
  /** Text content for files. Folders have an empty string. */
  content: string;
}

export interface AssetRef {
  id: string;
  /** File name the user sees and references from code, e.g. "cat.png" */
  name: string;
  mime: string;
  size: number;
}

/** Synchronisation state between the block workspace and the blocks file's code. */
export type SyncState =
  | 'in-sync' // code is exactly what the blocks generate
  | 'unsupported' // code converted, but some parts are shown as "custom code" blocks
  | 'syntax-error' // code can't be parsed; blocks show the last valid version and are locked
  | 'code-edited'; // code changed and was converted to blocks (code text kept as typed)

/** Blockly JSON serialisation (Blockly.serialization.workspaces.save). Kept loosely typed on purpose. */
export interface BlockState {
  type: string;
  id?: string;
  x?: number;
  y?: number;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: BlockState; shadow?: BlockState }>;
  next?: { block?: BlockState; shadow?: BlockState };
  extraState?: unknown;
  enabled?: boolean;
  disabledReasons?: string[];
  [key: string]: unknown;
}

export interface WorkspaceState {
  blocks?: { languageVersion: number; blocks: BlockState[] };
  variables?: { name: string; id: string; type?: string }[];
  [key: string]: unknown;
}

export interface Project {
  schemaVersion: number;
  id: string;
  name: string;
  type: ProjectType;
  templateId: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  /** Incremented on every successful save; used to detect conflicting writes. */
  revision: number;
  /** Dashboard folder id, or null for the top level. */
  folderId: string | null;
  files: FileEntry[];
  /** Path of the file that the block workspace represents. */
  blocksFile: string;
  workspace: WorkspaceState | null;
  syncState: SyncState;
  assets: AssetRef[];
}

export interface DashboardFolder {
  id: string;
  name: string;
  createdAt: number;
}

export function newId(prefix = 'id'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 18);
  return `${prefix}_${rand}`;
}

export function getFile(project: Project, path: string): FileEntry | undefined {
  return project.files.find((f) => f.kind === 'file' && f.path === path);
}

export function getFileContent(project: Project, path: string): string {
  return getFile(project, path)?.content ?? '';
}
