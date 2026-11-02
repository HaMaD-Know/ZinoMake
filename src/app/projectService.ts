/** App-level project operations combining storage, templates and archives. */
import { createProjectFromTemplate } from '../model/createProject';
import { newId, type Project } from '../model/project';
import { findTemplate } from '../templates/templates';
import { addProject, deleteAsset, getAsset, getProject, putAsset, saveProject } from '../storage/db';
import { exportProjectZip, exportSourceZip, exportStandaloneHtml, importProjectZip, type AssetData } from '../storage/projectZip';
import { choiceDialog } from '../components/Dialog';

export async function createFromTemplate(templateId: string, name?: string): Promise<Project> {
  const t = findTemplate(templateId);
  if (!t) throw new Error('That template could not be found.');
  const p = createProjectFromTemplate(t, name?.trim() || undefined);
  await addProject(p);
  return p;
}

export async function loadAssetData(p: Project): Promise<AssetData[]> {
  const out: AssetData[] = [];
  for (const a of p.assets) {
    const blob = await getAsset(a.id);
    if (blob) out.push({ id: a.id, name: a.name, mime: a.mime, bytes: new Uint8Array(await blob.arrayBuffer()) });
  }
  return out;
}

export async function assetDataUrls(p: Project): Promise<{ urls: Record<string, string>; missing: string[] }> {
  const urls: Record<string, string> = {};
  const missing: string[] = [];
  for (const a of p.assets) {
    const blob = await getAsset(a.id);
    if (!blob) {
      missing.push(a.name);
      continue;
    }
    urls[a.name] = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }
  return { urls, missing };
}

async function copyAssets(from: Project, to: Project, data?: AssetData[]): Promise<Project> {
  const src = data ?? (await loadAssetData(from));
  const refs = [];
  for (const a of src) {
    const id = newId('asset');
    await putAsset(to.id, id, new Blob([a.bytes as BlobPart], { type: a.mime }));
    refs.push({ id, name: a.name, mime: a.mime, size: a.bytes.byteLength });
  }
  return { ...to, assets: refs };
}

export async function duplicateProject(id: string): Promise<Project | null> {
  const p = await getProject(id);
  if (!p) return null;
  const now = Date.now();
  let copy: Project = { ...structuredClone(p), id: newId('proj'), name: `${p.name} (copy)`, createdAt: now, updatedAt: now, revision: 0, assets: [] };
  copy = await copyAssets(p, copy);
  await addProject(copy);
  return copy;
}

export function downloadBytes(bytes: Uint8Array | string, filename: string, mime: string): void {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function fileSafe(name: string): string {
  return name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'project';
}

export async function exportProject(p: Project): Promise<void> {
  downloadBytes(exportProjectZip(p, await loadAssetData(p)), `${fileSafe(p.name)}.zinomake.zip`, 'application/zip');
}

export async function exportSource(p: Project): Promise<void> {
  downloadBytes(exportSourceZip(p, await loadAssetData(p)), `${fileSafe(p.name)}-source.zip`, 'application/zip');
}

export async function exportWebPage(p: Project): Promise<void> {
  downloadBytes(exportStandaloneHtml(p, await loadAssetData(p)), `${fileSafe(p.name)}.html`, 'text/html');
}

/** Import an exported archive. Asks before replacing a project that already exists. Returns the new project or null if cancelled. */
export async function importProjectFile(file: File): Promise<Project | null> {
  const { project, assets } = importProjectZip(new Uint8Array(await file.arrayBuffer()));
  const existing = await getProject(project.id);
  const now = Date.now();
  if (existing) {
    const choice = await choiceDialog({
      title: 'This project is already here',
      message: `“${existing.name}” is already in My Projects. Do you want to keep both, or replace the one you have with the imported file?`,
      choices: [
        { value: 'replace', label: 'Replace mine', danger: true },
        { value: 'copy', label: 'Keep both', primary: true },
      ],
    });
    if (!choice) return null;
    if (choice === 'replace') {
      for (const a of existing.assets) await deleteAsset(a.id);
      let replaced: Project = { ...project, revision: existing.revision, folderId: existing.folderId, assets: [] };
      replaced = await copyAssets(project, replaced, assets);
      return saveProject(replaced);
    }
    let copy: Project = { ...project, id: newId('proj'), name: `${project.name} (imported)`, createdAt: now, updatedAt: now, revision: 0, folderId: null, assets: [] };
    copy = await copyAssets(project, copy, assets);
    await addProject(copy);
    return copy;
  }
  let fresh: Project = { ...project, revision: 0, folderId: null, updatedAt: now, assets: [] };
  fresh = await copyAssets(project, fresh, assets);
  await addProject(fresh);
  return fresh;
}
