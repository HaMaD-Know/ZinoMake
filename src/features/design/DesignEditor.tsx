/**
 * Design view: a visual editor for screens and components (like App Inventor / a page builder).
 *
 *  - Left: components to add, your pictures, and the layers tree.
 *  - Middle: a live canvas (the real rendered page, without running any code). Click to select;
 *    drag things on a game stage to place them; drag the corner handle to resize.
 *  - Right: properties — words, pictures, colours, size, layout and “When tapped”.
 *
 * The design is saved as design.json (see src/design/model.ts) and rendered by src/design/render.ts,
 * the same code the preview and exported page use.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { AssetRef, Project } from '../../model/project';
import {
  COMPONENTS, COMPONENT_BY_TYPE, LOOK_FIELDS, SIZE_FIELDS, SOUND_CHOICES, TAP_ACTIONS,
  clone, duplicateNode, emptyDesign, firstStage, hasDesignFile, insertNode, locate, makeNode, moveNode,
  readDesign, removeNode, reparentNode, safeThingName, serializeDesign, uniqueName, updateNode, walk, withDesign,
  type CompType, type Design, type DesignNode, type FieldSpec, type PropValue, type Screen,
} from '../../design/model';
import { DESIGN_ROOT_ID, designCss, insertDesignHtml, renderDesign } from '../../design/render';
import { replaceAssetRefs } from '../../runtime/buildPreview';
import { ACCEPT_IMAGES, storeAssetFiles, useAssetUrls } from '../assets/AssetsPanel';
import { confirmDialog, promptDialog } from '../../components/Dialog';
import { toast } from '../../app/ui-store';
import { newId } from '../../model/project';

export interface DesignEditorHandle {
  undo(): void;
  redo(): void;
}

interface Props {
  project: Project;
  onUpdate: (fn: (p: Project) => Project) => void;
  phone: boolean;
  visible: boolean;
  /** Open Blocks with a “when NAME is clicked / changes” block ready. */
  onUseBlocks: (name: string, kind: 'click' | 'change') => void;
}

type Device = 'phone' | 'tablet' | 'desktop';
const DEVICE_WIDTH: Record<Device, number> = { phone: 390, tablet: 768, desktop: 1180 };

const EDITOR_CSS = `
html,body{min-height:100%}
#${DESIGN_ROOT_ID} [data-zm-id]{cursor:default}
#${DESIGN_ROOT_ID} .zm-free{cursor:grab;touch-action:none}
#${DESIGN_ROOT_ID} input,#${DESIGN_ROOT_ID} select,#${DESIGN_ROOT_ID} textarea{pointer-events:none}
#${DESIGN_ROOT_ID} *{user-select:none;-webkit-user-select:none}
#${DESIGN_ROOT_ID} [data-zm-id]:hover{outline:1.5px dashed rgba(91,75,219,.7);outline-offset:1px}
#${DESIGN_ROOT_ID} .zm-row:empty,#${DESIGN_ROOT_ID} .zm-column:empty,#${DESIGN_ROOT_ID} .zm-card:empty,#${DESIGN_ROOT_ID} .zm-inner:empty{min-height:64px;border:2px dashed #b9b2f5;border-radius:12px}
#${DESIGN_ROOT_ID} .zm-row:empty::after,#${DESIGN_ROOT_ID} .zm-column:empty::after,#${DESIGN_ROOT_ID} .zm-card:empty::after,#${DESIGN_ROOT_ID} .zm-inner:empty::after{content:'Empty — select it, then add things';color:#8a84c9;font:600 13px system-ui;margin:auto;padding:20px}
#${DESIGN_ROOT_ID} .zm-screen:empty{min-height:60vh}
#${DESIGN_ROOT_ID} .zm-screen:empty::after{content:'This screen is empty. Add things from the left.';display:block;text-align:center;color:#8a8f9c;font:600 16px system-ui;padding:80px 20px}
#zm-handle{position:absolute;width:16px;height:16px;border-radius:5px;background:#5b4bdb;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);cursor:nwse-resize;z-index:2147483646;touch-action:none;display:none}
`;

/** Remove anything that could run code from the user's HTML before showing it in the canvas. */
function sanitizeHtml(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, iframe, object, embed, base, meta[http-equiv]').forEach((e) => e.remove());
    doc.querySelectorAll('*').forEach((el) => {
      for (const a of Array.from(el.attributes)) {
        if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
      }
    });
    return '<!doctype html>' + doc.documentElement.outerHTML;
  } catch {
    return '<!doctype html><html><head></head><body></body></html>';
  }
}

