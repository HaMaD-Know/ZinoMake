/**
 * Turns a design into plain HTML + CSS. Used by the preview, the exported web page and the
 * designer canvas, so what you see while designing is exactly what runs.
 *
 * Every component becomes a real element whose id is its name, so blocks and the runtime
 * work on designed things just like on things written in index.html.
 */
import { COMPONENT_BY_TYPE, type Design, type DesignNode, type PropValue, type Theme } from './model';

export const DESIGN_ROOT_ID = 'zm-design-root';

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Only allow plain colour words / #hex / rgb() / hsl() in style values (no `;` or `url(`). */
function colour(v: PropValue | undefined): string {
  const s = String(v ?? '').trim();
  return /^(#[0-9a-f]{3,8}|[a-z]{3,30}|(rgb|rgba|hsl|hsla)\([\d\s.,%/-]+\))$/i.test(s) ? s : '';
}

function len(v: PropValue | undefined): string {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v === 'number') return Number.isFinite(v) ? `${v}px` : '';
  const s = String(v).trim();
  if (/^-?\d+(\.\d+)?$/.test(s)) return `${s}px`;
  if (/^\d+(\.\d+)?(%|px|vh|vw|em|rem)$/.test(s)) return s;
  if (s === 'auto') return 'auto';
  return '';
}

