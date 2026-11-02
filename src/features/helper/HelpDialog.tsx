import { Dialog } from '../../components/Dialog';
import { CATEGORIES } from '../../programming/blocks/catalog';
import type { ProjectType } from '../../model/project';

const EXAMPLES: Record<string, string> = {
  start: '“when Play is pressed” → “show message Hello!”',
  events: '“when button is clicked” → “play sound coin”',
  motion: '“move player by x 10 y 0” moves right',
  looks: '“set colour of player to gold”',
  sound: '“play sound win” when you score',
  values: '“random number from 1 to 10”',
  decisions: '“if score = 10 then show message You win!”',
  repeat: '“repeat 10 times” → “move” + “wait 0.1”',
  variables: '“remember score starting at 0”, then “change score by 1”',
  functions: '“make a block called celebrate”, then “run my block celebrate”',
  time: '“wait 1 seconds” between steps',
};

export function HelpDialog({ type, nextIdeas, onClose, onTour }: { type: ProjectType; nextIdeas: string[]; onClose: () => void; onTour: () => void }) {
  return (
    <Dialog title="Help" onClose={onClose} wide actions={<><button className="btn" onClick={onTour}>Show the quick tour</button><button className="btn btn-primary" onClick={onClose}>Got it</button></>}>
      <h3>What can I do next?</h3>
      <ul>{nextIdeas.map((i) => <li key={i}>{i}</li>)}</ul>
      <h3>How it works</h3>
      <ol>
        <li>Drag blocks from the list on the left into the big area. Blocks snap together like puzzle pieces.</li>
        <li>Blocks inside a “when…” block run when that thing happens.</li>
        <li>Press <strong>Play</strong> to see your result. Press <strong>Stop</strong> to end it.</li>
        <li>Remove a block by dragging it back to the list or to the bin, or select it and press Delete.</li>
        <li>Open <strong>Code</strong> to see the JavaScript your blocks make. Simple changes there update the blocks too.</li>
      </ol>
      <h3>Block types</h3>
      {CATEGORIES.filter((c) => !c.types || c.types.includes(type)).map((c) => (
        <div key={c.id} className="help-cat" style={{ borderColor: c.colour }}>
          <strong>{c.name}</strong> — {c.help}<br /><span className="hint">Example: {EXAMPLES[c.id]}</span>
        </div>
      ))}
      <h3>Names of things</h3>
      <p>Blocks find things on the page by their <em>id</em> in index.html, for example <code>&lt;div id="player"&gt;</code>. Use the same name in your blocks.</p>
    </Dialog>
  );
}
