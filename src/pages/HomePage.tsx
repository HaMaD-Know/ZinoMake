import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Logo } from '../components/Logo';
import { Icon } from '../components/Icon';
import { MenuButton } from '../components/Menu';
import { Thumb, TYPE_LABEL, timeAgo } from '../components/Thumb';
import { confirmDialog, promptDialog, Dialog } from '../components/Dialog';
import { navigate } from '../app/App';
import { applyTheme, readPref, toast, writePref, type ThemePref } from '../app/ui-store';
import { TEMPLATES } from '../templates/templates';
import { deleteFolder, deleteProject, listFolders, listProjects, putFolder, updateProjectMeta } from '../storage/db';
import { newId, type DashboardFolder, type Project } from '../model/project';

// Heavier code (parser, ZIP) loads only when needed.
const service = () => import('../app/projectService');

const FEATURED = ['game-click-target', 'app-counter', 'web-profile-card', 'anim-bouncing-ball'];

type Sort = 'recent' | 'name';

export function HomePage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [folders, setFolders] = useState<DashboardFolder[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>(() => readPref<Sort>('sort', 'recent'));
  const [folder, setFolder] = useState<string | 'all' | 'none'>('all');
  const [moving, setMoving] = useState<Project | null>(null);
  const [theme, setTheme] = useState<ThemePref>(() => readPref<ThemePref>('theme', 'light'));
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [{ projects: ps, damaged }, fs] = await Promise.all([listProjects(), listFolders()]);
      setProjects(ps);
      setFolders(fs);
      if (damaged) toast(`${damaged} saved project${damaged > 1 ? 's' : ''} could not be read and ${damaged > 1 ? 'were' : 'was'} skipped.`, 'error');
    } catch (e) {
      console.error('[ZinoMake] could not load projects', e);
      setLoadError('Your projects couldn’t be loaded. Your browser may be blocking storage (for example in private browsing).');
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => writePref('sort', sort), [sort]);

  const visible = useMemo(() => {
    let list = projects ?? [];
    if (folder === 'none') list = list.filter((p) => !p.folderId);
    else if (folder !== 'all') list = list.filter((p) => p.folderId === folder);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || TYPE_LABEL[p.type].toLowerCase().includes(q));
    return [...list].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : b.updatedAt - a.updatedAt));
  }, [projects, folder, query, sort]);

  const recent = useMemo(() => [...(projects ?? [])].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4), [projects]);

  const rename = async (p: Project) => {
    const name = await promptDialog({ title: 'Rename project', label: 'Project name', initial: p.name, validate: (v) => (v.trim() ? (v.length > 80 ? 'That name is too long.' : null) : 'Please type a name.') });
    if (!name) return;
    await updateProjectMeta(p.id, { name });
    void refresh();
  };
  const duplicate = async (p: Project) => {
    const copy = await (await service()).duplicateProject(p.id);
    if (copy) toast(`Made a copy: “${copy.name}”`);
    void refresh();
  };
  const remove = async (p: Project) => {
    const ok = await confirmDialog({ title: 'Delete this project?', message: <>“{p.name}” and its files will be deleted from this browser. This can’t be undone. <br /><br /><span className="hint">Tip: Export it first if you might want it later.</span></>, confirm: 'Delete', danger: true });
    if (!ok) return;
    await deleteProject(p.id);
    toast('Project deleted.');
    void refresh();
  };
  const newFolder = async () => {
    const name = await promptDialog({ title: 'New folder', label: 'Folder name', confirm: 'Create folder' });
    if (!name) return;
    const f = { id: newId('folder'), name: name.slice(0, 60), createdAt: Date.now() };
    await putFolder(f);
    setFolder(f.id);
    void refresh();
  };
  const renameFolder = async (f: DashboardFolder) => {
    const name = await promptDialog({ title: 'Rename folder', label: 'Folder name', initial: f.name });
    if (!name) return;
    await putFolder({ ...f, name: name.slice(0, 60) });
    void refresh();
  };
  const removeFolder = async (f: DashboardFolder) => {
    const ok = await confirmDialog({ title: 'Delete this folder?', message: `The folder “${f.name}” will be removed. The projects inside it are kept and moved back to “No folder”.`, confirm: 'Delete folder', danger: true });
    if (!ok) return;
    await deleteFolder(f.id);
    setFolder('all');
    void refresh();
  };
  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const p = await (await service()).importProjectFile(file);
      if (p) {
        toast(`Imported “${p.name}”.`);
        void refresh();
      }
    } catch (e) {
      toast(e instanceof Error && e.name === 'ImportError' ? e.message : 'This file doesn’t look like a valid ZinoMake project.', 'error');
      console.error('[ZinoMake] import failed', e);
    }
  };
  const toggleTheme = () => {
    const next: ThemePref = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
    writePref('theme', next);
  };

  const card = (p: Project) => (
    <li key={p.id} className="card" style={{ listStyle: 'none' }}>
      <a className="card-button" href={`#/p/${p.id}`} aria-label={`Open ${p.name}`}>
        <Thumb templateId={p.templateId} type={p.type} />
        <div className="card-body">
          <h3>{p.name}</h3>
          <div className="card-meta">{TYPE_LABEL[p.type]} · edited {timeAgo(p.updatedAt)}{p.folderId && folders.find((f) => f.id === p.folderId) ? ` · 📁 ${folders.find((f) => f.id === p.folderId)!.name}` : ''}</div>
        </div>
      </a>
      <div className="card-menu-btn" style={{ position: 'absolute', right: 8, top: 8, background: 'transparent' }}>
        <MenuButton label={`Options for ${p.name}`} className="btn btn-sm btn-icon card-menu-btn" items={[
          { label: 'Open', onSelect: () => navigate(`#/p/${p.id}`) },
          { label: 'Rename…', onSelect: () => void rename(p) },
          { label: 'Duplicate', onSelect: () => void duplicate(p) },
          { label: 'Move to folder…', onSelect: () => setMoving(p) },
          { label: 'Export (.zip)', onSelect: () => void service().then((m) => m.exportProject(p)).catch((e) => { console.error('[ZinoMake] export failed', e); toast('The file couldn’t be saved. Try again.', 'error'); }) },
          { label: 'Delete…', onSelect: () => void remove(p), danger: true, separatorBefore: true },
        ]}>
          <Icon name="more" />
        </MenuButton>
      </div>
    </li>
  );

  return (
    <div className="page">
      <header className="topnav">
        <Logo />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-icon" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'} title="Light / dark theme">
            <Icon name="moon" />
          </button>
          <button className="btn" onClick={() => fileInput.current?.click()}>
            <Icon name="upload" /> <span>Open a file</span>
          </button>
          <input ref={fileInput} type="file" accept=".zip,application/zip" hidden onChange={(e) => { void onImport(e.target.files?.[0]); e.target.value = ''; }} aria-label="Import a ZinoMake project file" />
        </div>
      </header>
      <main className="container">
        <section className="hero" aria-labelledby="hero-title">
          <h1 id="hero-title">Create anything.</h1>
          <p>Make games, apps, websites and animations by snapping blocks together. No coding experience needed.</p>
          <a className="btn btn-primary btn-big" href="#/new" data-testid="create-something">
            <Icon name="sparkle" size={22} /> Create Something
          </a>
          <div>
            <span className="steps-line" aria-label="Choose, then build, then play">Choose <span aria-hidden="true">→</span> Build <span aria-hidden="true">→</span> Play</span>
          </div>
        </section>

        <section className="section" aria-labelledby="examples-title">
          <div className="section-head"><h2 id="examples-title">Try an example</h2><a href="#/new">See all</a></div>
          <ul className="grid" style={{ padding: 0, margin: 0 }}>
            {FEATURED.map((id) => TEMPLATES.find((t) => t.id === id)!).map((t) => (
              <li key={t.id} className="card" style={{ listStyle: 'none' }}>
                <a className="card-button" href={`#/new?type=${t.type}&template=${t.id}`}>
                  <Thumb templateId={t.id} type={t.type} />
                  <div className="card-body"><h3>{t.name}</h3><p>{t.description}</p></div>
                </a>
              </li>
            ))}
          </ul>
        </section>

        {projects && projects.length > 0 && (
          <section className="section" aria-labelledby="recent-title">
            <div className="section-head"><h2 id="recent-title">Recent projects</h2></div>
            <ul className="grid" style={{ padding: 0, margin: 0 }}>{recent.map(card)}</ul>
          </section>
        )}

        <section className="section" aria-labelledby="mine-title" id="my-projects">
          <div className="section-head">
            <h2 id="mine-title">My Projects</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => void newFolder()}><Icon name="folder" /> New folder</button>
              <a className="btn btn-primary" href="#/new"><Icon name="plus" /> New project</a>
            </div>
          </div>
          {loadError && <p className="error-text" role="alert">{loadError}</p>}
          <div className="toolbar">
            <label className="sr-only" htmlFor="search">Search projects</label>
            <input id="search" className="input" type="search" placeholder="Search projects…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <label className="sr-only" htmlFor="sort">Sort projects</label>
            <select id="sort" className="input" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="recent">Recently edited</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>
          <div className="chips" role="group" aria-label="Folders">
            <button className="chip" aria-pressed={folder === 'all'} onClick={() => setFolder('all')}>All projects</button>
            <button className="chip" aria-pressed={folder === 'none'} onClick={() => setFolder('none')}>No folder</button>
            {folders.map((f) => (
              <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
                <button className="chip" aria-pressed={folder === f.id} onClick={() => setFolder(f.id)}>📁 {f.name}</button>
                {folder === f.id && (
                  <MenuButton label={`Options for folder ${f.name}`} className="btn btn-ghost btn-sm btn-icon" items={[
                    { label: 'Rename folder…', onSelect: () => void renameFolder(f) },
                    { label: 'Delete folder…', onSelect: () => void removeFolder(f), danger: true },
                  ]}><Icon name="more" /></MenuButton>
                )}
              </span>
            ))}
          </div>
          {projects === null ? (
            <p role="status">Loading your projects…</p>
          ) : visible.length ? (
            <ul className="grid" style={{ padding: 0, margin: 0 }} data-testid="project-list">{visible.map(card)}</ul>
          ) : (
            <div className="empty">
              <div className="big-emoji" aria-hidden="true">{projects.length ? '🔍' : '🧱'}</div>
              {projects.length ? (
                <p>No projects match. Try another search or folder.</p>
              ) : (
                <>
                  <p><strong>You haven’t made anything yet.</strong></p>
                  <p>Press “Create Something” to start with a ready-made example.</p>
                  <a className="btn btn-primary" href="#/new">Create Something</a>
                </>
              )}
            </div>
          )}
          <p className="hint" style={{ marginTop: 18 }}>
            Projects are saved automatically in this browser on this device. Use “Export” to keep a copy or move a project to another device.
          </p>
        </section>
      </main>

      {moving && (
        <Dialog title={`Move “${moving.name}”`} onClose={() => setMoving(null)}>
          <p>Choose a folder:</p>
          <div style={{ display: 'grid', gap: 8 }}>
            <button className="btn" onClick={async () => { await updateProjectMeta(moving.id, { folderId: null }); setMoving(null); void refresh(); }}>No folder</button>
            {folders.map((f) => (
              <button key={f.id} className="btn" aria-current={moving.folderId === f.id} onClick={async () => { await updateProjectMeta(moving.id, { folderId: f.id }); setMoving(null); toast(`Moved to “${f.name}”.`); void refresh(); }}>
                📁 {f.name}{moving.folderId === f.id ? ' (current)' : ''}
              </button>
            ))}
            <button className="btn btn-ghost" onClick={async () => { const p = moving; setMoving(null); await newFolder(); setMoving(p); }}>＋ New folder…</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
