// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { codeToBlocks } from '../../src/programming/parsers/codeToBlocks';
import { blocksToCode } from '../../src/programming/generators/blocksToCode';
import { CALL_BLOCKS } from '../../src/programming/blocks/catalog';
import { madeNamesFromCode } from '../../src/programming/assistant/helper';

const MAKE_THINGS = `onStart(async () => {
  setStage(400, 300, "skyblue");
  addCharacter("player", "🐱", 160, 120, 48);
  addBox("floor", 0, 260, 400, 40, "green");
  addCircle("ball", 100, 100, 40, "gold");
  addPicture("cat", "cat.png", 40, 40, 80);
  addLabel("score", "Score: 0", 10, 10, 20);
  addTitle("title", "Hello!");
  addParagraph("words", "Write something here.");
  addButton("button", "Click me");
  addInput("name", "Type here");
  addArrowButtons();
  setSize("ball", 60, 60);
  setStyle("ball", "fill", "purple");
  setStyle("title", "seeThrough", 50);
  turnBy("player", 15);
  moveTo("ball", getMouseX(), roundNumber(getMouseY()));
  removeThing("ball");
  stop();
});
`;

describe('“Make things” blocks', () => {
  it('turn into normal blocks (no custom code) and regenerate exactly', () => {
    const r = codeToBlocks(MAKE_THINGS);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.unsupported).toEqual([]);
    expect(blocksToCode(r.workspace)).toBe(MAKE_THINGS);
  });

  it('every new block exists in the catalogue', () => {
    const fns = new Set(CALL_BLOCKS.map((b) => b.fn));
    for (const fn of ['setStage', 'addCharacter', 'addBox', 'addCircle', 'addPicture', 'addLabel', 'addTitle', 'addParagraph', 'addButton', 'addInput', 'addArrowButtons', 'removeThing', 'turnBy', 'getMouseX', 'getMouseY', 'setSize', 'setStyle', 'roundNumber', 'stop']) {
      expect(fns.has(fn), fn).toBe(true);
    }
  });

  it('finds names made by blocks for the helper', () => {
    expect(madeNamesFromCode(MAKE_THINGS)).toEqual(['player', 'floor', 'ball', 'cat', 'score', 'title', 'words', 'button', 'name', 'stage']);
  });
});

