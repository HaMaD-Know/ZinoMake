import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProjectEditor } from '../features/editor/useProjectEditor';
import { BlockEditor, type BlockEditorHandle } from '../features/block-editor/BlockEditor';
import type { CodeDiagnostic, CodeEditorHandle } from '../features/code-editor/CodeEditor';
import { PreviewPane, type PreviewHandle } from '../features/preview/PreviewPane';
import { FilePanel } from '../features/files/FilePanel';
import { AssetsPanel } from '../features/assets/AssetsPanel';
import { AddBlockDialog } from '../features/helper/AddBlockDialog';
import { HelperDialog } from '../features/helper/HelperDialog';
import { HelpDialog } from '../features/helper/HelpDialog';
import { Coach } from '../features/helper/Coach';
import { Icon } from '../components/Icon';
import { LogoMark } from '../components/Logo';
import { MenuButton } from '../components/Menu';
import { confirmDialog, promptDialog } from '../components/Dialog';
import { isDarkTheme, readPref, toast, writePref } from '../app/ui-store';
import { getFileContent, type Project } from '../model/project';
import { findTemplate } from '../templates/templates';
import { createProjectFromTemplate } from '../model/createProject';
import { elementIdsFromHtml } from '../programming/assistant/helper';
import { exportProject, exportSource, exportWebPage } from '../app/projectService';

const CodeEditor = lazy(() => import('../features/code-editor/CodeEditor'));

type View = 'blocks' | 'code';
type MobileView = 'blocks' | 'code' | 'preview';

function useIsPhone() {
  const [phone, setPhone] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const on = () => setPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}

