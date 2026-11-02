import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ConflictError, addProject, deleteFolder, deleteProject, getAsset, getProject, listFolders, listProjects,
  putAsset, putFolder, resetDbConnection, saveProject, updateProjectMeta, db,
} from '../../src/storage/db';
import { migrateProject } from '../../src/storage/migrate';
import { createProjectFromTemplate } from '../../src/model/createProject';
import { TEMPLATES } from '../../src/templates/templates';

beforeEach(async () => {
  const d = await db();
  await d.clear('projects');
  await d.clear('folders');
  await d.clear('assets');
});

describe('IndexedDB storage', () => {
  it('saves and recovers a project after reconnecting (like a refresh)', async () => {
    const p = createProjectFromTemplate(TEMPLATES[0]);
    await addProject(p);
    const edited = { ...p, files: p.files.map((f) => (f.path === 'main.js' ? { ...f, content: 'say("x");\n' } : f)) };
    const saved = await saveProject(edited);
    expect(saved.revision).toBe(1);
    resetDbConnection();
    const back = await getProject(p.id);
    expect(back?.files.find((f) => f.path === 'main.js')?.content).toBe('say("x");\n');
    expect(back?.revision).toBe(1);
  });

  it('refuses to overwrite a newer version', async () => {
    const p = createProjectFromTemplate(TEMPLATES[0]);
    await addProject(p);
    await saveProject(p); // revision 0 -> 1 (e.g. another tab)
    await expect(saveProject({ ...p, name: 'stale' })).rejects.toBeInstanceOf(ConflictError);
    expect((await getProject(p.id))?.name).toBe(p.name);
  });

  it('handles folders: deleting a folder keeps its projects', async () => {
    const p = createProjectFromTemplate(TEMPLATES[1]);
    await addProject(p);
    await putFolder({ id: 'f1', name: 'School', createdAt: 1 });
    await updateProjectMeta(p.id, { folderId: 'f1', name: 'Renamed' });
    expect((await getProject(p.id))?.folderId).toBe('f1');
    await deleteFolder('f1');
    expect(await listFolders()).toEqual([]);
    const back = await getProject(p.id);
    expect(back?.folderId).toBeNull();
    expect(back?.name).toBe('Renamed');
  });

  it('stores assets separately and deletes them with the project', async () => {
    const p = createProjectFromTemplate(TEMPLATES[2]);
    await addProject(p);
    await putAsset(p.id, 'a1', new Blob(['hello'], { type: 'text/plain' }));
    expect(await getAsset('a1')).not.toBeNull();
    await deleteProject(p.id);
    expect(await getAsset('a1')).toBeNull();
    expect((await listProjects()).projects).toEqual([]);
  });

  it('skips damaged records instead of crashing', async () => {
    const d = await db();
    await d.put('projects', { id: 'bad', nonsense: true } as never);
    const r = await listProjects();
    expect(r.damaged).toBe(1);
  });
});

describe('migration', () => {
  it('upgrades a record without schemaVersion and repairs missing fields', () => {
    const p = migrateProject({ id: 'x', files: [{ path: '/main.js', content: 'say(1);' }, { bogus: 1 }] });
    expect(p?.schemaVersion).toBe(1);
    expect(p?.files).toEqual([{ path: 'main.js', kind: 'file', content: 'say(1);' }]);
    expect(p?.name).toBe('Untitled project');
  });
  it('rejects records from a newer version and garbage', () => {
    expect(migrateProject({ id: 'x', files: [], schemaVersion: 99 })).toBeNull();
    expect(migrateProject('hello')).toBeNull();
    expect(migrateProject(null)).toBeNull();
  });
});
