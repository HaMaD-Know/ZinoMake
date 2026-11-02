/**
 * Editor state: loading, autosave (debounced, conflict-safe) and block/code synchronisation.
 *
 * Sync rules (see docs/ARCHITECTURE.md):
 *  - Blocks changed  → regenerate the blocks file's code from the workspace.
 *  - Code changed    → keep the text exactly as typed; parse it; if valid, rebuild the blocks
 *                      (unsupported statements become "custom code" blocks holding the original text).
 *  - Syntax error    → keep the text, keep the last good blocks, lock the block editor until fixed.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Project, WorkspaceState } from '../../model/project';
import { getFileContent } from '../../model/project';
import { ConflictError, getProject, saveProject } from '../../storage/db';
import { blocksToCode } from '../../programming/generators/blocksToCode';
import { codeToBlocks, type UnsupportedPart } from '../../programming/parsers/codeToBlocks';

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error' | 'conflict';
export type LoadState = 'loading' | 'ready' | 'missing' | 'error';

export interface SyntaxProblem {
  message: string;
  line: number;
  column: number;
}

const SAVE_DELAY = 700;
const PARSE_DELAY = 350;

function countRaw(ws: WorkspaceState | null): number {
  return ws ? (JSON.stringify(ws).match(/"type":"zm_raw"/g) ?? []).length : 0;
}

export function useProjectEditor(projectId: string) {
  const [project, setProjectState] = useState<Project | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [syntaxError, setSyntaxError] = useState<SyntaxProblem | null>(null);
  const [unsupported, setUnsupported] = useState<UnsupportedPart[]>([]);
  const [blocksReload, setBlocksReload] = useState(0);

  const ref = useRef<Project | null>(null);
  const dirty = useRef(0); // incremented on every change
  const savedAt = useRef(0); // value of `dirty` that was last saved
  const saving = useRef(false);
  const conflict = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setProject = useCallback((p: Project) => {
    ref.current = p;
    setProjectState(p);
  }, []);

  // ---------- load ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getProject(projectId);
        if (cancelled) return;
        if (!p) {
          setLoadState('missing');
          return;
        }
        let next = p;
        const code = getFileContent(p, p.blocksFile);
        const conv = codeToBlocks(code);
        if (conv.ok) {
          setUnsupported(conv.unsupported);
          // Repair a missing workspace, or one that no longer matches the code (e.g. edited outside ZinoMake).
          if (!p.workspace || p.syncState === 'syntax-error') {
            next = { ...p, workspace: conv.workspace, syncState: conv.unsupported.length ? 'unsupported' : 'code-edited' };
          }
        } else {
          setSyntaxError(conv.error);
          next = { ...p, syncState: 'syntax-error' };
        }
        setProject(next);
        setLoadState('ready');
      } catch (e) {
        console.error('[ZinoMake] could not open project', e);
        if (!cancelled) setLoadState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, setProject]);

  // ---------- saving ----------
  const doSave = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const p = ref.current;
    if (!p || conflict.current) return;
    if (saving.current) {
      saveTimer.current = setTimeout(() => void doSave(), 200);
      return;
    }
    if (savedAt.current === dirty.current) {
      setSaveStatus('saved');
      return;
    }
    saving.current = true;
    const version = dirty.current;
    setSaveStatus('saving');
    try {
      const saved = await saveProject(p);
      savedAt.current = version;
      // Keep any edits made while saving; just take the new revision.
      const latest = ref.current!;
      setProject({ ...latest, revision: saved.revision, updatedAt: saved.updatedAt });
      setSaveStatus(savedAt.current === dirty.current ? 'saved' : 'unsaved');
      if (savedAt.current !== dirty.current) saveTimer.current = setTimeout(() => void doSave(), SAVE_DELAY);
    } catch (e) {
      if (e instanceof ConflictError) {
        conflict.current = true;
        setSaveStatus('conflict');
      } else {
        console.error('[ZinoMake] autosave failed', e);
        setSaveStatus('error');
      }
    } finally {
      saving.current = false;
    }
  }, [setProject]);

  const update = useCallback(
    (fn: (p: Project) => Project) => {
      const p = ref.current;
      if (!p) return;
      const next = fn(p);
      if (next === p) return;
      dirty.current += 1;
      setProject(next);
      if (!conflict.current) setSaveStatus('unsaved');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void doSave(), SAVE_DELAY);
    },
    [doSave, setProject],
  );

  // Flush on page hide / leaving the editor.
  useEffect(() => {
    const flush = () => {
      if (savedAt.current !== dirty.current) void doSave();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (savedAt.current !== dirty.current && !conflict.current) {
        flush();
        e.preventDefault();
      }
    };
    const onVis = () => document.visibilityState === 'hidden' && flush();
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVis);
      flush();
    };
  }, [doSave]);

  /** Conflict resolution: overwrite the stored copy with what is open now. */
  const keepMine = useCallback(async () => {
    const stored = await getProject(projectId);
    const p = ref.current;
    if (!p) return;
    conflict.current = false;
    setProject({ ...p, revision: stored?.revision ?? p.revision });
    dirty.current += 1;
    await doSave();
  }, [doSave, projectId, setProject]);

  /** Conflict resolution: discard what is open and load the stored copy. */
  const loadTheirs = useCallback(async () => {
    const stored = await getProject(projectId);
    if (!stored) return;
    conflict.current = false;
    savedAt.current = dirty.current;
    setProject(stored);
    setSaveStatus('saved');
    const conv = codeToBlocks(getFileContent(stored, stored.blocksFile));
    setSyntaxError(conv.ok ? null : conv.error);
    setUnsupported(conv.ok ? conv.unsupported : []);
    setBlocksReload((n) => n + 1);
  }, [projectId, setProject]);

  // ---------- synchronisation ----------
  const onBlocksChanged = useCallback(
    (ws: WorkspaceState) => {
      if (parseTimer.current) {
        clearTimeout(parseTimer.current);
        parseTimer.current = null;
      }
      const code = blocksToCode(ws);
      const raw = countRaw(ws);
      update((p) => ({
        ...p,
        workspace: ws,
        syncState: raw ? 'unsupported' : 'in-sync',
        files: p.files.map((f) => (f.path === p.blocksFile ? { ...f, content: code } : f)),
      }));
      setSyntaxError(null);
      if (!raw) setUnsupported([]);
    },
    [update],
  );

  const convertBlocksFile = useCallback(() => {
    const p = ref.current;
    if (!p) return;
    const code = getFileContent(p, p.blocksFile);
    const conv = codeToBlocks(code);
    if (!conv.ok) {
      setSyntaxError(conv.error);
      update((q) => (q.syncState === 'syntax-error' ? q : { ...q, syncState: 'syntax-error' }));
      return;
    }
    setSyntaxError(null);
    setUnsupported(conv.unsupported);
    const syncState = conv.unsupported.length ? 'unsupported' : blocksToCode(conv.workspace) === code ? 'in-sync' : 'code-edited';
    update((q) => ({ ...q, workspace: conv.workspace, syncState }));
    setBlocksReload((n) => n + 1);
  }, [update]);

  const onCodeChanged = useCallback(
    (path: string, text: string) => {
      update((p) => ({ ...p, files: p.files.map((f) => (f.path === path && f.kind === 'file' ? { ...f, content: text } : f)) }));
      if (ref.current && path === ref.current.blocksFile) {
        if (parseTimer.current) clearTimeout(parseTimer.current);
        parseTimer.current = setTimeout(convertBlocksFile, PARSE_DELAY);
      }
    },
    [update, convertBlocksFile],
  );

  /** Apply pending code→blocks conversion now (e.g. when switching to Blocks view). */
  const flushCodeSync = useCallback(() => {
    if (parseTimer.current) {
      clearTimeout(parseTimer.current);
      parseTimer.current = null;
      convertBlocksFile();
    }
  }, [convertBlocksFile]);

  /** Replace broken code with the code generated from the last good blocks. */
  const applyBlocksVersion = useCallback(() => {
    const p = ref.current;
    if (!p?.workspace) return;
    onBlocksChanged(p.workspace);
    setBlocksReload((n) => n + 1);
  }, [onBlocksChanged]);

  /** Replace the whole project content (e.g. "start over from the template"). */
  const replaceContent = useCallback(
    (patch: Pick<Project, 'files' | 'workspace' | 'syncState' | 'blocksFile'>) => {
      update((p) => ({ ...p, ...patch }));
      setSyntaxError(null);
      setUnsupported([]);
      setBlocksReload((n) => n + 1);
    },
    [update],
  );

  return {
    project, loadState, saveStatus, syntaxError, unsupported, blocksReload,
    update, saveNow: doSave, keepMine, loadTheirs,
    onBlocksChanged, onCodeChanged, flushCodeSync, applyBlocksVersion, replaceContent, convertBlocksFile,
  };
}
