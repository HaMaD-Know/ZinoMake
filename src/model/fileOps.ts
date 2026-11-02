/** Pure, immutable operations on a project's file tree. Each throws FileOpError with a friendly message. */
import type { FileEntry, Project } from './project';

export class FileOpError extends Error {}

export function parentOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}

export function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

export function joinPath(folder: string, name: string): string {
  return folder ? `${folder}/${name}` : name;
}

export function validateName(name: string): string {
  const n = name.trim();
  if (!n) throw new FileOpError('Please type a name.');
  if (n.length > 80) throw new FileOpError('That name is too long.');
  if (/[\\/:*?"<>|]/.test(n)) throw new FileOpError('Names can’t contain / \\ : * ? " < > or |.');
  if (n === '.' || n === '..' || n.startsWith('.')) throw new FileOpError('Names can’t start with a dot.');
  return n;
}

function exists(p: Project, path: string): FileEntry | undefined {
  return p.files.find((f) => f.path === path);
}

function ensureFolders(files: FileEntry[], folder: string): FileEntry[] {
  if (!folder) return files;
  const out = [...files];
  const parts = folder.split('/');
  for (let i = 1; i <= parts.length; i++) {
    const path = parts.slice(0, i).join('/');
    const e = out.find((f) => f.path === path);
    if (e && e.kind === 'file') throw new FileOpError(`“${path}” is a file, not a folder.`);
    if (!e) out.push({ path, kind: 'folder', content: '' });
  }
  return out;
}

export function createFile(p: Project, folder: string, name: string, content = ''): Project {
  const path = joinPath(folder, validateName(name));
  if (exists(p, path)) throw new FileOpError(`There is already something called “${baseName(path)}” here.`);
  return { ...p, files: [...ensureFolders(p.files, folder), { path, kind: 'file', content }] };
}

export function createFolder(p: Project, folder: string, name: string): Project {
  const path = joinPath(folder, validateName(name));
  if (exists(p, path)) throw new FileOpError(`There is already something called “${baseName(path)}” here.`);
  return { ...p, files: [...ensureFolders(p.files, folder), { path, kind: 'folder', content: '' }] };
}

function isInside(path: string, folder: string): boolean {
  return path === folder || path.startsWith(folder + '/');
}

function relocate(p: Project, from: string, to: string): Project {
  if (from === to) return p;
  const entry = exists(p, from);
  if (!entry) throw new FileOpError('That file no longer exists.');
  if (exists(p, to)) throw new FileOpError(`There is already something called “${baseName(to)}” there.`);
  if (entry.kind === 'folder' && isInside(to, from)) throw new FileOpError('A folder can’t be moved inside itself.');
  const files = ensureFolders(p.files, parentOf(to)).map((f) =>
    isInside(f.path, from) ? { ...f, path: to + f.path.slice(from.length) } : f,
  );
  const blocksFile = isInside(p.blocksFile, from) ? to + p.blocksFile.slice(from.length) : p.blocksFile;
  return { ...p, files, blocksFile };
}

export function renameEntry(p: Project, path: string, newName: string): Project {
  return relocate(p, path, joinPath(parentOf(path), validateName(newName)));
}

export function moveEntry(p: Project, path: string, targetFolder: string): Project {
  if (targetFolder && exists(p, targetFolder)?.kind !== 'folder') throw new FileOpError('Choose a folder to move into.');
  return relocate(p, path, joinPath(targetFolder, baseName(path)));
}

export function deleteEntry(p: Project, path: string): Project {
  const entry = exists(p, path);
  if (!entry) return p;
  if (isInside(p.blocksFile, path)) {
    throw new FileOpError(`“${baseName(p.blocksFile)}” is linked to your blocks, so it can’t be deleted.`);
  }
  return { ...p, files: p.files.filter((f) => !isInside(f.path, path)) };
}

export function updateFileContent(p: Project, path: string, content: string): Project {
  return { ...p, files: p.files.map((f) => (f.path === path && f.kind === 'file' ? { ...f, content } : f)) };
}

export interface TreeNode {
  path: string;
  name: string;
  kind: 'file' | 'folder';
  children: TreeNode[];
}

/** Sorted tree: folders first, then files, alphabetically. */
export function buildTree(files: FileEntry[]): TreeNode[] {
  const root: TreeNode = { path: '', name: '', kind: 'folder', children: [] };
  const byPath = new Map<string, TreeNode>([['', root]]);
  const sorted = [...files].sort((a, b) => a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path));
  for (const f of sorted) {
    const parentPath = parentOf(f.path);
    let parent = byPath.get(parentPath);
    if (!parent) {
      parent = { path: parentPath, name: baseName(parentPath), kind: 'folder', children: [] };
      byPath.set(parentPath, parent);
      root.children.push(parent);
    }
    const node: TreeNode = { path: f.path, name: baseName(f.path), kind: f.kind, children: [] };
    byPath.set(f.path, node);
    parent.children.push(node);
  }
  const sortRec = (n: TreeNode) => {
    n.children.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'folder' ? -1 : 1));
    n.children.forEach(sortRec);
  };
  sortRec(root);
  return root.children;
}

export function listFolderPaths(files: FileEntry[]): string[] {
  return files.filter((f) => f.kind === 'folder').map((f) => f.path).sort();
}
