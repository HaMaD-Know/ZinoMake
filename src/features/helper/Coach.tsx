import { useState } from 'react';

const STEPS = [
  { title: '👋 Welcome to the editor', text: 'Your project already works! These coloured blocks are its instructions.' },
  { title: '▶ Press Play', text: 'Press the green Play button to see your result. Press Stop to end it.' },
  { title: '🧱 Change something', text: 'Pick a category on the left and drag a block into a “when…” block. Or tap “Add block”.' },
  { title: '</> Peek at the code', text: 'Open Code to see the real JavaScript your blocks make. You never have to use it.' },
];

export function Coach({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const s = STEPS[i];
  return (
    <div className="coach" role="dialog" aria-label="Quick tour" aria-live="polite">
      <h3>{s.title}</h3>
      <p>{s.text}</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-ghost btn-sm" onClick={onDone}>Skip tour</button>
        <span className="hint">{i + 1} / {STEPS.length}</span>
        <button className="btn btn-primary btn-sm" onClick={() => (i + 1 < STEPS.length ? setI(i + 1) : onDone())}>{i + 1 < STEPS.length ? 'Next' : 'Done'}</button>
      </div>
    </div>
  );
}
