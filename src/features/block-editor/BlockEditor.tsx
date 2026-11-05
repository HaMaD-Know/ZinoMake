import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Blockly, buildToolbox, createTheme, registerDynamicCategories, registerZinoBlocks, zmChoices } from '../../programming/blocks/register';
import type { ProjectType, WorkspaceState } from '../../model/project';
import { promptDialog } from '../../components/Dialog';
import { safeName } from '../../programming/generators/blocksToCode';
import { RESERVED_GLOBALS, RUNTIME_NAMES } from '../../programming/blocks/catalog';
import { isDarkTheme } from '../../app/ui-store';

export interface BlockEditorHandle {
  /** Send any pending change right away. */
  flush(): void;
  undo(): void;
  redo(): void;
  /** Insert a block from toolbox JSON next to the selection (keyboard / touch alternative to dragging). */
  insert(item: Record<string, unknown>): boolean;
  deleteSelected(): boolean;
  /** Select and scroll to the first top block of this type whose field has this value. */
  reveal(type: string, field: string, value: string): void;
  resize(): void;
  zoom(delta: number): void;
  center(): void;
}

interface Props {
  type: ProjectType;
  workspace: WorkspaceState | null;
  reloadToken: number;
  onChange: (ws: WorkspaceState) => void;
  onSelectionChange?: (hasSelection: boolean) => void;
  onEmptyChange?: (empty: boolean) => void;
  visible: boolean;
  /** Names of things on the page/stage, offered in the name dropdowns. */
  thingNames?: string[];
  /** Uploaded files, offered in the picture and sound dropdowns. */
  assets?: { name: string; mime: string }[];
  /** Screen names from the Design view. */
  screens?: string[];
}

async function createVariable(ws: Blockly.WorkspaceSvg) {
  const name = await promptDialog({
    title: 'Remember something',
    label: 'What should it be called? (for example: score, lives, name)',
    confirm: 'Create',
    validate: (v) => {
      const n = safeName(v);
      if (!v.trim()) return 'Please type a name.';
      if (RUNTIME_NAMES.has(n) || RESERVED_GLOBALS.has(n)) return `“${n}” is already used by ZinoMake. Try another name.`;
      if (ws.getVariableMap().getVariable(n)) return `You already have “${n}”.`;
      return null;
    },
  });
  if (name) {
    ws.getVariableMap().createVariable(safeName(name));
    ws.refreshToolboxSelection();
  }
}

