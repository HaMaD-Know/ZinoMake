import { codeToBlocks } from '../programming/parsers/codeToBlocks';
import { blocksToCode } from '../programming/generators/blocksToCode';
import type { Template } from '../templates/templates';
import { PROJECT_SCHEMA_VERSION, newId, type Project } from './project';

/** Build a fresh project from a template. The block workspace is derived from the template code. */
export function createProjectFromTemplate(t: Template, name?: string, now = Date.now()): Project {
  const conv = codeToBlocks(t.js);
  if (!conv.ok) throw new Error(`Template ${t.id} has a syntax error: ${conv.error.message}`);
  const synced = blocksToCode(conv.workspace) === t.js;
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: newId('proj'),
    name: name ?? (t.id.startsWith('blank-') ? 'My project' : t.name),
    type: t.type,
    templateId: t.id,
    description: t.description,
    createdAt: now,
    updatedAt: now,
    revision: 0,
    folderId: null,
    files: [
      { path: 'index.html', kind: 'file', content: t.html },
      { path: 'style.css', kind: 'file', content: t.css },
      { path: 'main.js', kind: 'file', content: t.js },
    ],
    blocksFile: 'main.js',
    workspace: conv.workspace,
    syncState: conv.unsupported.length ? 'unsupported' : synced ? 'in-sync' : 'code-edited',
    assets: [],
  };
}
