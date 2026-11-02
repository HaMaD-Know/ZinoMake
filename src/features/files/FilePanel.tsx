import { useState } from 'react';
import type { Project } from '../../model/project';
import { buildTree, createFile, createFolder, deleteEntry, FileOpError, listFolderPaths, moveEntry, renameEntry, type TreeNode } from '../../model/fileOps';
import { confirmDialog, promptDialog, Dialog } from '../../components/Dialog';
import { MenuButton } from '../../components/Menu';
import { Icon } from '../../components/Icon';
import { toast } from '../../app/ui-store';

interface Props {
  project: Project;
  activeFile: string;
  onOpen: (path: string) => void;
  onChange: (fn: (p: Project) => Project) => void;
}

const ICON: Record<string, string> = { js: '📜', html: '🌐', css: '🎨', txt: '📄', json: '🧾', md: '📝' };

export function FilePanel({ project, activeFile, onOpen, onChange }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState<string | null>(null);

  const apply = (fn: (p: Project) => Project): boolean => {
    try {
      const next = fn(project);
      onChange(() => next);
      return true;
    } catch (e) {
      toast(e instanceof FileOpError ? e.message : 'That didn’t work. Try again.', 'error');
      return false;
    }
  };

  const newFile = async (folder: string) => {
    const name = await promptDialog({ title: 'New file', label: 'File name (for example: notes.txt, helpers.js, extra.css)', confirm: 'Create file', initial: 'new.js' });
    if (!name) return;
    if (apply((p) => createFile(p, folder, name))) onOpen(folder ? `${folder}/${name.trim()}` : name.trim());
  };
  const newFolder = async (folder: string) => {
    const name = await promptDialog({ title: 'New folder', label: 'Folder name', confirm: 'Create folder' });
    if (name) apply((p) => createFolder(p, folder, name));
  };
  const rename = async (node: TreeNode) => {
    const name = await promptDialog({ title: `Rename “${node.name}”`, label: 'New name', initial: node.name });
    if (!name) return;
    const parent = node.path.includes('/') ? node.path.slice(0, node.path.lastIndexOf('/')) : '';
    if (apply((p) => renameEntry(p, node.path, name)) && (activeFile === node.path || activeFile.startsWith(node.path + '/'))) {
      onOpen((parent ? parent + '/' : '') + name.trim() + activeFile.slice(node.path.length));
    }
  };
  const remove = async (node: TreeNode) => {
    const ok = await confirmDialog({ title: `Delete “${node.name}”?`, message: node.kind === 'folder' ? 'The folder and everything inside it will be deleted.' : 'This file will be deleted.', confirm: 'Delete', danger: true });
    if (ok && apply((p) => deleteEntry(p, node.path)) && (activeFile === node.path || activeFile.startsWith(node.path + '/'))) onOpen(project.blocksFile);
  };

  const render = (nodes: TreeNode[]) => (
    <ul className="tree" role="group">
      {nodes.map((n) => {
        const ext = n.name.split('.').pop() ?? '';
        const isOpen = !collapsed.has(n.path);
        return (
          <li key={n.path} role="treeitem" aria-expanded={n.kind === 'folder' ? isOpen : undefined} aria-selected={n.path === activeFile}>
            <div className={`tree-row${n.path === activeFile ? ' active' : ''}`}>
              <button
                className="tree-item"
                onClick={() => {
                  if (n.kind === 'folder') setCollapsed((c) => { const s = new Set(c); if (s.has(n.path)) s.delete(n.path); else s.add(n.path); return s; });
                  else onOpen(n.path);
                }}
                aria-current={n.path === activeFile ? 'true' : undefined}
              >
                <span aria-hidden="true">{n.kind === 'folder' ? (isOpen ? '📂' : '📁') : ICON[ext] ?? '📄'}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.name}</span>
                {n.path === project.blocksFile && <span className="linked-tag" title="This file is linked to your blocks">blocks</span>}
              </button>
              <MenuButton label={`Options for ${n.name}`} className="btn btn-ghost btn-sm btn-icon tree-more" items={[
                ...(n.kind === 'folder' ? [{ label: 'New file here…', onSelect: () => void newFile(n.path) }, { label: 'New folder here…', onSelect: () => void newFolder(n.path) }] : [{ label: 'Open', onSelect: () => onOpen(n.path) }]),
                { label: 'Rename…', onSelect: () => void rename(n) },
                { label: 'Move to…', onSelect: () => setMoving(n.path) },
                { label: 'Delete…', onSelect: () => void remove(n), danger: true, separatorBefore: true },
              ]}><Icon name="more" size={18} /></MenuButton>
            </div>
            {n.kind === 'folder' && isOpen && n.children.length > 0 && render(n.children)}
          </li>
        );
      })}
    </ul>
  );

  const folders = listFolderPaths(project.files);
  return (
    <div>
      <div className="panel-head">
        <span className="grow">Files</span>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => void newFile('')} aria-label="New file" title="New file"><Icon name="file" size={18} /></button>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => void newFolder('')} aria-label="New folder" title="New folder"><Icon name="folder" size={18} /></button>
      </div>
      <div role="tree" aria-label="Project files">{render(buildTree(project.files))}</div>
      {moving && (
        <Dialog title={`Move “${moving.split('/').pop()}”`} onClose={() => setMoving(null)}>
          <div style={{ display: 'grid', gap: 8 }}>
            <button className="btn" onClick={() => { if (apply((p) => moveEntry(p, moving, ''))) onOpenIfMoved(moving, ''); setMoving(null); }}>Top level</button>
            {folders.filter((f) => f !== moving && !f.startsWith(moving + '/')).map((f) => (
              <button key={f} className="btn" onClick={() => { if (apply((p) => moveEntry(p, moving, f))) onOpenIfMoved(moving, f); setMoving(null); }}>📁 {f}</button>
            ))}
            {!folders.length && <p className="hint">Create a folder first with the folder button.</p>}
          </div>
        </Dialog>
      )}
    </div>
  );

  function onOpenIfMoved(from: string, folder: string) {
    if (activeFile === from || activeFile.startsWith(from + '/')) {
      const name = from.split('/').pop()!;
      onOpen((folder ? folder + '/' : '') + name + activeFile.slice(from.length));
    }
  }
}
