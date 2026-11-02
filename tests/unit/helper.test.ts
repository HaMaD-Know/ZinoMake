import { describe, expect, it } from 'vitest';
import { interpret, elementIdsFromHtml } from '../../src/programming/assistant/helper';
import { codeToBlocks } from '../../src/programming/parsers/codeToBlocks';

const ids = ['player', 'coin', 'button', 'score', 'stage'];

function ok(text: string) {
  const r = interpret(text, ids);
  if (!r.ok) throw new Error(r.message);
  const conv = codeToBlocks(r.code);
  expect(conv.ok && conv.unsupported).toEqual([]);
  return r.code;
}

describe('plain-English helper', () => {
  it('arrow keys movement', () => {
    const code = ok('Make a blue player move when I press the arrow keys');
    expect(code).toContain('onKey("ArrowLeft", async () => {\n  move("player", -10, 0);');
    expect(code).toContain('onKey("ArrowDown"');
    expect(code).toContain('setColor("player", "blue")');
  });
  it('click + say', () => {
    expect(ok('When I click the button, say "Hello!"')).toBe('onClick("button", async () => {\n  say("Hello!");\n});\n');
  });
  it('timer + sound and key + hide', () => {
    expect(ok('every 2 seconds play the coin sound')).toContain('every(2, async () => {\n  playSound("coin");');
    expect(ok('when I press space, hide the coin')).toContain('onKey("Space", async () => {\n  hide("coin");');
  });
  it('background colour', () => {
    expect(ok('change the background to pink')).toContain('setBackground("pink")');
  });
  it('explains when it does not understand', () => {
    const r = interpret('build me a spaceship MMO', ids);
    expect(r.ok).toBe(false);
    expect(interpret('when I click the dragon say "hi"', ids).ok).toBe(false);
  });
  it('reads ids from html', () => {
    expect(elementIdsFromHtml('<div id="a"></div><b id=\'b-2\'>')).toEqual(['a', 'b-2']);
  });
});
