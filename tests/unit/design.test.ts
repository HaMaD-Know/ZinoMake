// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DESIGN_FILE, designNames, duplicateNode, emptyDesign, insertNode, locate, makeNode, parseDesign, readDesign,
  removeNode, reparentNode, serializeDesign, starterDesign, uniqueName, withDesign, type Design,
} from '../../src/design/model';
import { renderDesign } from '../../src/design/render';
import { buildPreviewDocument } from '../../src/runtime/buildPreview';
import { createProjectFromTemplate } from '../../src/model/createProject';
import { blankTemplate } from '../../src/templates/templates';

function sample(): Design {
  const d = emptyDesign();
  const home = d.screens[0];
  const row = makeNode(d, 'row', {}, 'row');
  home.nodes.push(row);
  row.children!.push(makeNode(d, 'button', { text: 'Go', tap: 'screen', tapValue: 'Shop' }, 'go'));
  d.screens.push({ id: 'scr_shop', name: 'Shop', background: '', nodes: [makeNode(d, 'title', { text: 'Shop' }, 'shopTitle')] });
  return d;
}

describe('design model', () => {
  it('saves and loads exactly', () => {
    const d = sample();
    expect(parseDesign(serializeDesign(d))).toEqual(d);
  });

  it('rejects broken files and drops unknown parts without crashing', () => {
    expect(parseDesign('{ nope')).toBeNull();
    expect(parseDesign('[]')).toBeNull();
    const d = parseDesign(JSON.stringify({ screens: [{ name: 'A', nodes: [{ type: 'rocket' }, { type: 'text', props: { text: 'hi', bad: { x: 1 } } }] }] }))!;
    expect(d.screens[0].nodes).toHaveLength(1);
    expect(d.screens[0].nodes[0].props).toEqual({ text: 'hi' });
    expect(d.theme.primary).toBeTruthy();
  });

  it('keeps names unique and safe', () => {
    const d = sample();
    expect(uniqueName(d, 'go')).toBe('go2');
    expect(uniqueName(d, 'my button!')).toBe('my-button');
  });

  it('adds inside a selected container, or after a selected thing', () => {
    let d = sample();
    const rowId = d.screens[0].nodes[0].id;
    const goId = d.screens[0].nodes[0].children![0].id;
    const a = makeNode(d, 'text', {}, 'a');
    d = insertNode(d, d.screens[0].id, a, rowId);
    expect(d.screens[0].nodes[0].children!.map((n) => n.name)).toEqual(['go', 'a']);
    const b = makeNode(d, 'text', {}, 'b');
    d = insertNode(d, d.screens[0].id, b, goId);
    expect(d.screens[0].nodes[0].children!.map((n) => n.name)).toEqual(['go', 'b', 'a']);
  });

  it('places things on a stage with x/y', () => {
    let d = starterDesign('game');
    const stage = d.screens[0].nodes[0];
    const pic = makeNode(d, 'image', { image: 'bird.png' }, 'bird');
    d = insertNode(d, d.screens[0].id, pic, stage.id);
    const placed = locate(d, pic.id)!.node;
    expect(typeof placed.props.x).toBe('number');
    expect(typeof placed.props.y).toBe('number');
  });

  it('never moves a box into itself', () => {
    const d = sample();
    const row = d.screens[0].nodes[0];
    expect(reparentNode(d, row.id, row.id)).toBe(d);
  });

  it('duplicates with new unique names, and removes', () => {
    const d = sample();
    const row = d.screens[0].nodes[0];
    const { design, newId } = duplicateNode(d, row.id);
    expect(designNames(design)).toEqual(['row', 'go', 'row2', 'go2', 'shopTitle']);
    expect(designNames(removeNode(design, newId!))).toEqual(['row', 'go', 'shopTitle']);
  });

  it('is stored in design.json', () => {
    const p = createProjectFromTemplate(blankTemplate('app'));
    expect(p.files.map((f) => f.path)).toContain(DESIGN_FILE);
    const d = readDesign(p)!;
    // a blank project is really blank: no sample words, buttons or blocks
    expect(designNames(d)).toEqual([]);
    expect(p.files.find((f) => f.path === 'main.js')!.content).toBe('');
    const game = readDesign(createProjectFromTemplate(blankTemplate('game')))!;
    expect(game.screens[0].nodes.map((n) => [n.type, n.children?.length])).toEqual([['stage', 0]]);
    const withTitle = insertNode(d, d.screens[0].id, makeNode(d, 'title', {}, 'hello'), null);
    const changed = withDesign(p, withTitle);
    expect(designNames(readDesign(changed))).toEqual(['hello']);
  });
});

describe('design rendering', () => {
  it('makes real elements named for blocks, with only the first screen showing', () => {
    const html = renderDesign(sample());
    expect(html).toContain('id="go"');
    expect(html).toContain('data-zm-tap="screen" data-zm-value="Shop"');
    expect(html).toMatch(/data-screen="Shop"[^>]*hidden/);
    expect(html).not.toMatch(/data-screen="Home"[^>]*hidden/);
  });

  it('escapes words and refuses unsafe style values', () => {
    const d = emptyDesign();
    d.screens[0].nodes.push(makeNode(d, 'text', { text: '<script>alert(1)</script>', bg: 'red;background:url(http://x)' }, 't'));
    const html = renderDesign(d);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('url(http');
  });

  it('is part of the preview and the exported page', () => {
    const p = createProjectFromTemplate(blankTemplate('website'));
    const doc = buildPreviewDocument({ project: p, assetUrls: {} });
    expect(doc).toContain('id="zm-design-root"');
    expect(doc).toContain('--zm-primary');
    expect(doc.indexOf('zm-design-root')).toBeLessThan(doc.indexOf('//# sourceURL=main.js'));
  });
});