function canvasBase(project: Project, urls: Record<string, string>): string {
  const files = project.files.filter((f) => f.kind === 'file');
  const htmlFile = files.find((f) => f.path === 'index.html') ?? files.find((f) => f.path.endsWith('.html'));
  const css = files.filter((f) => f.path.endsWith('.css')).map((f) => f.content).join('\n');
  let html = sanitizeHtml(htmlFile?.content ?? '<html><head></head><body></body></html>');
  html = insertDesignHtml(html, `<div id="${DESIGN_ROOT_ID}"></div>`);
  html = replaceAssetRefs(html, urls);
  const head = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:"><meta name="viewport" content="width=device-width, initial-scale=1"><style id="zm-design-css"></style><style>${replaceAssetRefs(css, urls).replace(/<\/style/gi, '<\\/style')}</style><style>${EDITOR_CSS}</style><style id="zm-sel"></style>`;
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + head) : html.replace(/<html[^>]*>/i, (m) => `${m}<head>${head}</head>`);
}

// ------------------------------------------------------------------ small field controls

function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : /^#[0-9a-f]{3}$/i.test(value) ? '#' + value.slice(1).split('').map((c) => c + c).join('') : '#ffffff';
  return (
    <span className="dz-color">
      <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} aria-label="Pick a colour" />
      <input className="input" value={value} placeholder="(none)" onChange={(e) => onChange(e.target.value)} spellCheck={false} />
      {value && <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => onChange('')} aria-label="Clear colour" title="Clear">×</button>}
    </span>
  );
}

interface FieldProps {
  spec: FieldSpec;
  value: PropValue | undefined;
  onChange: (v: PropValue | undefined) => void;
  images: AssetRef[];
  screens: Screen[];
  urls: Record<string, string>;
}

