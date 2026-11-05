import { useState } from 'react';

const STEPS = [
  { title: '👋 Welcome to the editor', text: 'Your project already works! Press the green Play button to see it. Press Stop to end it.' },
  { title: '🎨 Design it', text: 'In Design, add buttons, pictures, text boxes and screens. Click anything to change its words, colours and size, and choose what it does when tapped.' },
  { title: '🧱 Make it smart', text: 'In Blocks, snap coloured blocks together for games and logic: “when … is clicked”, movement, scores and more.' },
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