export default function EditorPage({ projectId }: { projectId: string }) {
  const ed = useProjectEditor(projectId);
  const { project } = ed;
  const phone = useIsPhone();
  const [view, setView] = useState<View>('blocks');
  const [mobileView, setMobileView] = useState<MobileView>('blocks');
  const [showPreview, setShowPreview] = useState(() => readPref('showPreview', true));
  const [side, setSide] = useState<null | 'files' | 'assets'>(null);
  const [activeFile, setActiveFile] = useState<string>('main.js');
  const [dialog, setDialog] = useState<null | 'add' | 'helper' | 'help'>(null);
  const [coach, setCoach] = useState(() => !readPref('coachDone', false));
  const [running, setRunning] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [emptyWorkspace, setEmptyWorkspace] = useState(false);
  const [dark, setDark] = useState(isDarkTheme);

  const blocks = useRef<BlockEditorHandle>(null);
  const code = useRef<CodeEditorHandle>(null);
  const preview = useRef<PreviewHandle>(null);
  const projectRef = useRef<Project | null>(null);
  projectRef.current = project;

  useEffect(() => writePref('showPreview', showPreview), [showPreview]);
  useEffect(() => {
    if (project && !project.files.some((f) => f.path === activeFile && f.kind === 'file')) setActiveFile(project.blocksFile);
  }, [project, activeFile]);
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(isDarkTheme()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (project) document.title = `${project.name} — ZinoMake`;
    return () => {
      document.title = 'ZinoMake — Create anything';
    };
  }, [project?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentMain: View | 'preview' = phone ? mobileView : view;
  const blocksVisible = currentMain === 'blocks';
  const codeVisible = currentMain === 'code';

  const switchTo = useCallback((v: MobileView) => {
    if (v === 'blocks') ed.flushCodeSync();
    if (v === 'code') blocks.current?.flush();
    if (v !== 'preview') setView(v);
    setMobileView(v);
  }, [ed]);

  const play = useCallback(() => {
    blocks.current?.flush();
    ed.flushCodeSync();
    if (phone) setMobileView('preview');
    else setShowPreview(true);
    // Let React apply the latest state before building the preview.
    setTimeout(() => preview.current?.play(), 0);
  }, [ed, phone]);

  const stop = () => preview.current?.stop();

  // Keyboard shortcuts: Ctrl/Cmd+Enter = Play, Ctrl/Cmd+S = save now.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        play();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void ed.saveNow();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [play, ed]);

  const diagnostics = useMemo<CodeDiagnostic[]>(() => {
    if (!project || activeFile !== project.blocksFile) return [];
    if (ed.syntaxError) return [{ line: ed.syntaxError.line, message: ed.syntaxError.message, severity: 'error' }];
    return ed.unsupported.map((u) => ({ line: u.line, severity: 'info', message: `Shown as a “custom code” block in Blocks: this ${u.reason}.` }));
  }, [project, activeFile, ed.syntaxError, ed.unsupported]);

  if (ed.loadState === 'loading') return <div className="preview-empty" role="status" style={{ height: '100vh' }}>Opening your project…</div>;
  if (ed.loadState !== 'ready' || !project) {
    return (
      <div className="container" style={{ paddingTop: 48 }}>
        <div className="empty" role="alert">
          <div className="big-emoji">🔍</div>
          <h2>{ed.loadState === 'missing' ? 'This project isn’t here' : 'This project couldn’t be opened'}</h2>
          <p>{ed.loadState === 'missing' ? 'It may have been deleted, or it was made in a different browser.' : 'Your browser may be blocking storage. Try again, or go back.'}</p>
          <a className="btn btn-primary" href="#/">Back to My Projects</a>
        </div>
      </div>
    );
  }

  const template = findTemplate(project.templateId);
  const isBlocksFile = activeFile === project.blocksFile;
  const elementIds = elementIdsFromHtml(project.files.filter((f) => f.path.endsWith('.html')).map((f) => f.content).join('\n'));

  const rename = async () => {
    const name = await promptDialog({ title: 'Rename project', label: 'Project name', initial: project.name });
    if (name) ed.update((p) => ({ ...p, name: name.slice(0, 80) }));
  };

  const resetToTemplate = async () => {
    if (!template) return;
    const ok = await confirmDialog({ title: 'Start over?', message: `This puts “${template.name}” back the way it started. Your changes to the files will be lost (pictures and sounds are kept).`, confirm: 'Start over', danger: true });
    if (!ok) return;
    const fresh = createProjectFromTemplate(template, project.name);
    ed.replaceContent({ files: fresh.files, workspace: fresh.workspace, syncState: fresh.syncState, blocksFile: fresh.blocksFile });
    setActiveFile(fresh.blocksFile);
    toast('Back to the starting version.');
  };

  const addHelperCode = (snippet: string) => {
    const current = getFileContent(project, project.blocksFile);
    const next = current.trimEnd() ? `${current.trimEnd()}\n\n${snippet}` : snippet;
    ed.onCodeChanged(project.blocksFile, next);
    ed.flushCodeSync();
    setDialog(null);
    toast('Added! Press Play to try it.');
  };

  const syncPill = (() => {
    switch (project.syncState) {
      case 'in-sync': return <span className="pill ok" data-testid="sync-state">✓ Blocks and code match</span>;
      case 'code-edited': return <span className="pill ok" data-testid="sync-state">✓ Blocks updated from code</span>;
      case 'unsupported': return <span className="pill warn" data-testid="sync-state">Some code is shown as custom blocks</span>;
      case 'syntax-error': return <span className="pill error" data-testid="sync-state">Code has a mistake</span>;
    }
  })();

  const savePill = (() => {
    switch (ed.saveStatus) {
      case 'saved': return <span className="pill ok" data-testid="save-state">Saved</span>;
      case 'unsaved': return <span className="pill">Unsaved changes</span>;
      case 'saving': return <span className="pill busy" data-testid="save-state">Saving…</span>;
      case 'error': return <span className="pill error" data-testid="save-state">Not saved</span>;
      case 'conflict': return <span className="pill error" data-testid="save-state">Changed elsewhere</span>;
    }
  })();

  const runExport = (fn: (p: Project) => Promise<void>) => {
    fn(project).catch((e) => {
      console.error('[ZinoMake] export failed', e);
      toast('The file couldn’t be saved. Try again.', 'error');
    });
  };

  const undo = () => (currentMain === 'code' ? code.current?.undo() : blocks.current?.undo());
  const redo = () => (currentMain === 'code' ? code.current?.redo() : blocks.current?.redo());

  return (
    <div className="editor">
      <header className="ebar">
        <a className="btn btn-ghost btn-icon" href="#/" aria-label="Back to My Projects" title="My Projects" onClick={() => void ed.saveNow()}>
          <Icon name="back" />
        </a>
        <span className="hide-phone" aria-hidden="true"><LogoMark size={28} /></span>
        <button className="proj-name" onClick={() => void rename()} title="Rename project" aria-label={`Project name: ${project.name}. Click to rename.`}>{project.name}</button>
        <div className="seg" role="group" aria-label="View">
          <button aria-pressed={view === 'blocks'} onClick={() => switchTo('blocks')} data-testid="view-blocks"><Icon name="blocks" size={18} /> Blocks</button>
          <button aria-pressed={view === 'code'} onClick={() => switchTo('code')} data-testid="view-code"><Icon name="code" size={18} /> Code</button>
          <button aria-pressed={showPreview} onClick={() => setShowPreview((s) => !s)} title="Show or hide the preview"><Icon name="eye" size={18} /> Preview</button>
        </div>
        <span className="spacer" />
        <button className="btn btn-ghost btn-icon" onClick={undo} aria-label="Undo" title="Undo"><Icon name="undo" /></button>
        <button className="btn btn-ghost btn-icon hide-phone" onClick={redo} aria-label="Redo" title="Redo"><Icon name="redo" /></button>
        <button className="btn btn-ghost btn-icon" onClick={() => setSide((s) => (s === 'files' ? null : 'files'))} aria-pressed={side === 'files'} aria-label="Files" title="Files"><Icon name="panel" /></button>
        <button className="btn btn-ghost btn-icon hide-phone" onClick={() => setSide((s) => (s === 'assets' ? null : 'assets'))} aria-pressed={side === 'assets'} aria-label="Pictures and sounds" title="Pictures & sounds"><Icon name="image" /></button>
        <MenuButton label="More options" items={[
          { label: '✨ Describe it (helper)…', onSelect: () => setDialog('helper') },
          { label: 'Pictures & sounds', onSelect: () => setSide('assets') },
          { label: 'Help & ideas', onSelect: () => setDialog('help') },
          { label: 'Download project (.zip)', onSelect: () => runExport(exportProject), separatorBefore: true },
          { label: 'Download web page (.html)', onSelect: () => runExport(exportWebPage) },
          { label: 'Download source files (.zip)', onSelect: () => runExport(exportSource) },
          ...(template ? [{ label: 'Start over from the starter…', onSelect: () => void resetToTemplate(), danger: true, separatorBefore: true }] : []),
        ]}><Icon name="more" /></MenuButton>
        {running ? (
          <button className="btn btn-play" onClick={stop} data-testid="stop" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}><Icon name="stop" /> <span>Stop</span></button>
        ) : (
          <button className="btn btn-play" onClick={play} data-testid="play" title="Play (Ctrl+Enter)"><Icon name="play" /> <span>Play</span></button>
        )}
      </header>

      <div className="banner-slot">{ed.saveStatus === 'conflict' && (
        <div className="banner error" role="alert">
          <span>This project was changed somewhere else (maybe in another tab). Nothing has been overwritten.</span>
          <span className="actions">
            <button className="btn btn-sm" onClick={() => void ed.loadTheirs()}>Load the other version</button>
            <button className="btn btn-sm btn-primary" onClick={() => void ed.keepMine()}>Keep my version</button>
          </span>
        </div>
      )}</div>

      <div className={`ebody${showPreview || phone ? '' : ' no-preview'}${side ? ' has-side' : ''}`} data-mobile-view={mobileView}>
        <aside className="side" hidden={!side} aria-label={side === 'assets' ? 'Pictures and sounds' : 'Files'}>
          <div className="seg" role="group" aria-label="Side panel" style={{ margin: 8 }}>
            <button aria-pressed={side === 'files'} onClick={() => setSide('files')}>Files</button>
            <button aria-pressed={side === 'assets'} onClick={() => setSide('assets')}>Pictures &amp; sounds</button>
            {phone && <button onClick={() => setSide(null)} aria-label="Close panel">✕</button>}
          </div>
          {side === 'files' && (
            <FilePanel project={project} activeFile={activeFile} onChange={ed.update} onOpen={(path) => {
              setActiveFile(path);
              if (path !== project.blocksFile) switchTo('code');
              if (phone) setSide(null);
            }} />
          )}
          {side === 'assets' && <AssetsPanel project={project} onChange={ed.update} />}
        </aside>

        <section className="main-view" aria-label={codeVisible ? 'Code' : 'Blocks'}>
          {/* Blocks view stays mounted so switching views never resets the workspace. */}
          <div style={{ display: blocksVisible ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div className="view-toolbar">
              <button className="btn btn-sm" onClick={() => setDialog('add')} data-testid="add-block"><Icon name="plus" size={16} /> Add block</button>
              <button className="btn btn-sm" onClick={() => setDialog('helper')}><Icon name="sparkle" size={16} /> Describe it</button>
              <button className="btn btn-sm" disabled={!hasSelection} onClick={() => blocks.current?.deleteSelected()} aria-label="Delete selected block"><Icon name="trash" size={16} /> <span className="hide-phone">Delete block</span></button>
              <span className="grow" />
              <button className="btn btn-sm btn-ghost" onClick={() => setDialog('help')}><Icon name="help" size={16} /> Help</button>
            </div>
            {project.syncState === 'unsupported' && (
              <div className="banner warn" role="status">
                <span>Some code uses features that aren’t available in Blocks yet. Your code is safe — it’s shown as grey “custom code” blocks. You can keep editing it in Code view.</span>
              </div>
            )}
            <div className="blocks-wrap">
              <BlockEditor
                ref={blocks}
                type={project.type}
                workspace={project.workspace}
                reloadToken={ed.blocksReload}
                onChange={ed.onBlocksChanged}
                onSelectionChange={setHasSelection}
                onEmptyChange={setEmptyWorkspace}
                visible={blocksVisible}
              />
              {emptyWorkspace && !ed.syntaxError && (
                <div className="empty-hint">
                  <strong>Start here 👇</strong>
                  <p>Open <em>Start</em> and drag “when Play is pressed” here. Then put a “show message” block inside it.</p>
                </div>
              )}
              {ed.syntaxError && (
                <div className="lock-overlay" role="alert">
                  <div className="lock-card">
                    <h3>Your code has a small mistake</h3>
                    <p>Line {ed.syntaxError.line}: {ed.syntaxError.message}</p>
                    <p className="hint">The blocks show your last working version. Fix the code to update them. Your code is kept safe.</p>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button className="btn btn-primary" onClick={() => { setActiveFile(project.blocksFile); switchTo('code'); }}>Fix it in Code</button>
                      <button className="btn" onClick={async () => {
                        if (await confirmDialog({ title: 'Use the blocks instead?', message: 'This replaces the code that has a mistake with the code from your blocks. The broken code will be lost.', confirm: 'Use blocks', danger: true })) ed.applyBlocksVersion();
                      }}>Use the blocks instead</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {codeVisible && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="view-toolbar">
                <div className="file-tabs" role="tablist" aria-label="Open file">
                  {project.files.filter((f) => f.kind === 'file' && /\.(js|html|css|txt|json|md)$/.test(f.path)).map((f) => (
                    <button key={f.path} role="tab" aria-selected={f.path === activeFile} className={`btn btn-sm ${f.path === activeFile ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveFile(f.path)}>{f.path}</button>
                  ))}
                </div>
                <span className="grow" />
                <button className="btn btn-sm" onClick={() => switchTo('blocks')}><Icon name="blocks" size={16} /> Back to Blocks</button>
              </div>
              {isBlocksFile ? (
                ed.syntaxError ? (
                  <div className="banner error" role="alert">
                    <span>Line {ed.syntaxError.line}: {ed.syntaxError.message} <span className="hint">Your code is kept exactly as you typed it.</span></span>
                  </div>
                ) : project.syncState === 'unsupported' ? (
                  <div className="banner warn" role="status"><span>{ed.unsupported.length || 'Some'} part{ed.unsupported.length === 1 ? '' : 's'} of this code can’t be shown as blocks yet (marked with ⓘ). They’re kept exactly as written.</span></div>
                ) : (
                  <div className="banner info" role="status"><span>🧩 This file is made from your blocks. Simple changes here update the blocks too.</span></div>
                )
              ) : (
                <div className="banner info"><span>{activeFile.endsWith('.html') ? 'This is the page. Give things an id (like id="player") to use them in blocks.' : activeFile.endsWith('.css') ? 'This file controls colours, sizes and positions.' : 'This file isn’t linked to blocks.'}</span></div>
              )}
              <Suspense fallback={<div className="preview-empty" role="status">Loading the code editor…</div>}>
                <CodeEditor
                  ref={code}
                  path={activeFile}
                  value={getFileContent(project, activeFile)}
                  onChange={(text) => ed.onCodeChanged(activeFile, text)}
                  diagnostics={diagnostics}
                  dark={dark}
                />
              </Suspense>
            </div>
          )}
        </section>

        {(showPreview || phone) && (
          <PreviewPane ref={preview} getProject={() => projectRef.current} onRunningChange={setRunning} onShowLine={() => { setActiveFile(project.blocksFile); switchTo('code'); }} />
        )}
      </div>

      <footer className="status" aria-label="Status">
        {savePill}
        {syncPill}
        {ed.saveStatus === 'error' && (
          <span role="alert" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            Your changes couldn’t be saved. Your current work is still open.
            <button className="btn btn-sm" onClick={() => void ed.saveNow()}>Try saving again</button>
          </span>
        )}
        <span style={{ flex: 1 }} />
        {template && template.nextIdeas[0] && <button className="btn btn-sm btn-ghost hide-phone" onClick={() => setDialog('help')}>💡 What can I do next?</button>}
      </footer>

      <nav className="mobile-nav" aria-label="Editor views">
        <button aria-pressed={mobileView === 'blocks'} onClick={() => switchTo('blocks')}><Icon name="blocks" /> Blocks</button>
        <button aria-pressed={mobileView === 'code'} onClick={() => switchTo('code')}><Icon name="code" /> Code</button>
        <button aria-pressed={mobileView === 'preview'} onClick={() => switchTo('preview')}><Icon name="eye" /> Preview</button>
      </nav>

      {dialog === 'add' && (
        <AddBlockDialog type={project.type} onClose={() => setDialog(null)} onPick={(item) => {
          setDialog(null);
          if (ed.syntaxError) return;
          blocks.current?.insert(item);
        }} />
      )}
      {dialog === 'helper' && <HelperDialog elementIds={elementIds} onClose={() => setDialog(null)} onAdd={addHelperCode} />}
      {dialog === 'help' && <HelpDialog type={project.type} nextIdeas={template?.nextIdeas ?? []} onClose={() => setDialog(null)} onTour={() => { setDialog(null); setCoach(true); }} />}
      {coach && !dialog && <Coach onDone={() => { setCoach(false); writePref('coachDone', true); }} />}
    </div>
  );
}

