import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

interface DialogProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  actions?: ReactNode;
}

/** Accessible modal dialog: labelled, Escape closes, focus moves in and returns, Tab stays inside. */
export function Dialog({ title, children, onClose, wide, actions }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('[autofocus], input, select, textarea, button:not([data-close])') ?? el;
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && el) {
        const items = [...el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.hasAttribute('disabled'));
        if (!items.length) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`dialog${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <h2 id={titleId}>{title}</h2>
        {children}
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>
  );
}

// ---------- promise-based helpers ----------

function mount<T>(render: (done: (v: T) => void) => ReactNode): Promise<T> {
  return new Promise<T>((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (v: T) => {
      root.unmount();
      host.remove();
      resolve(v);
    };
    root.render(render(done));
  });
}

export function confirmDialog(opts: { title: string; message: ReactNode; confirm?: string; danger?: boolean; cancel?: string }): Promise<boolean> {
  return mount<boolean>((done) => (
    <Dialog
      title={opts.title}
      onClose={() => done(false)}
      actions={
        <>
          <button className="btn" onClick={() => done(false)}>{opts.cancel ?? 'Cancel'}</button>
          <button className={`btn ${opts.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => done(true)}>{opts.confirm ?? 'OK'}</button>
        </>
      }
    >
      <div>{opts.message}</div>
    </Dialog>
  ));
}

export function choiceDialog<T extends string>(opts: { title: string; message: ReactNode; choices: { value: T; label: string; primary?: boolean; danger?: boolean }[] }): Promise<T | null> {
  return mount<T | null>((done) => (
    <Dialog
      title={opts.title}
      onClose={() => done(null)}
      actions={
        <>
          <button className="btn" onClick={() => done(null)}>Cancel</button>
          {opts.choices.map((c) => (
            <button key={c.value} className={`btn ${c.danger ? 'btn-danger' : c.primary ? 'btn-primary' : ''}`} onClick={() => done(c.value)}>{c.label}</button>
          ))}
        </>
      }
    >
      <div>{opts.message}</div>
    </Dialog>
  ));
}

function PromptBody({ label, initial, validate, done, confirm }: { label: string; initial: string; validate?: (v: string) => string | null; done: (v: string | null) => void; confirm: string }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    const err = validate?.(value) ?? (value.trim() ? null : 'Please type a name.');
    if (err) setError(err);
    else done(value.trim());
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <label className="field">
        <span>{label}</span>
        <input className="input" value={value} autoFocus onFocus={(e) => e.currentTarget.select()} onChange={(e) => { setValue(e.target.value); setError(null); }} aria-invalid={!!error} />
      </label>
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={() => done(null)}>Cancel</button>
        <button type="submit" className="btn btn-primary">{confirm}</button>
      </div>
    </form>
  );
}

export function promptDialog(opts: { title: string; label: string; initial?: string; confirm?: string; validate?: (v: string) => string | null }): Promise<string | null> {
  return mount<string | null>((done) => (
    <Dialog title={opts.title} onClose={() => done(null)}>
      <PromptBody label={opts.label} initial={opts.initial ?? ''} validate={opts.validate} done={done} confirm={opts.confirm ?? 'Save'} />
    </Dialog>
  ));
}
