/**
 * Builds the HTML document that runs inside the sandboxed preview iframe.
 *
 * Security model (see docs/ARCHITECTURE.md):
 *  - The iframe uses sandbox="allow-scripts" only (no allow-same-origin), so user code runs in an
 *    opaque origin and cannot read ZinoMake's IndexedDB, localStorage or the parent DOM.
 *  - A Content-Security-Policy meta tag blocks network requests, so projects can't fetch or send data.
 *  - Loops are instrumented with a guard so a runaway loop is stopped instead of freezing the tab.
 */
import * as acorn from 'acorn';
import runtimeSource from './zinoRuntime.js?raw';
import type { Project } from '../model/project';
import { parseJs } from '../programming/parsers/codeToBlocks';

export const PREVIEW_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:";

/** Insert `__zmGuard();` at the start of every loop body. Positions come from the real parser. */
export function instrumentLoops(code: string): string {
  let program: acorn.Program;
  try {
    program = parseJs(code);
  } catch {
    return code; // syntax errors are reported separately; run as-is so the browser reports them too
  }
  const inserts: { pos: number; text: string }[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const n = node as { type?: string; body?: { type: string; start: number; end: number } } & Record<string, unknown>;
    if (n.type && /^(For|ForIn|ForOf|While|DoWhile)Statement$/.test(n.type) && n.body) {
      if (n.body.type === 'BlockStatement') inserts.push({ pos: n.body.start + 1, text: '__zmGuard();' });
      else {
        inserts.push({ pos: n.body.start, text: '{__zmGuard();' });
        inserts.push({ pos: n.body.end, text: '}' });
      }
    }
    for (const key of Object.keys(n)) {
      if (key === 'loc') continue;
      const v = n[key];
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === 'object') visit(v);
    }
  };
  visit(program);
  inserts.sort((a, b) => b.pos - a.pos);
  let out = code;
  for (const ins of inserts) out = out.slice(0, ins.pos) + ins.text + out.slice(ins.pos);
  return out;
}

function escapeScript(code: string): string {
  return code.replace(/<\/script/gi, '<\\/script');
}

function escapeStyle(css: string): string {
  return css.replace(/<\/style/gi, '<\\/style');
}

export interface PreviewInput {
  project: Pick<Project, 'files' | 'blocksFile' | 'type'>;
  /** asset name -> data: URL */
  assetUrls: Record<string, string>;
}

export function replaceAssetRefs(text: string, assetUrls: Record<string, string>): string {
  let out = text;
  for (const [name, url] of Object.entries(assetUrls)) {
    out = out.split(`assets/${name}`).join(url);
  }
  return out;
}

/** The user's main script is wrapped like this; keep in sync with __ZM_LINE_OFFSET. */
const WRAP_START = '(async () => {\ntry {\n';
const WRAP_LINES = 2;

export function buildPreviewDocument({ project, assetUrls }: PreviewInput): string {
  const files = project.files.filter((f) => f.kind === 'file');
  const htmlFile = files.find((f) => f.path === 'index.html') ?? files.find((f) => f.path.endsWith('.html'));
  const css = files.filter((f) => f.path.endsWith('.css')).map((f) => `/* ${f.path} */\n${f.content}`).join('\n');
  const mainPath = project.blocksFile;
  const otherJs = files.filter((f) => f.path.endsWith('.js') && f.path !== mainPath);
  const main = files.find((f) => f.path === mainPath);

  let html = htmlFile?.content ?? '<!doctype html><html><head></head><body></body></html>';
  html = replaceAssetRefs(html, assetUrls);
  // Local <script src> / <link href> can't load inside the sandbox (no network); files are inlined below.
  html = html.replace(/<script\b[^>]*\bsrc=["'](?!data:)[^"']*["'][^>]*>\s*<\/script>/gi, '');

  const head = [
    `<meta charset="utf-8">`,
    `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<style>${escapeStyle(replaceAssetRefs(css, assetUrls))}</style>`,
    `<script>window.__ZM_ASSETS=${escapeScript(JSON.stringify(assetUrls))};window.__ZM_LINE_OFFSET=${WRAP_LINES};</script>`,
    `<script>${escapeScript(runtimeSource)}\n//# sourceURL=zinomake-runtime.js</script>`,
  ].join('\n');

  const scripts = [
    ...otherJs.map((f) => `<script>${escapeScript(instrumentLoops(f.content))}\n//# sourceURL=${f.path.replace(/[^\w./-]/g, '')}</script>`),
    `<script>${WRAP_START}${escapeScript(instrumentLoops(main?.content ?? ''))}\n} catch (e) { __zm.reportError(e); }\n__zm.start();\n})();\n//# sourceURL=main.js</script>`,
  ].join('\n');

  if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${head}`);
  else if (/<html[^>]*>/i.test(html)) html = html.replace(/<html[^>]*>/i, (m) => `${m}<head>${head}</head>`);
  else html = `<!doctype html><html><head>${head}</head><body>${html}</body></html>`;

  if (/<\/body>/i.test(html)) html = html.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${scripts}\n</body>`);
  else html += scripts;
  return html;
}

/** Messages the preview may send. Anything else is ignored. */
export type PreviewMessage =
  | { source: 'zinomake-preview'; type: 'ready' | 'started' | 'stopped' }
  | { source: 'zinomake-preview'; type: 'log'; level: 'log' | 'info' | 'warn' | 'error'; message: string }
  | { source: 'zinomake-preview'; type: 'say'; message: string }
  | { source: 'zinomake-preview'; type: 'error'; message: string; technical?: string; line: number | null };

export function validatePreviewMessage(data: unknown): PreviewMessage | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (d.source !== 'zinomake-preview' || typeof d.type !== 'string') return null;
  const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : null);
  switch (d.type) {
    case 'ready':
    case 'started':
    case 'stopped':
      return { source: 'zinomake-preview', type: d.type };
    case 'log': {
      const message = str(d.message);
      const level = d.level === 'warn' || d.level === 'error' || d.level === 'info' ? d.level : 'log';
      return message === null ? null : { source: 'zinomake-preview', type: 'log', level, message };
    }
    case 'say': {
      const message = str(d.message, 500);
      return message === null ? null : { source: 'zinomake-preview', type: 'say', message };
    }
    case 'error': {
      const message = str(d.message, 1000);
      if (message === null) return null;
      const line = typeof d.line === 'number' && Number.isFinite(d.line) ? Math.floor(d.line) : null;
      return { source: 'zinomake-preview', type: 'error', message, technical: str(d.technical, 500) ?? undefined, line };
    }
    default:
      return null;
  }
}
