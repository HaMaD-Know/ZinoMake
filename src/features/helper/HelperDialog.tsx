import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { HELPER_EXAMPLES, interpret, type HelperResult } from '../../programming/assistant/helper';

/** "Describe it" helper: offline rules that turn a sentence into blocks. */
export function HelperDialog({ elementIds, onAdd, onClose }: { elementIds: string[]; onAdd: (code: string) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<HelperResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = (value = text) => {
    const r = interpret(value, elementIds);
    if (r.ok) {
      setResult(r);
      setError(null);
    } else {
      setResult(null);
      setError(r.message);
    }
  };
  return (
    <Dialog title="✨ Describe what you want" onClose={onClose} wide>
      <p className="hint">Type a short sentence. ZinoMake turns simple requests into blocks. (This helper works offline using simple rules — it isn’t an AI.)</p>
      <form onSubmit={(e) => { e.preventDefault(); run(); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label className="sr-only" htmlFor="helper-input">What should happen?</label>
        <input id="helper-input" className="input" style={{ flex: 1, minWidth: 220 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Make the player move when I press the arrow keys" autoFocus />
        <button className="btn btn-primary" type="submit">Make it</button>
      </form>
      <div className="chips" style={{ marginTop: 10 }}>
        {HELPER_EXAMPLES.map((ex) => (
          <button key={ex} className="chip" onClick={() => { setText(ex); run(ex); }}>{ex}</button>
        ))}
      </div>
      {error && <p className="error-text" role="alert">{error}</p>}
      {result && (
        <div className="banner info" style={{ display: 'block', borderRadius: 12 }} role="status">
          <p><strong>I’ll add blocks that:</strong> {result.summary.join(' ')}</p>
          <pre style={{ fontFamily: 'var(--mono)', fontSize: 13, whiteSpace: 'pre-wrap', margin: 0 }}>{result.code}</pre>
        </div>
      )}
      <p className="hint">Things on this page you can use: {elementIds.length ? elementIds.join(', ') : 'none yet (add an id in index.html)'}</p>
      <div className="dialog-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!result} onClick={() => result && onAdd(result.code)}>Add these blocks</button>
      </div>
    </Dialog>
  );
}