describe('runtime: designed screens and controls', () => {
  const runtime = readFileSync(resolve(__dirname, '../../src/runtime/zinoRuntime.js'), 'utf8');
  type Api = Record<string, (...a: unknown[]) => unknown>;
  let api: Api;
  let zm: { start: () => void };

  beforeEach(() => {
    const d = sample();
    d.screens[0].nodes.push(makeNode(d, 'input', { label: 'Name' }, 'name'));
    d.screens[0].nodes.push(makeNode(d, 'checkbox', { text: 'OK' }, 'ok'));
    document.body.innerHTML = renderDesign(d);
    new Function(runtime).call(window);
    zm = (window as unknown as { __zm: { api: Api; start: () => void } }).__zm;
    api = (zm as unknown as { api: Api }).api;
  });

  const visibleScreen = () => document.querySelector('.zm-screen:not([hidden])')!.getAttribute('data-screen');

  it('“When tapped → go to a screen” works with no blocks', async () => {
    const opened: string[] = [];
    api.onScreen('Shop', () => { opened.push('Shop'); });
    zm.start();
    expect(visibleScreen()).toBe('Home');
    document.getElementById('go')!.click();
    await Promise.resolve();
    expect(visibleScreen()).toBe('Shop');
    expect(opened).toEqual(['Shop']);
    api.goToScreen('Home');
    expect(visibleScreen()).toBe('Home');
  });

  it('reads and sets designed text boxes and checkboxes by name', async () => {
    let changes = 0;
    api.onChange('name', () => { changes += 1; });
    zm.start();
    api.setValue('name', 'Sam');
    expect(api.getValue('name')).toBe('Sam');
    const input = document.querySelector('#name input') as HTMLInputElement;
    input.value = 'Alex';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
    expect(changes).toBe(1);
    expect(api.getValue('ok')).toBe(false);
    api.setValue('ok', true);
    expect(api.getValue('ok')).toBe(true);
  });
});

describe('moving things and ready-made sections', () => {
  it('↑ at the top of a box steps out of it; ↓ at the end steps out after it', async () => {
    const { stepNode, canStep } = await import('../../src/design/model');
    const d = sample();
    const go = d.screens[0].nodes[0].children![0];
    expect(canStep(d, go.id, -1)).toBe(true);
    const up = stepNode(d, go.id, -1);
    expect(up.screens[0].nodes.map((n) => n.name)).toEqual(['go', 'row']);
    expect(canStep(up, go.id, -1)).toBe(false);
    const down = stepNode(d, go.id, 1);
    expect(down.screens[0].nodes.map((n) => n.name)).toEqual(['row', 'go']);
  });

  it('moveTo puts a thing at an exact place (drag and drop), never inside itself', async () => {
    const { moveTo } = await import('../../src/design/model');
    let d = sample();
    const row = d.screens[0].nodes[0];
    d = insertNode(d, d.screens[0].id, makeNode(d, 'text', {}, 'a'), null);
    const a = d.screens[0].nodes[1];
    d = moveTo(d, a.id, row.id, 0);
    expect(d.screens[0].nodes[0].children!.map((n) => n.name)).toEqual(['a', 'go']);
    expect(moveTo(d, row.id, row.id, 0)).toBe(d);
  });

  it('every ready-made section builds with unique names and renders', async () => {
    const { SECTIONS, maker } = await import('../../src/design/sections');
    const d = emptyDesign();
    for (const sec of SECTIONS) d.screens[0].nodes.push(sec.build(maker(d)));
    const names = designNames(d);
    expect(new Set(names).size).toBe(names.length);
    const html = renderDesign(d);
    for (const sec of SECTIONS) expect(html.length).toBeGreaterThan(sec.id.length);
    expect(html).toContain('<details');
  });
});

describe('runtime: lists and saving', () => {
  const runtime = readFileSync(resolve(__dirname, '../../src/runtime/zinoRuntime.js'), 'utf8');
  it('adds, counts, removes and restores list items; saves values', () => {
    const d = emptyDesign();
    d.screens[0].nodes.push(makeNode(d, 'list', { items: '' }, 'todos'));
    document.body.innerHTML = renderDesign(d);
    (window as unknown as { __ZM_SAVED: unknown }).__ZM_SAVED = { best: 7 };
    new Function(runtime).call(window);
    const api = (window as unknown as { __zm: { api: Record<string, (...a: unknown[]) => unknown> } }).__zm.api;
    api.addItem('todos', 'Milk');
    api.addItem('todos', 'Eggs');
    expect(api.countItems('todos')).toBe(2);
    expect(api.itemsOf('todos')).toBe('Milk\nEggs');
    api.removeItem('todos', 1);
    expect(api.itemsOf('todos')).toBe('Eggs');
    api.setItems('todos', 'A\nB\nC');
    expect(api.countItems('todos')).toBe(3);
    expect(api.loadValue('best')).toBe(7);
    api.saveValue('best', 9);
    expect(api.loadValue('best')).toBe(9);
    expect(api.loadValue('nothing')).toBe('');
  });
});