function Field({ spec, value, onChange, images, screens, urls }: FieldProps) {
  const id = `dz-f-${spec.key}`;
  let control: React.ReactNode;
  switch (spec.kind) {
    case 'toggle':
      return (
        <label className="dz-toggle" title={spec.hint}>
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {spec.label}
        </label>
      );
    case 'color':
      control = <ColorField value={String(value ?? '')} onChange={(v) => onChange(v || undefined)} />;
      break;
    case 'select':
      control = (
        <select id={id} className="input" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {spec.options!.map(([l, v]) => <option key={v} value={v}>{l}</option>)}
        </select>
      );
      break;
    case 'image':
      control = (
        <span className="dz-image-pick">
          {value && urls[String(value)] && <img src={urls[String(value)]} alt="" />}
          <select id={id} className="input" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
            <option value="">(none)</option>
            {images.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
            {value && !images.some((a) => a.name === value) && <option value={String(value)}>{String(value)} (missing)</option>}
          </select>
        </span>
      );
      break;
    case 'screen':
      control = (
        <select id={id} className="input" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          <option value="">(choose a screen)</option>
          {screens.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
      );
      break;
    case 'number':
      control = (
        <input id={id} className="input" type="number" value={value === undefined || value === '' ? '' : Number(value)}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
      );
      break;
    case 'longtext':
      control = <textarea id={id} className="input" rows={3} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
      break;
    default:
      control = <input id={id} className="input" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} placeholder={spec.kind === 'size' ? 'auto' : ''} spellCheck={spec.kind !== 'size'} />;
  }
  return (
    <div className="dz-field">
      <label htmlFor={id}>{spec.label}</label>
      {control}
      {spec.hint && <span className="hint">{spec.hint}</span>}
    </div>
  );
}

// ------------------------------------------------------------------ the editor

export const DesignEditor = forwardRef<DesignEditorHandle, Props>(function DesignEditor({ project, onUpdate, phone, visible, onUseBlocks }, ref) {
  const parsed = useMemo(() => readDesign(project), [project]);
  const broken = !parsed && hasDesignFile(project);
  const design: Design = useMemo(() => parsed ?? emptyDesign(), [parsed]);
  const [screenId, setScreenId] = useState<string>(() => design.screens[0].id);
  const [selected, setSelected] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>(() => (project.type === 'website' ? 'desktop' : project.type === 'app' ? 'phone' : 'tablet'));
  const [tab, setTab] = useState<'add' | 'layers' | 'props'>('add');
  const urls = useAssetUrls(project);
  const images = project.assets.filter((a) => a.mime.startsWith('image/'));
  const screen = design.screens.find((s) => s.id === screenId) ?? design.screens[0];
  const sel = selected ? locate(design, selected) : null;
  const selNode = sel && sel.screen.id === screen.id ? sel.node : null;

  // ---------- history ----------
  const past = useRef<string[]>([]);
  const future = useRef<string[]>([]);
  const lastMerge = useRef<{ key: string; at: number } | null>(null);
  const designRef = useRef(design);
  designRef.current = design;

  const commit = useCallback((next: Design, mergeKey?: string) => {
    const now = Date.now();
    const cur = serializeDesign(designRef.current);
    const merge = mergeKey && lastMerge.current && lastMerge.current.key === mergeKey && now - lastMerge.current.at < 1200;
    if (!merge) past.current = [...past.current.slice(-60), cur];
    lastMerge.current = mergeKey ? { key: mergeKey, at: now } : null;
    future.current = [];
    designRef.current = next;
    onUpdate((p) => withDesign(p, next));
  }, [onUpdate]);

  const restore = (text: string | undefined, from: 'undo' | 'redo') => {
    if (!text) return;
    const cur = serializeDesign(designRef.current);
    if (from === 'undo') future.current.push(cur); else past.current.push(cur);
    const d = JSON.parse(text) as Design;
    designRef.current = d;
    lastMerge.current = null;
    onUpdate((p) => withDesign(p, d));
  };
  useImperativeHandle(ref, () => ({
    undo: () => restore(past.current.pop(), 'undo'),
    redo: () => restore(future.current.pop(), 'redo'),
  }));

  useEffect(() => {
    if (!design.screens.some((s) => s.id === screenId)) setScreenId(design.screens[0].id);
  }, [design, screenId]);

  // ---------- canvas ----------
  const frame = useRef<HTMLIFrameElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [wrapSize, setWrapSize] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWrapSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [phone]);
  const [frameReady, setFrameReady] = useState(0);
  const htmlKey = project.files.filter((f) => f.kind === 'file' && /\.(html|css)$/.test(f.path)).map((f) => f.path + '\n' + f.content).join('\n');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const base = useMemo(() => canvasBase(project, urls), [htmlKey, urls]);

  const doc = () => frame.current?.contentDocument ?? null;

  const placeHandle = useCallback(() => {
    const d = doc();
    if (!d) return;
    const handle = d.getElementById('zm-handle');
    if (!handle) return;
    const el = selected ? d.querySelector<HTMLElement>(`[data-zm-id="${CSS.escape(selected)}"]`) : null;
    const t = selNode?.type;
    if (!el || !el.getClientRects().length || t === 'navbar' || t === 'section' || t === 'divider') {
      handle.style.display = 'none';
      return;
    }
    const r = el.getBoundingClientRect();
    const sx = d.defaultView?.scrollX ?? 0, sy = d.defaultView?.scrollY ?? 0;
    handle.style.display = 'block';
    handle.style.left = `${r.right + sx - 9}px`;
    handle.style.top = `${r.bottom + sy - 9}px`;
  }, [selected, selNode?.type]);

  // Draw the design into the canvas whenever it (or the selection) changes.
  useEffect(() => {
    const d = doc();
    if (!d) return;
    const root = d.getElementById(DESIGN_ROOT_ID);
    const css = d.getElementById('zm-design-css');
    if (!root || !css) return;
    css.textContent = replaceAssetRefs(designCss(design.theme), urls);
    root.outerHTML = replaceAssetRefs(renderDesign(design, { onlyScreenId: screen.id }), urls);
    const s = d.getElementById('zm-sel');
    if (s) s.textContent = selected ? `[data-zm-id="${CSS.escape(selected)}"]{outline:2.5px solid #5b4bdb!important;outline-offset:2px}` : '';
    let handle = d.getElementById('zm-handle');
    if (!handle) {
      handle = d.createElement('div');
      handle.id = 'zm-handle';
      handle.title = 'Drag to resize';
      d.body.appendChild(handle);
    }
    // images change size once loaded
    d.querySelectorAll('img').forEach((img) => img.addEventListener('load', placeHandle, { once: true }));
    placeHandle();
  }, [design, screen.id, selected, urls, frameReady, placeHandle]);

  // Pointer handling inside the canvas: select, drag free things, resize.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  useEffect(() => {
    const d = doc();
    if (!d) return;
    let drag: null | { mode: 'move' | 'resize'; id: string; el: HTMLElement; sx: number; sy: number; x0: number; y0: number; w0: number; h0: number; moved: boolean; pid: number } = null;
    const nodeEl = (t: EventTarget | null) => (t instanceof d.defaultView!.Element ? (t.closest('[data-zm-id]') as HTMLElement | null) : null);

    const down = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.id === 'zm-handle' && selectedRef.current) {
        const el = d.querySelector<HTMLElement>(`[data-zm-id="${CSS.escape(selectedRef.current)}"]`);
        if (!el) return;
        e.preventDefault();
        drag = { mode: 'resize', id: selectedRef.current, el, sx: e.clientX, sy: e.clientY, x0: 0, y0: 0, w0: el.offsetWidth, h0: el.offsetHeight, moved: false, pid: e.pointerId };
        target.setPointerCapture(e.pointerId);
        return;
      }
      const el = nodeEl(e.target);
      e.preventDefault(); // no focusing, no text selection, no native dragging in the canvas
      if (!el) {
        setSelected(null);
        return;
      }
      const id = el.getAttribute('data-zm-id')!;
      setSelected(id);
      if (phone) setTab('props');
      if (el.classList.contains('zm-free')) {
        drag = { mode: 'move', id, el, sx: e.clientX, sy: e.clientY, x0: el.offsetLeft, y0: el.offsetTop, w0: 0, h0: 0, moved: false, pid: e.pointerId };
        try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      }
    };
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.pid) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
      if (drag.mode === 'move') {
        drag.el.style.left = `${Math.round(drag.x0 + dx)}px`;
        drag.el.style.top = `${Math.round(drag.y0 + dy)}px`;
      } else {
        drag.el.style.width = `${Math.max(8, Math.round(drag.w0 + dx))}px`;
        drag.el.style.height = `${Math.max(8, Math.round(drag.h0 + dy))}px`;
        if (drag.el.classList.contains('zm-character')) drag.el.style.fontSize = `${Math.max(8, Math.round(drag.h0 + dy))}px`;
      }
      placeHandle();
    };
    const up = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.pid) return;
      const g = drag;
      drag = null;
      if (!g.moved) return;
      const dx = e.clientX - g.sx, dy = e.clientY - g.sy;
      commit(updateNode(designRef.current, g.id, (n) => {
        if (g.mode === 'move') {
          n.props.x = Math.round(g.x0 + dx);
          n.props.y = Math.round(g.y0 + dy);
        } else if (n.type === 'character') {
          n.props.size = Math.max(8, Math.round(g.h0 + dy));
        } else {
          n.props.width = String(Math.max(8, Math.round(g.w0 + dx)));
          if (n.type !== 'title' && n.type !== 'text' && n.type !== 'button' && n.type !== 'link') n.props.height = String(Math.max(8, Math.round(g.h0 + dy)));
        }
      }));
    };
    const click = (e: MouseEvent) => e.preventDefault();
    d.addEventListener('pointerdown', down, true);
    d.addEventListener('pointermove', move, true);
    d.addEventListener('pointerup', up, true);
    d.addEventListener('pointercancel', up, true);
    d.addEventListener('click', click, true);
    d.addEventListener('scroll', placeHandle);
    d.addEventListener('keydown', onKey);
    return () => {
      d.removeEventListener('pointerdown', down, true);
      d.removeEventListener('pointermove', move, true);
      d.removeEventListener('pointerup', up, true);
      d.removeEventListener('pointercancel', up, true);
      d.removeEventListener('click', click, true);
      d.removeEventListener('scroll', placeHandle);
      d.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameReady, commit, placeHandle, phone]);

  // ---------- actions ----------
  const add = (type: CompType, extra: Record<string, PropValue> = {}, name?: string) => {
    const d = designRef.current;
    const node = makeNode(d, type, extra, name);
    let target = selNode ? selNode.id : null;
    const isThing = !['section', 'row', 'column', 'card', 'stage', 'navbar', 'spacer', 'divider'].includes(type);
    if (!target && isThing && (project.type === 'game' || project.type === 'animation')) target = firstStage(screen)?.id ?? null;
    if (type === 'navbar') {
      // nav bars always belong at the very top of the screen
      const next = clone(d);
      next.screens.find((s) => s.id === screen.id)!.nodes.unshift(node);
      commit(next);
    } else {
      const tl = target ? locate(d, target) : null;
      const inStage = !!tl && (tl.node.type === 'stage' || tl.parent?.type === 'stage');
      if (tl && (type === 'section' || (type === 'stage' && inStage))) {
        // Bands (and stages next to a stage) sit on the screen itself, after the top-level thing holding the selection.
        const next = clone(d);
        const list = next.screens.find((s) => s.id === screen.id)!.nodes;
        const topIndex = list.findIndex((n) => { let hit = false; walk([n], (m) => { if (m.id === tl.node.id) hit = true; }); return hit; });
        list.splice(topIndex + 1, 0, node);
        commit(next);
        setSelected(node.id);
        if (phone) setTab('props');
        return;
      }
      commit(insertNode(d, screen.id, node, target));
    }
    setSelected(node.id);
    if (phone) setTab('props');
  };

  const upload = useRef<HTMLInputElement>(null);
  const onUpload = async (files: FileList | null) => {
    const added = await storeAssetFiles(project, files);
    if (!added.length) return;
    onUpdate((p) => ({ ...p, assets: [...p.assets, ...added] }));
    const pics = added.filter((a) => a.mime.startsWith('image/'));
    if (pics.length) {
      // add the first new picture straight away
      const stem = pics[0].name.replace(/\.[^.]+$/, '');
      setTimeout(() => add('image', { image: pics[0].name }, stem), 0);
    }
    toast(added.length === 1 ? `Added “${added[0].name}”.` : `Added ${added.length} pictures.`);
  };

  const setProp = (key: string, v: PropValue | undefined) => {
    if (!selNode) return;
    commit(updateNode(designRef.current, selNode.id, (n) => {
      if (v === undefined || v === '') delete n.props[key];
      else n.props[key] = v;
    }), `${selNode.id}:${key}`);
  };

  const rename = (raw: string) => {
    if (!selNode) return;
    const name = uniqueName(designRef.current, safeThingName(raw), selNode.id);
    if (name === selNode.name) return;
    const old = selNode.name;
    commit(updateNode(designRef.current, selNode.id, (n) => { n.name = name; }));
    if (raw !== name) toast(`Names can only use letters, numbers, - and _. Using “${name}”.`);
    else toast(`Renamed to “${name}”. Blocks that used “${old}” need the new name.`);
  };

  const removeSel = useCallback(async () => {
    if (!selectedRef.current) return;
    const loc = locate(designRef.current, selectedRef.current);
    if (!loc) return;
    if (loc.node.children?.length && !(await confirmDialog({ title: `Delete “${loc.node.name}”?`, message: 'Everything inside it is deleted too. (You can undo.)', confirm: 'Delete', danger: true }))) return;
    commit(removeNode(designRef.current, loc.node.id));
    setSelected(null);
  }, [commit]);

  const nudge = (dx: number, dy: number) => {
    const id = selectedRef.current;
    if (!id) return;
    const loc = locate(designRef.current, id);
    if (!loc || !loc.parent || !COMPONENT_BY_TYPE.get(loc.parent.type)?.free) return;
    commit(updateNode(designRef.current, id, (n) => {
      n.props.x = (Number(n.props.x) || 0) + dx;
      n.props.y = (Number(n.props.y) || 0) + dy;
    }), `${id}:nudge`);
  };

  const duplicate = () => {
    if (!selNode) return;
    const r = duplicateNode(designRef.current, selNode.id);
    commit(r.design);
    if (r.newId) setSelected(r.newId);
  };

  function onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
    if (!selectedRef.current) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); void removeSel(); }
    else if (e.key.startsWith('Arrow')) {
      const step = e.shiftKey ? 10 : 1;
      const [dx, dy] = e.key === 'ArrowLeft' ? [-step, 0] : e.key === 'ArrowRight' ? [step, 0] : e.key === 'ArrowUp' ? [0, -step] : [0, step];
      e.preventDefault();
      nudge(dx, dy);
    } else if (e.key === 'Escape') setSelected(null);
  }
  useEffect(() => {
    if (!visible) return;
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('.blocklySvg, .cm-editor, [role=dialog]')) return;
      onKey(e);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  // ---------- screens ----------
  const addScreen = async () => {
    const name = await promptDialog({
      title: 'New screen', label: 'Name of the screen (for example: About, Shop, Settings)', confirm: 'Create',
      validate: (v) => (!v.trim() ? 'Please type a name.' : designRef.current.screens.some((s) => s.name.toLowerCase() === v.trim().toLowerCase()) ? 'There is already a screen with that name.' : null),
    });
    if (!name) return;
    const next = clone(designRef.current);
    const s: Screen = { id: newId('scr'), name: name.trim().slice(0, 40), background: '', nodes: [] };
    // Copy the nav bar so every screen can go back.
    const nav = next.screens[0].nodes.find((n) => n.type === 'navbar');
    if (nav) {
      const copy = makeNode(next, 'navbar', { ...nav.props }, nav.name);
      s.nodes.push(copy);
    }
    next.screens.push(s);
    commit(next);
    setScreenId(s.id);
    setSelected(null);
  };
  const renameScreen = (raw: string) => {
    const name = raw.trim().slice(0, 40);
    if (!name || name === screen.name) return;
    if (designRef.current.screens.some((s) => s.id !== screen.id && s.name.toLowerCase() === name.toLowerCase())) {
      toast('There is already a screen with that name.', 'error');
      return;
    }
    const old = screen.name;
    const next = clone(designRef.current);
    next.screens.find((s) => s.id === screen.id)!.name = name;
    // keep “go to screen” buttons pointing at it
    for (const s of next.screens) walk(s.nodes, (n) => { if (n.props.tap === 'screen' && n.props.tapValue === old) n.props.tapValue = name; });
    commit(next);
  };
  const deleteScreen = async () => {
    if (designRef.current.screens.length < 2) return;
    if (!(await confirmDialog({ title: `Delete the screen “${screen.name}”?`, message: 'Everything on it is deleted. (You can undo.)', confirm: 'Delete screen', danger: true }))) return;
    const next = clone(designRef.current);
    next.screens = next.screens.filter((s) => s.id !== screen.id);
    commit(next);
    setScreenId(next.screens[0].id);
    setSelected(null);
  };
  const setScreenProp = (key: 'background', v: string) => {
    const next = clone(designRef.current);
    next.screens.find((s) => s.id === screen.id)![key] = v;
    commit(next, `screen:${screen.id}:${key}`);
  };
  const setTheme = (key: keyof Design['theme'], v: string) => {
    const next = clone(designRef.current);
    (next.theme as unknown as Record<string, string>)[key] = v;
    commit(next, `theme:${key}`);
  };

  // ---------- panels ----------
  const groups = ['Layout', 'Text', 'Pictures', 'Controls'] as const;
  const palette = (
    <div className="dz-palette">
      {groups.map((g) => (
        <div key={g} className="dz-group">
          <h4>{g}</h4>
          <div className="dz-grid">
            {COMPONENTS.filter((c) => c.group === g).map((c) => (
              <button key={c.type} type="button" className="dz-add" onClick={() => add(c.type)} title={c.help} data-testid={`add-${c.type}`}>
                <span aria-hidden="true">{c.icon}</span>{c.label}
              </button>
            ))}
          </div>
          {g === 'Pictures' && (
            <div className="dz-pics">
              {images.map((a) => (
                <button key={a.id} type="button" className="dz-pic" onClick={() => add('image', { image: a.name }, a.name.replace(/\.[^.]+$/, ''))} title={`Add ${a.name}`} aria-label={`Add picture ${a.name}`}>
                  {urls[a.name] ? <img src={urls[a.name]} alt="" /> : '🖼'}
                </button>
              ))}
              <button type="button" className="dz-pic dz-upload" onClick={() => upload.current?.click()} title="Upload pictures" aria-label="Upload pictures">＋</button>
              <input ref={upload} type="file" accept={ACCEPT_IMAGES} multiple hidden aria-label="Upload pictures to the design" onChange={(e) => { void onUpload(e.target.files); e.target.value = ''; }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const layerRows: { node: DesignNode; depth: number }[] = [];
  const collect = (list: DesignNode[], depth: number) => list.forEach((n) => { layerRows.push({ node: n, depth }); if (n.children) collect(n.children, depth + 1); });
  collect(screen.nodes, 0);
  const layers = (
    <div className="dz-layers" role="tree" aria-label="Layers">
      {layerRows.length === 0 && <p className="hint">Nothing on this screen yet.</p>}
      {layerRows.map(({ node: n, depth }) => (
        <button key={n.id} type="button" role="treeitem" aria-selected={n.id === selected} className="dz-layer" style={{ paddingLeft: 8 + depth * 14 }} onClick={() => { setSelected(n.id); if (phone) setTab('props'); }}>
          <span aria-hidden="true">{COMPONENT_BY_TYPE.get(n.type)?.icon}</span> {n.name} <span className="hint">{COMPONENT_BY_TYPE.get(n.type)?.label}</span>
        </button>
      ))}
    </div>
  );

  const containers: DesignNode[] = [];
  if (selNode) walk(screen.nodes, (n) => {
    if (!n.children || n.id === selNode.id) return;
    let inside = false;
    walk([selNode], (m) => { if (m.id === n.id) inside = true; });
    if (!inside) containers.push(n);
  });

  const fieldProps = (spec: FieldSpec) => ({ spec, value: selNode?.props[spec.key], onChange: (v: PropValue | undefined) => setProp(spec.key, v), images, screens: design.screens, urls });

  let props: React.ReactNode;
  if (broken) {
    props = (
      <div className="dz-section">
        <p>design.json has a mistake, so the design can’t be shown. Fix it in Code view, or start a new design.</p>
        <button className="btn btn-danger" onClick={() => commit(emptyDesign())}>Start a new design</button>
      </div>
    );
  } else if (!selNode) {
    props = (
      <>
        <div className="dz-section">
          <h4>Screen</h4>
          <div className="dz-field">
            <label htmlFor="dz-screen-name">Name</label>
            <input id="dz-screen-name" key={screen.id + screen.name} className="input" defaultValue={screen.name} onBlur={(e) => renameScreen(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
          </div>
          <div className="dz-field"><label>Background</label><ColorField value={screen.background} onChange={(v) => setScreenProp('background', v)} /></div>
          {design.screens.length > 1 && <button className="btn btn-sm" onClick={() => void deleteScreen()}>Delete this screen</button>}
        </div>
        <div className="dz-section">
          <h4>Theme (whole project)</h4>
          <div className="dz-field"><label>Main colour</label><ColorField value={design.theme.primary} onChange={(v) => setTheme('primary', v || '#5b4bdb')} /></div>
          <div className="dz-field"><label>Page colour</label><ColorField value={design.theme.background} onChange={(v) => setTheme('background', v || '#ffffff')} /></div>
          <div className="dz-field"><label>Text colour</label><ColorField value={design.theme.text} onChange={(v) => setTheme('text', v || '#1d2433')} /></div>
          <div className="dz-field">
            <label htmlFor="dz-font">Font</label>
            <select id="dz-font" className="input" value={design.theme.font} onChange={(e) => setTheme('font', e.target.value)}>
              <option value="modern">Modern</option><option value="rounded">Rounded</option><option value="classic">Classic</option><option value="playful">Playful</option><option value="mono">Code</option>
            </select>
          </div>
          <div className="dz-field">
            <label htmlFor="dz-corners">Corners</label>
            <select id="dz-corners" className="input" value={design.theme.corners} onChange={(e) => setTheme('corners', e.target.value)}>
              <option value="square">Square</option><option value="rounded">Rounded</option><option value="round">Round</option>
            </select>
          </div>
        </div>
        <p className="hint dz-tip">Tip: click anything on the canvas to change it. Things you add go inside the selected box, or after the selected thing.</p>
      </>
    );
  } else {
    const spec = COMPONENT_BY_TYPE.get(selNode.type)!;
    const parentFree = !!(sel?.parent && COMPONENT_BY_TYPE.get(sel.parent.type)?.free);
    const tap = String(selNode.props.tap ?? '');
    props = (
      <>
        <div className="dz-section">
          <div className="dz-head"><span aria-hidden="true">{spec.icon}</span> <strong>{spec.label}</strong></div>
          <div className="dz-field">
            <label htmlFor="dz-name">Name (used in blocks)</label>
            <input id="dz-name" key={selNode.id + selNode.name} className="input" defaultValue={selNode.name} spellCheck={false} data-testid="dz-name"
              onBlur={(e) => rename(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
          </div>
          <div className="dz-actions">
            <button className="btn btn-sm btn-icon" onClick={() => commit(moveNode(designRef.current, selNode.id, -1))} aria-label="Move up" title="Move up">↑</button>
            <button className="btn btn-sm btn-icon" onClick={() => commit(moveNode(designRef.current, selNode.id, 1))} aria-label="Move down" title="Move down">↓</button>
            <button className="btn btn-sm" onClick={duplicate}>Duplicate</button>
            <button className="btn btn-sm" onClick={() => void removeSel()} data-testid="dz-delete">Delete</button>
          </div>
          <div className="dz-field">
            <label htmlFor="dz-parent">Inside</label>
            <select id="dz-parent" className="input" value={sel?.parent?.id ?? ''} onChange={(e) => commit(reparentNode(designRef.current, selNode.id, e.target.value || null))}>
              <option value="">The screen</option>
              {containers.map((c) => <option key={c.id} value={c.id}>{COMPONENT_BY_TYPE.get(c.type)?.icon} {c.name}</option>)}
            </select>
          </div>
        </div>
        {spec.fields.length > 0 && (
          <div className="dz-section">
            <h4>Content</h4>
            {spec.fields.map((f) => <Field key={f.key} {...fieldProps(f)} />)}
          </div>
        )}
        {(spec.tappable || spec.changes) && (
          <div className="dz-section dz-does">
            <h4>{spec.changes ? 'When it changes' : 'When tapped'}</h4>
            {spec.tappable && (
              <>
                <Field {...fieldProps({ key: 'tap', label: 'Do this', kind: 'select', options: TAP_ACTIONS })} />
                {tap === 'screen' && <Field {...fieldProps({ key: 'tapValue', label: 'Screen', kind: 'screen' })} />}
                {tap === 'say' && <Field {...fieldProps({ key: 'tapValue', label: 'Message', kind: 'text' })} />}
                {tap === 'sound' && <Field {...fieldProps({ key: 'tapValue', label: 'Sound', kind: 'select', options: SOUND_CHOICES })} />}
                {tap === 'link' && <Field {...fieldProps({ key: 'tapValue', label: 'Web address', kind: 'text', hint: 'Opens in the exported web page.' })} />}
              </>
            )}
            <button className="btn btn-sm btn-primary" onClick={() => onUseBlocks(selNode.name, spec.changes ? 'change' : 'click')} data-testid="dz-use-blocks">
              🧩 {spec.changes ? 'Do something when it changes…' : 'Make it do more with blocks…'}
            </button>
          </div>
        )}
        {parentFree && (
          <div className="dz-section">
            <h4>Position on the stage</h4>
            <div className="dz-two">
              <Field {...fieldProps({ key: 'x', label: 'x (across)', kind: 'number' })} />
              <Field {...fieldProps({ key: 'y', label: 'y (down)', kind: 'number' })} />
            </div>
            <span className="hint">Or drag it on the canvas. Arrow keys move it a little.</span>
          </div>
        )}
        <div className="dz-section">
          <h4>Size & spacing</h4>
          {selNode.type === 'character' && <Field {...fieldProps({ key: 'size', label: 'Size', kind: 'number' })} />}
          <div className="dz-two">
            {SIZE_FIELDS.filter((f) => (f.key !== 'gap' || spec.container) && !(selNode.type === 'character' && (f.key === 'width' || f.key === 'height'))).map((f) => <Field key={f.key} {...fieldProps(f)} />)}
          </div>
        </div>
        <details className="dz-section" open={!phone}>
          <summary><h4>Look</h4></summary>
          {LOOK_FIELDS.filter((f) => !(selNode.type === 'character' && f.key === 'size')).map((f) => <Field key={f.key} {...fieldProps(f)} />)}
        </details>
        <p className="hint dz-tip">{spec.help}</p>
      </>
    );
  }

  const screenBar = (
    <div className="dz-bar">
      <div className="dz-screens" role="tablist" aria-label="Screens">
        {design.screens.map((s) => (
          <button key={s.id} role="tab" aria-selected={s.id === screen.id} className={`btn btn-sm ${s.id === screen.id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setScreenId(s.id); setSelected(null); }}>📱 {s.name}</button>
        ))}
        <button className="btn btn-sm btn-ghost" onClick={() => void addScreen()} data-testid="add-screen">＋ Screen</button>
      </div>
      <span className="grow" />
      {!phone && <div className="seg" role="group" aria-label="Canvas size">
        {(['phone', 'tablet', 'desktop'] as Device[]).map((dv) => (
          <button key={dv} aria-pressed={device === dv} onClick={() => setDevice(dv)} title={`${dv} size`}>{dv === 'phone' ? '📱' : dv === 'tablet' ? '▭' : '🖥'}<span className="hide-phone"> {dv[0].toUpperCase() + dv.slice(1)}</span></button>
        ))}
      </div>}
    </div>
  );

  // Zoom the canvas out when the chosen size is wider than the space (like a browser's zoom).
  const width = phone ? Math.max(280, wrapSize.w - 16) : DEVICE_WIDTH[device];
  const scale = phone ? 1 : Math.min(1, Math.max(0.3, (wrapSize.w - 32) / width));
  const height = Math.max(320, (wrapSize.h - 32) / scale);
  const canvas = (
    <div ref={wrap} className="dz-canvas-wrap" onPointerDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
      <div className="dz-canvas-box" style={{ width: width * scale, height: height * scale }}>
        <iframe
          ref={frame}
          className="dz-canvas"
          title="Design canvas"
          sandbox="allow-same-origin"
          srcDoc={base}
          style={{ width, height, transform: scale < 1 ? `scale(${scale})` : undefined }}
          onLoad={() => setFrameReady((n) => n + 1)}
          data-testid="design-canvas"
        />
      </div>
      {scale < 0.999 && <span className="dz-zoom hint">{Math.round(scale * 100)}%</span>}
    </div>
  );

  if (phone) {
    return (
      <div className="design is-phone">
        {screenBar}
        {canvas}
        <div className="dz-tabs seg" role="tablist" aria-label="Design panels">
          <button role="tab" aria-pressed={tab === 'add'} onClick={() => setTab('add')}>＋ Add</button>
          <button role="tab" aria-pressed={tab === 'layers'} onClick={() => setTab('layers')}>Layers</button>
          <button role="tab" aria-pressed={tab === 'props'} onClick={() => setTab('props')}>{selNode ? 'Change it' : 'Screen'}</button>
        </div>
        <div className="dz-panel">{tab === 'add' ? palette : tab === 'layers' ? layers : props}</div>
      </div>
    );
  }

  return (
    <div className="design">
      <aside className="dz-left" aria-label="Add things">
        <h3>Add</h3>
        {palette}
        <h3>Layers</h3>
        {layers}
      </aside>
      <div className="dz-middle">
        {screenBar}
        {canvas}
      </div>
      <aside className="dz-right" aria-label="Properties">{props}</aside>
    </div>
  );
});
