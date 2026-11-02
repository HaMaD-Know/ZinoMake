/** Text code editor (CodeMirror 6). Lazy-loaded with the editor page. */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { Compartment, EditorState } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { indentWithTab, undo, redo } from '@codemirror/commands';
import { javascript, javascriptLanguage } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { setDiagnostics, type Diagnostic } from '@codemirror/lint';
import { completeFromList } from '@codemirror/autocomplete';
import { CALL_BLOCKS } from '../../programming/blocks/catalog';

export interface CodeDiagnostic {
  line: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface CodeEditorHandle {
  undo(): void;
  redo(): void;
  focus(): void;
}

interface Props {
  path: string;
  value: string;
  onChange: (text: string) => void;
  diagnostics: CodeDiagnostic[];
  dark: boolean;
}

const zinoCompletions = javascriptLanguage.data.of({
  autocomplete: completeFromList([
    ...CALL_BLOCKS.map((b) => ({
      label: b.fn,
      type: 'function',
      detail: b.args.length ? `(${b.args.map((a) => a.name.toLowerCase()).join(', ')})` : '()',
      info: b.tooltip,
      apply: b.shape === 'event' || b.shape === 'statement-body' ? `${b.fn}(${b.args.map((a) => (a.kind === 'number' ? '1' : '"' + ('default' in a ? String(a.default) : a.kind === 'dropdown' ? a.options[0][1] : '') + '"')).join(', ')}${b.args.length ? ', ' : ''}async () => {\n  \n})` : undefined,
    })),
    { label: 'let', type: 'keyword', apply: 'let name = 0;' },
    { label: 'if', type: 'keyword', apply: 'if (true) {\n  \n}' },
    { label: 'repeat', type: 'keyword', detail: 'for loop', apply: 'for (let i = 0; i < 10; i++) {\n  \n}' },
  ]),
});

function language(path: string) {
  if (path.endsWith('.html')) return html();
  if (path.endsWith('.css')) return css();
  if (path.endsWith('.js')) return [javascript(), zinoCompletions];
  return [];
}

const lightTheme = EditorView.theme({
  '&': { backgroundColor: 'var(--surface)', color: 'var(--text)', height: '100%' },
  '.cm-gutters': { backgroundColor: 'var(--surface-2)', color: 'var(--text-3)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--accent-soft) 55%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--accent-soft)' },
  '.cm-content': { caretColor: 'var(--text)', padding: '8px 0' },
});
const darkTheme = EditorView.theme({
  '&': { backgroundColor: 'var(--surface)', color: 'var(--text)', height: '100%' },
  '.cm-gutters': { backgroundColor: 'var(--surface-2)', color: 'var(--text-3)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.04)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(255,255,255,0.06)' },
  '.cm-content': { caretColor: 'var(--text)', padding: '8px 0' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: '#3b4466 !important' },
}, { dark: true });

export const CodeEditor = forwardRef<CodeEditorHandle, Props>(function CodeEditor({ path, value, onChange, diagnostics, dark }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const themeComp = useRef(new Compartment());
  const external = useRef(false);

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          language(path),
          themeComp.current.of(dark ? darkTheme : lightTheme),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': `Code editor for ${path}` }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged && !external.current) onChangeRef.current(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // Value changed from outside (blocks, helper): replace the doc without echoing back.
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const cur = v.state.doc.toString();
    if (cur !== value) {
      external.current = true;
      v.dispatch({ changes: { from: 0, to: cur.length, insert: value } });
      external.current = false;
    }
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: themeComp.current.reconfigure(dark ? darkTheme : lightTheme) });
  }, [dark]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const doc = v.state.doc;
    const diags: Diagnostic[] = diagnostics
      .filter((d) => d.line >= 1 && d.line <= doc.lines)
      .map((d) => {
        const line = doc.line(d.line);
        return { from: line.from, to: Math.max(line.from, line.to), severity: d.severity, message: d.message };
      });
    v.dispatch(setDiagnostics(v.state, diags));
  }, [diagnostics, value]);

  useImperativeHandle(ref, () => ({
    undo: () => view.current && undo(view.current),
    redo: () => view.current && redo(view.current),
    focus: () => view.current?.focus(),
  }));

  return <div ref={host} className="code-host" data-testid="code-editor" />;
});

export default CodeEditor;
