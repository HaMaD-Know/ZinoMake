import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { HomePage } from '../pages/HomePage';
import { CreatePage } from '../pages/CreatePage';
import { Toasts } from '../components/Toasts';

// The editor (Blockly, CodeMirror, parser) is loaded only when a project is opened.
const EditorPage = lazy(() => import('../pages/EditorPage'));

export type Route =
  | { name: 'home' }
  | { name: 'create'; type?: string; template?: string }
  | { name: 'editor'; id: string };

export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#/, '') || '/';
  const [path, query = ''] = h.split('?');
  const params = new URLSearchParams(query);
  if (path === '/new') return { name: 'create', type: params.get('type') ?? undefined, template: params.get('template') ?? undefined };
  const m = /^\/p\/([\w-]+)$/.exec(path);
  if (m) return { name: 'editor', id: m[1] };
  return { name: 'home' };
}

export function navigate(hash: string): void {
  window.location.hash = hash;
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('[ZinoMake] UI error:', error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="container" style={{ paddingTop: 48 }}>
        <div className="empty" role="alert">
          <div className="big-emoji">😕</div>
          <h2>Something went wrong on this screen</h2>
          <p>Your saved projects are safe. Try going back to My Projects.</p>
          <button className="btn btn-primary" onClick={() => { this.setState({ error: null }); navigate('#/'); }}>Back to My Projects</button>
          <details style={{ marginTop: 12 }}><summary>Technical details</summary><code>{this.state.error.message}</code></details>
        </div>
      </div>
    );
  }
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return (
    <ErrorBoundary>
      {route.name === 'home' && <HomePage />}
      {route.name === 'create' && <CreatePage key={`${route.type}-${route.template}`} initialType={route.type} initialTemplate={route.template} />}
      {route.name === 'editor' && (
        <Suspense fallback={<div className="preview-empty" role="status" style={{ height: '100vh' }}>Opening your project…</div>}>
          <EditorPage key={route.id} projectId={route.id} />
        </Suspense>
      )}
      <Toasts />
    </ErrorBoundary>
  );
}