export const BlockEditor = forwardRef<BlockEditorHandle, Props>(function BlockEditor(
  { type, workspace, reloadToken, onChange, onSelectionChange, onEmptyChange, visible, thingNames, assets, screens },
  ref,
) {
  zmChoices.things = [...(thingNames ?? [])].sort((a, b) => a.localeCompare(b));
  zmChoices.images = (assets ?? []).filter((a) => a.mime.startsWith('image/')).map((a) => a.name);
  zmChoices.sounds = (assets ?? []).filter((a) => a.mime.startsWith('audio/')).map((a) => a.name);
  zmChoices.screens = screens ?? [];
  const host = useRef<HTMLDivElement>(null);
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const loading = useRef(false);
  const changeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [ready, setReady] = useState(false);

  const load = (state: WorkspaceState | null, tidy: boolean) => {
    const ws = wsRef.current;
    if (!ws) return;
    loading.current = true;
    Blockly.Events.disable();
    try {
      ws.clear();
      if (state) Blockly.serialization.workspaces.load(state, ws, { recordUndo: false });
      if (tidy) ws.cleanUp();
    } catch (e) {
      console.error('[ZinoMake] could not load blocks', e);
    } finally {
      Blockly.Events.enable();
      loading.current = false;
    }
    ws.clearUndo();
    onEmptyChange?.(ws.getTopBlocks(false).length === 0);
  };

  // Inject once.
  useEffect(() => {
    registerZinoBlocks();
    const el = host.current!;
    const ws = Blockly.inject(el, {
      toolbox: buildToolbox(type),
      theme: createTheme(isDarkTheme()),
      renderer: 'zelos',
      trashcan: true,
      move: { scrollbars: true, drag: true, wheel: false },
      zoom: { controls: true, wheel: true, startScale: window.innerWidth < 760 ? 0.72 : 0.85, maxScale: 2, minScale: 0.35, scaleSpeed: 1.15, pinch: true },
      grid: { spacing: 28, length: 2, colour: 'rgba(120,120,140,0.25)', snap: false },
      sounds: false,
      media: './blockly-media/',
      maxTrashcanContents: 20,
    });
    wsRef.current = ws;
    registerDynamicCategories(ws, (w) => void createVariable(w));
    ws.addChangeListener((e: Blockly.Events.Abstract) => {
      if (e.type === Blockly.Events.SELECTED) {
        onSelectionChange?.(!!(e as Blockly.Events.Selected).newElementId);
      }
      if (loading.current || e.isUiEvent || e.type === Blockly.Events.FINISHED_LOADING) return;
      // Ignore half-finished drags; the final move event will follow.
      if (ws.isDragging()) return;
      if (changeTimer.current) clearTimeout(changeTimer.current);
      changeTimer.current = setTimeout(() => {
        changeTimer.current = null;
        onEmptyChange?.(ws.getTopBlocks(false).length === 0);
        onChangeRef.current(Blockly.serialization.workspaces.save(ws) as WorkspaceState);
      }, 200);
    });
    load(workspace, !!workspace?.zmLayout);
    setReady(true);
    const ro = new ResizeObserver(() => Blockly.svgResize(ws));
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (changeTimer.current) {
        clearTimeout(changeTimer.current);
        // Flush pending change so nothing is lost when leaving.
        onChangeRef.current(Blockly.serialization.workspaces.save(ws) as WorkspaceState);
      }
      ws.dispose();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when code changed the workspace.
  const firstReload = useRef(reloadToken);
  useEffect(() => {
    if (!ready || reloadToken === firstReload.current) return;
    firstReload.current = reloadToken;
    load(workspace, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken, ready]);

  useEffect(() => {
    if (visible && wsRef.current) {
      requestAnimationFrame(() => wsRef.current && Blockly.svgResize(wsRef.current));
    }
  }, [visible]);

  useImperativeHandle(ref, () => ({
    flush: () => {
      const ws = wsRef.current;
      if (ws && changeTimer.current) {
        clearTimeout(changeTimer.current);
        changeTimer.current = null;
        onChangeRef.current(Blockly.serialization.workspaces.save(ws) as WorkspaceState);
      }
    },
    undo: () => wsRef.current?.undo(false),
    redo: () => wsRef.current?.undo(true),
    resize: () => wsRef.current && Blockly.svgResize(wsRef.current),
    zoom: (d) => wsRef.current?.zoomCenter(d),
    center: () => wsRef.current?.scrollCenter(),
    reveal: (type, field, value) => {
      const ws = wsRef.current;
      if (!ws) return;
      const b = ws.getBlocksByType(type, false).find((x) => String(x.getFieldValue(field)) === value) as Blockly.BlockSvg | undefined;
      if (b) {
        b.select();
        ws.centerOnBlock(b.id);
      }
    },
    deleteSelected: () => {
      const sel = Blockly.getSelected();
      if (sel && sel instanceof Blockly.BlockSvg && sel.isDeletable()) {
        Blockly.Events.setGroup(true);
        sel.dispose(true, true);
        Blockly.Events.setGroup(false);
        return true;
      }
      return false;
    },
    insert: (item) => {
      const ws = wsRef.current;
      if (!ws) return false;
      const { kind: _kind, ...state } = item;
      void _kind;
      const block = Blockly.serialization.blocks.append(state as unknown as Blockly.serialization.blocks.State, ws) as Blockly.BlockSvg;
      const sel = Blockly.getSelected();
      const target = sel instanceof Blockly.BlockSvg ? sel : null;
      let placed = false;
      try {
        if (block.outputConnection && target) {
          const empty = target.inputList.find((i) => i.connection?.type === Blockly.ConnectionType.INPUT_VALUE && (!i.connection.targetBlock() || i.connection.targetBlock()!.isShadow()) && i.connection.getConnectionChecker().canConnect(i.connection, block.outputConnection, false));
          if (empty?.connection) {
            empty.connection.connect(block.outputConnection);
            placed = true;
          }
        } else if (block.previousConnection) {
          let anchor: Blockly.BlockSvg | null = target;
          if (!anchor) {
            // Default: the end of the first "when Play is pressed" (or any start) stack.
            anchor = (ws.getBlocksByType('zm_on_start', false)[0] as Blockly.BlockSvg | undefined) ?? (ws.getTopBlocks(true).find((b) => b.getInput('DO')) as Blockly.BlockSvg | undefined) ?? null;
          }
          if (anchor) {
            const body = anchor.getInput('DO')?.connection;
            if (body && (!anchor.nextConnection || anchor === target && !anchor.previousConnection)) {
              let last = body.targetBlock();
              while (last?.getNextBlock()) last = last.getNextBlock();
              if (last?.nextConnection) last.nextConnection.connect(block.previousConnection);
              else body.connect(block.previousConnection);
              placed = true;
            } else if (anchor.nextConnection) {
              const after = anchor.nextConnection.targetBlock();
              anchor.nextConnection.connect(block.previousConnection);
              if (after && block.nextConnection) block.nextConnection.connect(after.previousConnection!);
              placed = true;
            } else if (body) {
              body.connect(block.previousConnection);
              placed = true;
            }
          }
        }
      } catch (e) {
        console.warn('[ZinoMake] could not connect block', e);
      }
      if (!placed) {
        const m = ws.getMetricsManager().getViewMetrics(true);
        block.moveTo(new Blockly.utils.Coordinate(m.left + 40, m.top + 40));
      }
      block.select();
      ws.centerOnBlock(block.id);
      return placed;
    },
  }));

  return <div ref={host} className="blockly-host" role="application" aria-label="Block workspace. Drag blocks from the categories on the left, or use Add block." />;
});
