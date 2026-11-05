import { useEffect, useRef, useState } from 'react';
import { newId, type AssetRef, type Project } from '../../model/project';
import { deleteAsset, getAsset, putAsset } from '../../storage/db';
import { confirmDialog, promptDialog } from '../../components/Dialog';
import { Icon } from '../../components/Icon';
import { toast } from '../../app/ui-store';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
const AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/aac'];
const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_AUDIO = 10 * 1024 * 1024;

export function validateAsset(file: { name: string; type: string; size: number }): string | null {
  const isImage = IMAGE_TYPES.includes(file.type);
  const isAudio = AUDIO_TYPES.includes(file.type);
  if (!isImage && !isAudio) return `“${file.name}” can’t be used. Add a picture (PNG, JPG, GIF, WebP, SVG) or a sound (MP3, WAV, OGG).`;
  if (isImage && file.size > MAX_IMAGE) return `“${file.name}” is too big. Pictures can be up to 5 MB.`;
  if (isAudio && file.size > MAX_AUDIO) return `“${file.name}” is too big. Sounds can be up to 10 MB.`;
  return null;
}

export function cleanAssetName(name: string): string {
  return name.trim().replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-').slice(0, 60) || 'file';
}

function uniqueName(name: string, taken: string[]): string {
  if (!taken.includes(name)) return name;
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let i = 2; ; i++) if (!taken.includes(`${stem}-${i}${ext}`)) return `${stem}-${i}${ext}`;
}

export function AssetsPanel({ project, onChange, onUse }: { project: Project; onChange: (fn: (p: Project) => Project) => void; onUse?: (asset: AssetRef) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    (async () => {
      const next: Record<string, string> = {};
      for (const a of project.assets) {
        const blob = await getAsset(a.id);
        if (blob && a.mime.startsWith('image/')) {
          const u = URL.createObjectURL(blob);
          made.push(u);
          next[a.id] = u;
        }
      }
      if (alive) setUrls(next);
    })();
    return () => {
      alive = false;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [project.assets]);

  const add = async (files: FileList | null) => {
    if (!files) return;
    const added: AssetRef[] = [];
    const taken = project.assets.map((a) => a.name);
    for (const f of Array.from(files)) {
      const err = validateAsset(f);
      if (err) {
        toast(err, 'error');
        continue;
      }
      const ref: AssetRef = { id: newId('asset'), name: uniqueName(cleanAssetName(f.name), [...taken, ...added.map((a) => a.name)]), mime: f.type, size: f.size };
      try {
        await putAsset(project.id, ref.id, f);
        added.push(ref);
      } catch (e) {
        console.error('[ZinoMake] could not store asset', e);
        toast(`“${f.name}” couldn’t be saved. Your browser may be out of storage space.`, 'error');
      }
    }
    if (added.length) {
      onChange((p) => ({ ...p, assets: [...p.assets, ...added] }));
      toast(added.length === 1 ? `Added “${added[0].name}”.` : `Added ${added.length} files.`);
    }
  };

  const rename = async (a: AssetRef) => {
    const name = await promptDialog({
      title: 'Rename file', label: 'New name', initial: a.name,
      validate: (v) => (!v.trim() ? 'Please type a name.' : project.assets.some((x) => x.id !== a.id && x.name === cleanAssetName(v)) ? 'Another file already has that name.' : null),
    });
    if (!name) return;
    onChange((p) => ({ ...p, assets: p.assets.map((x) => (x.id === a.id ? { ...x, name: cleanAssetName(name) } : x)) }));
    toast('Renamed. Remember to update blocks that use the old name.');
  };

  const remove = async (a: AssetRef) => {
    if (!(await confirmDialog({ title: `Remove “${a.name}”?`, message: 'Blocks or pages that use this file will show a “could not be loaded” message.', confirm: 'Remove', danger: true }))) return;
    onChange((p) => ({ ...p, assets: p.assets.filter((x) => x.id !== a.id) }));
    await deleteAsset(a.id).catch(() => undefined);
  };

  return (
    <div>
      <div className="panel-head">
        <span className="grow">Pictures &amp; sounds</span>
        <button className="btn btn-ghost btn-sm" onClick={() => input.current?.click()}><Icon name="plus" size={18} /> Add</button>
        <input ref={input} type="file" multiple hidden accept={[...IMAGE_TYPES, ...AUDIO_TYPES].join(',')} onChange={(e) => { void add(e.target.files); e.target.value = ''; }} aria-label="Add pictures or sounds" />
      </div>
      <div className="asset-list">
        {project.assets.length === 0 && <p className="hint" style={{ margin: '0 4px' }}>Add your own pictures and sounds. Then press <strong>＋ Add to stage</strong> on a picture, or pick it in any picture or sound block.</p>}
        {project.assets.map((a) => (
          <div key={a.id} className="asset">
            {urls[a.id] ? <img src={urls[a.id]} alt="" /> : <span className="asset-icon" aria-hidden="true">{a.mime.startsWith('audio/') ? '🔊' : '🖼'}</span>}
            <span className="name">{a.name}<br /><span className="hint">{Math.ceil(a.size / 1024)} KB</span></span>
            {onUse && (
              <button className="btn btn-sm asset-use" onClick={() => onUse(a)} title={a.mime.startsWith('audio/') ? 'Add a “play audio file” block' : 'Add a block that puts this picture on the stage'} aria-label={a.mime.startsWith('audio/') ? `Play ${a.name} in blocks` : `Add ${a.name} to the stage`}>
                {a.mime.startsWith('audio/') ? '＋ Play' : '＋ Add to stage'}
              </button>
            )}
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => void rename(a)} aria-label={`Rename ${a.name}`} title="Rename">✎</button>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => void remove(a)} aria-label={`Remove ${a.name}`} title="Remove"><Icon name="trash" size={18} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
