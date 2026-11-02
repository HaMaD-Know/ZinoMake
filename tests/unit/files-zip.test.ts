import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8, zipSync, strToU8 } from 'fflate';
import { createProjectFromTemplate } from '../../src/model/createProject';
import { TEMPLATES } from '../../src/templates/templates';
import { buildTree, createFile, createFolder, deleteEntry, moveEntry, renameEntry, FileOpError } from '../../src/model/fileOps';
import { exportProjectZip, exportSourceZip, importProjectZip, ImportError } from '../../src/storage/projectZip';

const base = () => createProjectFromTemplate(TEMPLATES[0]);

describe('file operations', () => {
  it('creates folders and files, moves and renames them', () => {
    let p = createFolder(base(), '', 'scripts');
    p = createFile(p, 'scripts', 'helpers.js', '// hi');
    p = createFile(p, '', 'notes.txt', 'n');
    p = moveEntry(p, 'notes.txt', 'scripts');
    expect(p.files.some((f) => f.path === 'scripts/notes.txt')).toBe(true);
    p = renameEntry(p, 'scripts', 'code');
    expect(p.files.map((f) => f.path)).toContain('code/helpers.js');
    expect(p.files.map((f) => f.path)).toContain('code/notes.txt');
    const tree = buildTree(p.files);
    expect(tree[0].name).toBe('code');
    expect(tree[0].children.map((c) => c.name)).toEqual(['helpers.js', 'notes.txt']);
  });

  it('keeps the blocks link when main.js moves, and refuses to delete it', () => {
    let p = createFolder(base(), '', 'src');
    p = moveEntry(p, 'main.js', 'src');
    expect(p.blocksFile).toBe('src/main.js');
    expect(() => deleteEntry(p, 'src')).toThrow(FileOpError);
    expect(() => deleteEntry(p, 'src/main.js')).toThrow(FileOpError);
    p = deleteEntry(p, 'style.css');
    expect(p.files.some((f) => f.path === 'style.css')).toBe(false);
  });

  it('rejects bad names and duplicates', () => {
    expect(() => createFile(base(), '', 'a/b')).toThrow(FileOpError);
    expect(() => createFile(base(), '', '..')).toThrow(FileOpError);
    expect(() => createFile(base(), '', 'main.js')).toThrow(/already/);
    const p = createFolder(base(), '', 'x');
    expect(() => moveEntry(p, 'x', 'x')).toThrow(/inside itself/);
  });
});

describe('project ZIP export/import', () => {
  it('round-trips files, folders, block workspace, metadata and assets', () => {
    let p = createFolder(base(), '', 'extra');
    p = createFile(p, 'extra', 'data.txt', 'hello ✓');
    p = { ...p, assets: [{ id: 'a1', name: 'cat.png', mime: 'image/png', size: 3 }] };
    const zip = exportProjectZip(p, [{ id: 'a1', name: 'cat.png', mime: 'image/png', bytes: new Uint8Array([1, 2, 3]) }]);
    const back = importProjectZip(zip);
    expect(back.project.files).toEqual(p.files);
    expect(back.project.workspace).toEqual(p.workspace);
    expect(back.project.name).toBe(p.name);
    expect(back.project.syncState).toBe(p.syncState);
    expect(Array.from(back.assets[0].bytes)).toEqual([1, 2, 3]);
  });

  it('rejects invalid archives with a friendly message', () => {
    expect(() => importProjectZip(new Uint8Array([1, 2, 3]))).toThrow(ImportError);
    expect(() => importProjectZip(zipSync({ 'hello.txt': strToU8('x') }))).toThrow(/valid ZinoMake/);
    expect(() => importProjectZip(zipSync({ 'zinomake.json': strToU8('{oops') }))).toThrow(/damaged/);
    const newer = zipSync({ 'zinomake.json': strToU8(JSON.stringify({ format: 'zinomake-project', formatVersion: 9, project: {} })) });
    expect(() => importProjectZip(newer)).toThrow(/newer/);
  });

  it('ignores unsafe paths in archives', () => {
    const manifest = { format: 'zinomake-project', formatVersion: 1, project: { id: 'p', files: [{ path: '../evil.js', kind: 'file' }, { path: 'main.js', kind: 'file' }] } };
    const zip = zipSync({ 'zinomake.json': strToU8(JSON.stringify(manifest)), 'files/main.js': strToU8('say(1);') });
    expect(importProjectZip(zip).project.files.map((f) => f.path)).toEqual(['main.js']);
  });

  it('exports source files and a runnable standalone build', () => {
    const entries = unzipSync(exportSourceZip(base(), []));
    expect(Object.keys(entries).sort()).toEqual(['README.txt', 'build/index.html', 'source/index.html', 'source/main.js', 'source/style.css']);
    const html = strFromU8(entries['build/index.html']);
    expect(html).toContain('onClick("target"');
    expect(html).toContain('zinomake-runtime.js');
  });
});
