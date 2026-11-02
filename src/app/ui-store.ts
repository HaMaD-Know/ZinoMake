import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  kind: 'info' | 'error';
}

interface UiState {
  toasts: Toast[];
  toast: (message: string, kind?: Toast['kind']) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useUi = create<UiState>((set, get) => ({
  toasts: [],
  toast: (message, kind = 'info') => {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-2), { id, message, kind }] });
    setTimeout(() => get().dismiss(id), kind === 'error' ? 6000 : 3200);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = (message: string, kind?: Toast['kind']) => useUi.getState().toast(message, kind);

// ---------- preferences (small, so localStorage is fine) ----------
export function readPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(`zinomake:${key}`);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: unknown): void {
  try {
    localStorage.setItem(`zinomake:${key}`, JSON.stringify(value));
  } catch {
    /* private mode etc. — preferences are optional */
  }
}

export type ThemePref = 'system' | 'light' | 'dark';
export function applyTheme(pref: ThemePref): void {
  if (pref === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', pref);
}
export function isDarkTheme(): boolean {
  const t = document.documentElement.getAttribute('data-theme');
  if (t) return t === 'dark';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}
