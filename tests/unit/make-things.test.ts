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
  turn("player", 15);
  moveTo("ball", mouseX(), roundNumber(mouseY()));
  remove("ball");
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
    for (const fn of ['setStage', 'addCharacter', 'addBox', 'addCircle', 'addPicture', 'addLabel', 'addTitle', 'addParagraph', 'addButton', 'addInput', 'addArrowButtons', 'remove', 'turn', 'mouseX', 'mouseY', 'setSize', 'setStyle', 'roundNumber', 'stop']) {
      expect(fns.has(fn), fn).toBe(true);
    }
  });

  it('finds names made by blocks for the helper', () => {
    expect(madeNamesFromCode(MAKE_THINGS)).toEqual(['player', 'floor', 'ball', 'cat', 'score', 'title', 'words', 'button', 'name']);
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
    api.remove('b');
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
});