function num(v: PropValue | undefined): number | null {
  if (v === undefined || v === '' || v === null || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const FLEX: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch', between: 'space-between' };

function assetUrl(name: PropValue | undefined): string {
  const n = String(name ?? '').replace(/["'()\\\s]/g, '');
  return n ? `assets/${n}` : '';
}

function styleOf(n: DesignNode, free: boolean): string {
  const p = n.props;
  const st: string[] = [];
  const add = (k: string, v: string) => { if (v) st.push(`${k}:${v}`); };
  if (free) {
    st.push('position:absolute', 'margin:0');
    add('left', len(num(p.x) ?? 0));
    add('top', len(num(p.y) ?? 0));
  }
  add('width', len(p.width));
  add('height', len(p.height));
  add(n.type === 'divider' ? 'border-top-color' : 'background-color', colour(p.bg));
  if (n.type === 'divider') add('border-top-color', colour(p.color));
  else add('color', colour(p.color));
  const size = num(p.size);
  if (n.type === 'character') add('font-size', len(size ?? 48));
  else if (size) add('font-size', `${size}px`);
  if (p.bold) st.push('font-weight:800');
  if (p.textAlign && ['left', 'center', 'right'].includes(String(p.textAlign))) add('text-align', String(p.textAlign));
  const r = num(p.radius);
  if (r !== null && n.type !== 'shape') add('border-radius', `${r}px`);
  if (n.type === 'shape') add('border-radius', p.shape === 'circle' ? '50%' : p.shape === 'pill' ? '999px' : r !== null ? `${r}px` : '8px');
  const bc = colour(p.border);
  if (bc) st.push(`border:${num(p.borderWidth) ?? 2}px solid ${bc}`);
  if (p.shadow === 'soft') st.push('box-shadow:0 4px 18px rgba(20,24,40,.12)');
  if (p.shadow === 'strong') st.push('box-shadow:0 12px 36px rgba(20,24,40,.28)');
  const o = num(p.opacity);
  if (o !== null && o > 0) add('opacity', String(Math.max(0, Math.min(100, 100 - o)) / 100));
  const pad = num(p.padding);
  if (pad !== null) add('padding', `${pad}px`);
  const gap = num(p.gap);
  if (gap !== null && COMPONENT_BY_TYPE.get(n.type)?.container) add('gap', `${gap}px`);
  const m = num(p.margin);
  if (m !== null) add('margin-bottom', `${m}px`);
  if (n.type === 'row' || n.type === 'column' || n.type === 'card') {
    add('align-items', FLEX[String(p.align)] ?? '');
    add('justify-content', FLEX[String(p.justify)] ?? '');
  }
  if (n.type === 'row' && p.wrap === false) st.push('flex-wrap:nowrap');
  if (n.type === 'stage' || n.type === 'section' || n.type === 'card') {
    const img = assetUrl(p.image);
    if (img) st.push(`background-image:url("${img}")`, 'background-size:cover', 'background-position:center');
  }
  if (n.type === 'grid') {
    const cols = Math.max(1, Math.min(8, Math.round(num(p.columns) ?? 3)));
    st.push(`--zm-cols:${cols}`);
  }
  if (n.type === 'image' && p.round) st.push('border-radius:50%', 'aspect-ratio:1');
  if (n.type === 'image') add('object-fit', ['contain', 'cover', 'fill'].includes(String(p.fit)) ? String(p.fit) : 'contain');
  if (p.hidden) st.push('display:none');
  return st.join(';');
}

interface Ctx {
  design: Design;
}

function attrs(n: DesignNode, free: boolean, extraClass = ''): string {
  const spec = COMPONENT_BY_TYPE.get(n.type)!;
  const cls = ['zm', `zm-${n.type}`, free ? 'zm-free' : '', extraClass];
  let tap = '';
  if (spec.tappable && n.props.tap) {
    tap = ` data-zm-tap="${esc(n.props.tap)}" data-zm-value="${esc(n.props.tapValue ?? '')}"`;
    cls.push('zm-tappable');
  }
  const style = styleOf(n, free);
  return `id="${esc(n.name)}" data-name="${esc(n.name)}" data-zm-id="${esc(n.id)}" class="${cls.filter(Boolean).join(' ')}"${style ? ` style="${esc(style)}"` : ''}${tap}`;
}

function children(n: DesignNode, ctx: Ctx): string {
  const free = !!COMPONENT_BY_TYPE.get(n.type)?.free;
  return (n.children ?? []).map((c) => node(c, ctx, free)).join('');
}

function label(text: PropValue | undefined): string {
  const t = String(text ?? '').trim();
  return t ? `<span class="zm-label">${esc(t)}</span>` : '';
}

function node(n: DesignNode, ctx: Ctx, free: boolean): string {
  const p = n.props;
  const a = (extra = '') => attrs(n, free, extra);
  switch (n.type) {
    case 'navbar': {
      const links = p.links !== false
        ? ctx.design.screens.map((s) => `<button type="button" class="zm-navlink" data-zm-tap="screen" data-zm-value="${esc(s.name)}">${esc(s.name)}</button>`).join('')
        : '';
      return `<nav ${a(p.sticky !== false ? 'zm-sticky' : '')}><div class="zm-brand">${esc(p.text)}</div><div class="zm-navlinks">${links}</div></nav>`;
    }
    case 'section': {
      const w = ['full', 'wide', 'narrow'].includes(String(p.width)) ? String(p.width) : 'wide';
      // width/height apply to the band itself; the inner box limits how wide the content is.
      const inner = [`align-items:${FLEX[String(p.align)] ?? 'center'}`];
      const gap = num(p.gap);
      if (gap !== null) inner.push(`gap:${gap}px`);
      const ta = ['left', 'center', 'right'].includes(String(p.textAlign)) ? `;text-align:${p.textAlign}` : '';
      const n2 = { ...n, props: { ...p, gap: '', width: '', textAlign: '' } };
      return `<section ${attrs(n2, free)}><div class="zm-inner zm-w-${w}" style="${esc(inner.join(';') + ta)}">${children(n, ctx)}</div></section>`;
    }
    case 'row':
    case 'column':
    case 'grid':
    case 'card':
      return `<div ${a()}>${children(n, ctx)}</div>`;
    case 'badge':
      return `<span ${a()}>${esc(p.text)}</span>`;
    case 'faq':
      return `<details ${a()}${p.open ? ' open' : ''}><summary>${esc(p.text)}</summary><p>${esc(p.answer).replace(/\n/g, '<br>')}</p></details>`;
    case 'table': {
      const rows = String(p.rows ?? '').split('\n').map((r) => r.split(',').map((c) => c.trim())).filter((r) => r.some(Boolean));
      const [head, ...body] = rows;
      const th = head ? `<thead><tr>${head.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>` : '';
      const tb = `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
      return `<div ${a()}><table>${th}${tb}</table></div>`;
    }
    case 'progress': {
      const max = Math.max(1, num(p.max) ?? 100);
      const val = Math.max(0, Math.min(max, num(p.value) ?? 0));
      return `<label ${a('zm-field')}>${label(p.label)}<progress max="${max}" value="${val}"></progress></label>`;
    }
    case 'stage':
      return `<div ${a('stage')}>${children(n, ctx)}</div>`;
    case 'spacer':
      return `<div ${a()} aria-hidden="true"></div>`;
    case 'divider':
      return `<hr ${a()}>`;
    case 'title': {
      const lvl = ['1', '2', '3'].includes(String(p.level)) ? String(p.level) : '1';
      return `<h${lvl} ${a(`zm-h${lvl}`)}>${esc(p.text)}</h${lvl}>`;
    }
    case 'text':
      return `<p ${a()}>${esc(p.text).replace(/\n/g, '<br>')}</p>`;
    case 'list': {
      const tag = p.numbered ? 'ol' : 'ul';
      const items = String(p.items ?? '').split('\n').map((s) => s.trim()).filter(Boolean).map((s) => `<li>${esc(s)}</li>`).join('');
      return `<${tag} ${a()}>${items}</${tag}>`;
    }
    case 'link':
      return `<a ${a()} href="${esc(/^(https?:|mailto:|tel:|#)/i.test(String(p.url ?? '')) ? p.url : '#')}" target="_blank" rel="noopener">${esc(p.text)}</a>`;
    case 'image': {
      const src = assetUrl(p.image);
      if (!src) return `<div ${a('zm-placeholder')}>🖼 Choose a picture</div>`;
      return `<img ${a()} src="${esc(src)}" alt="${esc(p.alt ?? '')}" draggable="false">`;
    }
    case 'character':
      return `<div ${a()} role="img" aria-label="${esc(n.name)}">${esc(p.emoji)}</div>`;
    case 'shape':
      return `<div ${a()}></div>`;
    case 'button':
      return `<button type="button" ${a(`zm-btn-${['primary', 'soft', 'outline', 'plain'].includes(String(p.variant)) ? p.variant : 'primary'}`)}>${esc(p.text)}</button>`;
    case 'input': {
      const t = ['text', 'number', 'email', 'password', 'tel', 'date', 'time', 'color'].includes(String(p.inputType)) ? String(p.inputType) : 'text';
      return `<label ${a('zm-field')}>${label(p.label)}<input type="${t}" placeholder="${esc(p.placeholder ?? '')}"></label>`;
    }
    case 'textarea':
      return `<label ${a('zm-field')}>${label(p.label)}<textarea rows="${Math.max(1, Math.min(30, num(p.rows) ?? 4))}" placeholder="${esc(p.placeholder ?? '')}"></textarea></label>`;
    case 'checkbox':
      return `<label ${a()}><input type="checkbox"${p.checked ? ' checked' : ''}><span>${esc(p.text)}</span></label>`;
    case 'select': {
      const opts = String(p.options ?? '').split(',').map((s) => s.trim()).filter(Boolean).map((s) => `<option>${esc(s)}</option>`).join('');
      return `<label ${a('zm-field')}>${label(p.label)}<select>${opts}</select></label>`;
    }
    case 'slider': {
      const min = num(p.min) ?? 0, max = num(p.max) ?? 100, val = num(p.value) ?? min;
      return `<label ${a('zm-field')}>${label(p.label)}<input type="range" min="${min}" max="${max}" value="${val}"></label>`;
    }
  }
}

export interface RenderOptions {
  /** Render only this screen, visible (used by the designer canvas). */
  onlyScreenId?: string;
}

/** The design as HTML: one `.zm-screen` per screen; only the first is visible when running. */
export function renderDesign(design: Design, opts: RenderOptions = {}): string {
  const ctx: Ctx = { design };
  const screens = opts.onlyScreenId ? design.screens.filter((s) => s.id === opts.onlyScreenId) : design.screens;
  const html = screens
    .map((s, i) => {
      const bg = colour(s.background);
      const hidden = !opts.onlyScreenId && i > 0 ? ' hidden' : '';
      return `<div class="zm-screen" data-screen="${esc(s.name)}"${bg ? ` style="background-color:${bg}"` : ''}${hidden}>${s.nodes.map((n) => node(n, ctx, false)).join('')}</div>`;
    })
    .join('');
  return `<div id="${DESIGN_ROOT_ID}">${html}</div>`;
}

const FONTS: Record<Theme['font'], string> = {
  rounded: "'Nunito', 'Segoe UI Rounded', 'SF Pro Rounded', system-ui, sans-serif",
  modern: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  classic: "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
  mono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  playful: "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', cursive",
};

export function designCss(theme: Theme): string {
  const r = theme.corners === 'square' ? '4px' : theme.corners === 'round' ? '999px' : '12px';
  const primary = colour(theme.primary) || '#5b4bdb';
  return `:root{--zm-primary:${primary};--zm-bg:${colour(theme.background) || '#fff'};--zm-text:${colour(theme.text) || '#1d2433'};--zm-font:${FONTS[theme.font] ?? FONTS.modern};--zm-r:${r}}
body:has(#${DESIGN_ROOT_ID}){margin:0;background:var(--zm-bg);color:var(--zm-text);font-family:var(--zm-font)}
#${DESIGN_ROOT_ID}{font-family:var(--zm-font);color:var(--zm-text);width:100%}
#${DESIGN_ROOT_ID} *{box-sizing:border-box}
.zm-screen{display:flex;flex-direction:column;gap:16px;min-height:100%;width:100%}
.zm-screen[hidden]{display:none!important}
.zm-screen>.zm:not(.zm-navbar):not(.zm-section){margin-left:16px;margin-right:16px}
.zm-screen>.zm-stage{margin-left:auto;margin-right:auto}
.zm-section{padding:40px 20px;width:100%}
.zm-inner{display:flex;flex-direction:column;gap:16px;margin:0 auto;width:100%}
.zm-w-wide{max-width:1100px}.zm-w-narrow{max-width:680px}.zm-w-full{max-width:none}
.zm-row{display:flex;flex-direction:row;gap:12px;align-items:center;flex-wrap:wrap}
.zm-column{display:flex;flex-direction:column;gap:12px;flex:1 1 0;min-width:220px}
.zm-card{display:flex;flex-direction:column;gap:10px;background:#fff;color:#1d2433;border-radius:16px;padding:20px;box-shadow:0 4px 18px rgba(20,24,40,.12)}
.zm-row>.zm-card{flex:1 1 220px}
.zm-stage{position:relative;overflow:hidden;max-width:100%;flex:none;background-color:#87ceeb}
.zm-free{position:absolute}
.zm-h1,.zm-h2,.zm-h3{margin:0;line-height:1.15;font-weight:800;letter-spacing:-.01em}
.zm-h1{font-size:clamp(30px,5.5vw,48px)}.zm-h2{font-size:clamp(24px,4vw,34px)}.zm-h3{font-size:21px}
.zm-text{margin:0;line-height:1.6;font-size:17px;opacity:.92}
.zm-list{margin:0;padding-left:1.4em;line-height:1.8;font-size:17px;text-align:left}
.zm-link{color:var(--zm-primary);font-weight:700;text-underline-offset:3px}
.zm-divider{border:none;border-top:1.5px solid #d9d6cf;width:100%;margin:4px 0}
img.zm-image{display:block;max-width:100%;height:auto;user-select:none;-webkit-user-drag:none}
img.zm-image.zm-free{max-width:none}
.zm-placeholder{display:grid;place-items:center;min-height:90px;border:2px dashed #aab1bf;border-radius:12px;color:#6b7387;font-weight:700;padding:12px;background:#f4f5f8}
.zm-character{line-height:1;user-select:none;white-space:nowrap}
.zm-shape{background-color:#ff6b6b}
.zm-button{font:inherit;font-weight:800;font-size:16px;padding:12px 22px;border-radius:var(--zm-r);border:2px solid var(--zm-primary);background:var(--zm-primary);color:#fff;cursor:pointer;transition:transform .08s,filter .15s;max-width:100%}
.zm-button:hover{filter:brightness(1.07)}.zm-button:active{transform:translateY(1px)}
.zm-btn-soft{background:color-mix(in srgb,var(--zm-primary) 14%,#fff);color:var(--zm-primary);border-color:transparent}
.zm-btn-outline{background:transparent;color:var(--zm-primary)}
.zm-btn-plain{background:transparent;color:var(--zm-primary);border-color:transparent}
.zm-field{display:flex;flex-direction:column;gap:6px;font-weight:700;font-size:14px;text-align:left;width:100%;max-width:520px}
.zm-free.zm-field{width:auto}
.zm-field input:not([type=range]),.zm-field select,.zm-field textarea{font:inherit;font-weight:400;font-size:16px;padding:11px 12px;border:1.5px solid #ccd2dd;border-radius:min(var(--zm-r),14px);background:#fff;color:#1d2433;width:100%}
.zm-field textarea{resize:vertical}
.zm-field input:focus,.zm-field select:focus,.zm-field textarea:focus{outline:3px solid color-mix(in srgb,var(--zm-primary) 35%,transparent);border-color:var(--zm-primary)}
.zm-field input[type=range],.zm-checkbox input{accent-color:var(--zm-primary)}
.zm-checkbox{display:inline-flex;align-items:center;gap:10px;font-size:16px;cursor:pointer}
.zm-checkbox input{width:20px;height:20px}
.zm-navbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 20px;background:var(--zm-primary);color:#fff;width:100%}
.zm-sticky{position:sticky;top:0;z-index:20}
.zm-brand{font-weight:900;font-size:19px}
.zm-navlinks{display:flex;gap:4px;flex-wrap:wrap}
.zm-navlink{font:inherit;font-weight:700;color:inherit;background:transparent;border:none;padding:8px 12px;border-radius:min(var(--zm-r),10px);cursor:pointer}
.zm-navlink:hover{background:rgba(255,255,255,.14)}.zm-navlink.zm-active{background:rgba(255,255,255,.24)}
.zm-grid{display:grid;grid-template-columns:repeat(var(--zm-cols,3),minmax(0,1fr));gap:16px;width:100%;align-items:stretch}
.zm-badge{display:inline-block;align-self:flex-start;background:color-mix(in srgb,var(--zm-primary) 15%,#fff);color:var(--zm-primary);font-weight:800;font-size:13px;padding:4px 10px;border-radius:999px;letter-spacing:.02em}
.zm-inner>.zm-badge,.zm-section .zm-badge{align-self:auto}
.zm-faq{width:100%;border:1.5px solid #e3e1db;border-radius:min(var(--zm-r),14px);padding:0 16px;background:#fff;color:#1d2433;text-align:left}
.zm-faq summary{cursor:pointer;font-weight:800;padding:14px 0;list-style-position:outside}
.zm-faq p{margin:0 0 14px;line-height:1.6}
.zm-table{width:100%;overflow-x:auto}
.zm-table table{width:100%;border-collapse:collapse;text-align:left;font-size:15px;background:#fff;color:#1d2433;border-radius:12px;overflow:hidden}
.zm-table th{background:color-mix(in srgb,var(--zm-primary) 12%,#fff);font-weight:800}
.zm-table th,.zm-table td{padding:10px 12px;border-bottom:1px solid #ecebe6}
.zm-field progress{width:100%;height:12px;accent-color:var(--zm-primary)}
.zm-list li.zm-done{text-decoration:line-through;opacity:.6}
.zm-tappable{cursor:pointer}
@media (max-width:900px){.zm-grid{grid-template-columns:repeat(min(var(--zm-cols,3),2),minmax(0,1fr))}}
@media (max-width:600px){.zm-section{padding:28px 16px}.zm-row>.zm-column{min-width:100%}.zm-grid{grid-template-columns:1fr}}
`;
}

/** Put the rendered design into a page: in `<div id="zm-design"></div>` if present, else at the top of <body>. */
export function insertDesignHtml(html: string, designHtml: string): string {
  if (/<div\s+id=["']zm-design["']\s*>\s*<\/div>/i.test(html)) return html.replace(/<div\s+id=["']zm-design["']\s*>\s*<\/div>/i, designHtml);
  if (/<body[^>]*>/i.test(html)) return html.replace(/<body[^>]*>/i, (m) => `${m}\n${designHtml}`);
  return designHtml + html;
}