describe('runtime: making things', () => {
  const runtime = readFileSync(resolve(__dirname, '../../src/runtime/zinoRuntime.js'), 'utf8');
  type Api = Record<string, (...a: unknown[]) => unknown>;
  let api: Api;
  let zm: { start: () => void };

  beforeEach(() => {
    document.body.innerHTML = '<main id="page"></main>';
    (window as unknown as { __ZM_ASSETS: Record<string, string> }).__ZM_ASSETS = { 'cat.png': 'data:image/png;base64,AA==' };
    // Run the runtime the same way the preview does: as a classic script in the page.
    new Function(runtime).call(window);
    zm = (window as unknown as { __zm: { api: Api; start: () => void } }).__zm;
    api = (zm as unknown as { api: Api }).api;
  });

  it('creates a stage and things on it, with no HTML needed', () => {
    api.setStage(400, 300, 'pink');
    api.addCharacter('player', '🐱', 160, 120, 48);
    api.addBox('wall', 10, 20, 30, 40, 'red');
    api.addPicture('cat', 'cat.png', 5, 5, 50);
    const stage = document.getElementById('stage')!;
    expect(stage.style.width).toBe('400px');
    expect(stage.style.background).toContain('pink');
    const player = document.getElementById('player')!;
    expect(player.parentElement).toBe(stage);
    expect(player.textContent).toBe('🐱');
    expect(player.style.left).toBe('160px');
    expect(document.getElementById('wall')!.style.backgroundColor).toBe('red');
    expect((document.getElementById('cat') as HTMLImageElement).src).toContain('data:image/png');
  });

  it('makes a stage automatically when a character is added first', () => {
    api.addCircle('ball', 1, 2, 30, 'gold');
    expect(document.getElementById('ball')!.parentElement!.id).toBe('stage');
  });

  it('adding the same name again replaces the old thing', () => {
    api.addButton('go', 'One');
    api.addButton('go', 'Two');
    expect(document.querySelectorAll('#go').length).toBe(1);
    expect(document.getElementById('go')!.textContent).toBe('Two');
  });

  it('“when clicked” works for things made after Play starts', async () => {
    let clicks = 0;
    api.onClick('go', () => { clicks += 1; });
    zm.start();
    api.addButton('go', 'Go');
    document.getElementById('go')!.click();
    await Promise.resolve();
    expect(clicks).toBe(1);
  });

  it('page items go in the page, styles and size apply, remove takes things away', () => {
    api.addTitle('title', 'Hi');
    api.addInput('name', 'Your name');
    expect(document.getElementById('title')!.parentElement!.id).toBe('page');
    expect((document.getElementById('name') as HTMLInputElement).placeholder).toBe('Your name');
    api.setStyle('title', 'textSize', 40);
    api.setStyle('title', 'seeThrough', 25);
    api.setStyle('title', 'fill', 'gold');
    const t = document.getElementById('title')!;
    expect(t.style.fontSize).toBe('40px');
    expect(t.style.opacity).toBe('0.75');
    expect(t.style.backgroundColor).toBe('gold');
    api.addBox('b', 0, 0, 10, 10, 'red');
    api.setSize('b', 70, 80);
    expect(document.getElementById('b')!.style.width).toBe('70px');
    api.removeThing('b');
    expect(document.getElementById('b')).toBeNull();
    expect(api.roundNumber(2.6)).toBe(3);
  });

  it('arrow buttons work like keys', () => {
    api.addArrowButtons();
    const btns = document.querySelectorAll('#arrow-buttons [data-key]');
    expect(btns.length).toBe(4);
    btns[0].dispatchEvent(new Event('pointerdown'));
    expect(api.isKeyDown('ArrowLeft')).toBe(true);
    btns[0].dispatchEvent(new Event('pointerup'));
    expect(api.isKeyDown('ArrowLeft')).toBe(false);
  });

  it('copies: made with a group name, removed together, clicks on a copy count for the original', async () => {
    let clicks = 0;
    api.onClick('wall', () => { clicks += 1; });
    zm.start();
    api.addBox('wall', 0, 0, 50, 200, 'green');
    api.makeCopy('wall', 300, 10);
    api.makeCopy('wall', 300, 250);
    const copies = document.querySelectorAll('[data-group="wall"]');
    expect(copies.length).toBe(2);
    expect((copies[0] as HTMLElement).style.left).toBe('300px');
    expect((copies[0] as HTMLElement).style.backgroundColor).toBe('green');
    (copies[1] as HTMLElement).click();
    await Promise.resolve();
    expect(clicks).toBe(1);
    api.removeCopies('wall');
    expect(document.querySelectorAll('[data-group="wall"]').length).toBe(0);
    expect(document.getElementById('wall')).not.toBeNull();
  });

  it('is pressed: true only while held down on that thing', () => {
    api.addPicture('up', 'cat.png', 0, 0, 40);
    const up = document.getElementById('up')!;
    up.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(api.isPressed('up')).toBe(true);
    expect(api.isPressed('down')).toBe(false);
    document.dispatchEvent(new Event('pointerup'));
    expect(api.isPressed('up')).toBe(false);
  });

  it('messages run every matching “when I get message”', async () => {
    const got: string[] = [];
    api.onMessage('game over', () => { got.push('a'); });
    api.onMessage('game over', () => { got.push('b'); });
    api.onMessage('other', () => { got.push('x'); });
    api.sendMessage('game over');
    await Promise.resolve();
    expect(got).toEqual(['a', 'b']);
  });

  it('speed and gravity are remembered per thing', () => {
    api.addCharacter('bird', '🐤', 10, 10, 40);
    api.setSpeed('bird', 0, -6.5);
    api.setGravity('bird', 0.35);
    expect(api.getSpeedY('bird')).toBe(-6.5);
  });
});
