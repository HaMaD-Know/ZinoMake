import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  separatorBefore?: boolean;
}

/** A button that opens a small menu. Works with click/tap and keyboard (arrows, Escape). */
export function MenuButton({ label, items, className, children, align = 'right' }: { label: string; items: MenuItem[]; className?: string; children: ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const first = wrap.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    first?.focus();
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);
  const onKey = (e: React.KeyboardEvent) => {
    const items = [...(wrap.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      setOpen(false);
      btn.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    }
  };
  return (
    <div ref={wrap} style={{ position: 'relative', display: 'inline-block' }} onKeyDown={onKey}>
      <button ref={btn} className={className ?? 'btn btn-ghost btn-icon'} aria-haspopup="menu" aria-expanded={open} aria-label={label} title={label} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
        {children}
      </button>
      {open && (
        <div className="menu" role="menu" style={{ [align]: 0, top: '100%', marginTop: 4 }}>
          {items.map((it) => (
            <div key={it.label} style={{ display: 'contents' }}>
              {it.separatorBefore && <hr />}
              <button role="menuitem" className={it.danger ? 'danger' : ''} onClick={(e) => { e.stopPropagation(); setOpen(false); it.onSelect(); }}>
                {it.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
