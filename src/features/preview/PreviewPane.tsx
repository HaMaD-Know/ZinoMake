import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { buildPreviewDocument, validatePreviewMessage } from '../../runtime/buildPreview';
import type { Project } from '../../model/project';
import { assetDataUrls } from '../../app/projectService';
import { Icon } from '../../components/Icon';

export type Device = 'desktop' | 'tablet' | 'phone';

interface LogRow {
  id: number;
  kind: 'say' | 'log' | 'warn' | 'error';
  text: string;
  line?: number | null;
}

export interface PreviewHandle {
  play(): void;
  stop(): void;
}

interface Props {
  getProject: () => Project | null;
  onRunningChange?: (running: boolean) => void;
  onShowLine?: (line: number) => void;
}

let rowId = 1;

export const PreviewPane = forwardRef<PreviewHandle, Props>(function PreviewPane({ getProject, onRunningChange, onShowLine }, ref) {
  const [doc, setDoc] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);
  const [device, setDevice] = useState<Device>('desktop');
  const [rows, setRows] = useState<LogRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'starting' | 'running' | 'stopped'>('idle');
  const frame = useRef<HTMLIFrameElement>(null);
  const onRunningRef = useRef(onRunningChange);
  onRunningRef.current = onRunningChange;

  const add = (r: Omit<LogRow, 'id'>) => setRows((rs) => [...rs.slice(-80), { ...r, id: rowId++ }]);

  const play = async () => {
    const p = getProject();
    if (!p) return;
    setRows([]);
    setStatus('starting');
    const { urls, missing } = await assetDataUrls(p).catch(() => ({ urls: {}, missing: [] as string[] }));
    for (const m of missing) add({ kind: 'error', text: `The file “${m}” could not be loaded. Choose another file or restore the asset.` });
    setDoc(buildPreviewDocument({ project: p, assetUrls: urls }));
    setRunId((n) => n + 1);
    onRunningRef.current?.(true);
  };

  const stop = () => {
    try {
      frame.current?.contentWindow?.postMessage({ source: 'zinomake-host', type: 'stop' }, '*');
    } catch {
      /* ignore */
    }
    // Removing the iframe ends everything inside it, including stuck code.
    setDoc(null);
    setStatus('stopped');
    onRunningRef.current?.(false);
  };

  useImperativeHandle(ref, () => ({ play: () => void play(), stop }));

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // Only accept messages from our own preview frame, and only known shapes.
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const msg = validatePreviewMessage(e.data);
      if (!msg) return;
      switch (msg.type) {
        case 'started':
          setStatus('running');
          break;
        case 'stopped':
          setStatus('stopped');
          break;
        case 'say':
          add({ kind: 'say', text: msg.message });
          break;
        case 'log':
          add({ kind: msg.level === 'warn' ? 'warn' : msg.level === 'error' ? 'error' : 'log', text: msg.message });
          break;
        case 'error':
          add({ kind: 'error', text: msg.message, line: msg.line });
          if (msg.technical) console.warn('[ZinoMake preview]', msg.technical);
          break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const hasError = rows.some((r) => r.kind === 'error');

  return (
    <div className="preview-col" aria-label="Preview">
      <div className="preview-bar">
        {doc ? (
          <>
            <button className="btn btn-sm" onClick={stop} data-testid="preview-stop"><Icon name="stop" size={16} /> Stop</button>
            <button className="btn btn-sm" onClick={() => void play()} title="Start again from the beginning"><Icon name="restart" size={16} /> Restart</button>
          </>
        ) : (
          <button className="btn btn-sm btn-play" onClick={() => void play()}><Icon name="play" size={16} /> Play</button>
        )}
        <button className="btn btn-sm btn-ghost" onClick={() => void play()} title="Refresh the preview with your latest changes" aria-label="Refresh preview"><Icon name="refresh" size={16} /></button>
        <span className="grow" style={{ flex: 1 }} />
        <label className="sr-only" htmlFor="device">Preview size</label>
        <select id="device" className="input" style={{ width: 'auto', minHeight: 36 }} value={device} onChange={(e) => setDevice(e.target.value as Device)}>
          <option value="desktop">Full size</option>
          <option value="tablet">Tablet</option>
          <option value="phone">Phone</option>
        </select>
      </div>
      <div className="preview-stage">
        <div className={`device ${device}`}>
          {doc ? (
            <iframe
              key={runId}
              ref={frame}
              title="Your project"
              data-testid="preview-frame"
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
              srcDoc={doc}
              onLoad={() => frame.current?.focus()}
            />
          ) : (
            <div className="preview-empty">
              <div>
                <div style={{ fontSize: 40 }} aria-hidden="true">{status === 'stopped' ? '⏹' : '▶'}</div>
                <p><strong>{status === 'stopped' ? 'Stopped.' : 'Press Play to see your result.'}</strong></p>
                <p className="hint">Your project runs here, safely separated from ZinoMake.</p>
              </div>
            </div>
          )}
        </div>
      </div>
      {(rows.length > 0 || hasError) && (
        <div className="console" aria-label="Messages from your project" aria-live="polite" data-testid="preview-console">
          {hasError && <div className="console-row error"><span className="tag">⚠</span><span>Your project ran into a problem. See the explanation below.</span></div>}
          {rows.map((r) => (
            <div key={r.id} className={`console-row ${r.kind === 'error' ? 'error' : r.kind === 'warn' ? 'warn' : ''}`}>
              <span className="tag" aria-hidden="true">{r.kind === 'say' ? '💬' : r.kind === 'error' ? '⚠' : r.kind === 'warn' ? '!' : '›'}</span>
              <span style={{ flex: 1 }}>{r.text}</span>
              {r.line && onShowLine && <button className="btn btn-sm btn-ghost" onClick={() => onShowLine(r.line!)}>Line {r.line}</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
