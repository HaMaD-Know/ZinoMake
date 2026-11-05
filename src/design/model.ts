/**
 * ZinoMake visual designer: the data model.
 *
 * A project's design lives in `design.json`. It holds screens (pages), each with a tree of
 * components. Every component has a unique `name`, which becomes its element id, so blocks
 * can use it exactly like things written in index.html (“when button is clicked”, “move bird”).
 *
 * Everything here is pure and serialisable so it is easy to test and to keep in a project file.
 */
import { newId, type Project, type ProjectType } from '../model/project';

export const DESIGN_FILE = 'design.json';
export const DESIGN_VERSION = 1;

export type CompType =
  | 'navbar' | 'section' | 'row' | 'column' | 'grid' | 'card' | 'stage' | 'spacer' | 'divider'
  | 'title' | 'text' | 'list' | 'link' | 'badge' | 'faq' | 'table'
  | 'image' | 'character' | 'shape' | 'progress'
  | 'button' | 'input' | 'textarea' | 'checkbox' | 'select' | 'slider';

export type PropValue = string | number | boolean;

export interface DesignNode {
  id: string;
  type: CompType;
  /** Unique name; used as the element id, and by blocks. */
  name: string;
  props: Record<string, PropValue>;
  children?: DesignNode[];
}

export interface Screen {
  id: string;
  name: string;
  background: string;
  nodes: DesignNode[];
}

export interface Theme {
  primary: string;
  background: string;
  text: string;
  font: 'rounded' | 'modern' | 'classic' | 'mono' | 'playful';
  corners: 'square' | 'rounded' | 'round';
}

export interface Design {
  version: number;
  theme: Theme;
  screens: Screen[];
}

export const DEFAULT_THEME: Theme = { primary: '#5b4bdb', background: '#ffffff', text: '#1d2433', font: 'modern', corners: 'rounded' };

// ------------------------------------------------------------------ component catalogue

export type FieldKind = 'text' | 'longtext' | 'number' | 'color' | 'select' | 'toggle' | 'image' | 'screen' | 'size';

export interface FieldSpec {
  key: string;
  label: string;
  kind: FieldKind;
  options?: [string, string][];
  hint?: string;
}

export interface CompSpec {
  type: CompType;
  label: string;
  icon: string;
  group: 'Layout' | 'Text' | 'Pictures' | 'Controls';
  /** Lays its children out side by side (used to decide drop positions). */
  horizontal?: boolean;
  /** Can hold other components. */
  container?: boolean;
  /** Children are placed freely with x/y (a game stage). */
  free?: boolean;
  /** Can be tapped/clicked (shows the “When tapped” section). */
  tappable?: boolean;
  /** Has a value people change (shows “when … changes” blocks). */
  changes?: boolean;
  defaults: Record<string, PropValue>;
  fields: FieldSpec[];
  help: string;
}

const ALIGN: [string, string][] = [['Left', 'left'], ['Centre', 'center'], ['Right', 'right']];
const ITEMS_ALIGN: [string, string][] = [['Start', 'start'], ['Centre', 'center'], ['End', 'end'], ['Stretch', 'stretch']];
const JUSTIFY: [string, string][] = [['Start', 'start'], ['Centre', 'center'], ['End', 'end'], ['Spread out', 'between']];

export const COMPONENTS: CompSpec[] = [
  // Layout
  {
    type: 'navbar', label: 'Nav bar', icon: '🧭', group: 'Layout',
    defaults: { text: 'My App', links: true, sticky: true },
    fields: [
      { key: 'text', label: 'Title', kind: 'text' },
      { key: 'links', label: 'Show a button for every screen', kind: 'toggle' },
      { key: 'sticky', label: 'Stay at the top when scrolling', kind: 'toggle' },
    ],
    help: 'A bar at the top with your app’s name and buttons that go to each screen.',
  },
  {
    type: 'section', label: 'Section', icon: '▭', group: 'Layout', container: true,
    defaults: { width: 'wide', padding: 40, gap: 16, align: 'center', textAlign: 'center' },
    fields: [
      { key: 'width', label: 'Content width', kind: 'select', options: [['Full', 'full'], ['Wide', 'wide'], ['Narrow', 'narrow']] },
      { key: 'image', label: 'Background picture', kind: 'image' },
      { key: 'align', label: 'Line up items', kind: 'select', options: ITEMS_ALIGN },
      { key: 'textAlign', label: 'Text', kind: 'select', options: ALIGN },
    ],
    help: 'A band across the page (like a “hero” or “features” area). Put other things inside it.',
  },
  {
    type: 'row', label: 'Row', icon: '⇹', group: 'Layout', container: true, horizontal: true,
    defaults: { gap: 12, align: 'center', justify: 'start', wrap: true },
    fields: [
      { key: 'align', label: 'Line up (up/down)', kind: 'select', options: ITEMS_ALIGN },
      { key: 'justify', label: 'Spread (left/right)', kind: 'select', options: JUSTIFY },
      { key: 'wrap', label: 'Wrap onto the next line', kind: 'toggle' },
    ],
    help: 'Puts things side by side.',
  },
  {
    type: 'column', label: 'Column', icon: '⇵', group: 'Layout', container: true,
    defaults: { gap: 12, align: 'stretch', justify: 'start' },
    fields: [
      { key: 'align', label: 'Line up (left/right)', kind: 'select', options: ITEMS_ALIGN },
      { key: 'justify', label: 'Spread (up/down)', kind: 'select', options: JUSTIFY },
    ],
    help: 'Puts things one under another. Put two columns in a row for a two-column layout.',
  },
  {
    type: 'grid', label: 'Grid', icon: '▦', group: 'Layout', container: true, horizontal: true,
    defaults: { columns: 3, gap: 16 },
    fields: [{ key: 'columns', label: 'Columns (on big screens)', kind: 'number', hint: 'On phones the grid shows fewer columns by itself.' }],
    help: 'Puts things in neat columns — great for cards, products and photo galleries.',
  },
  {
    type: 'card', label: 'Card', icon: '🗂', group: 'Layout', container: true,
    defaults: { padding: 20, gap: 10, shadow: 'soft', bg: '#ffffff', radius: 16, align: 'stretch' },
    fields: [
      { key: 'align', label: 'Line up items', kind: 'select', options: ITEMS_ALIGN },
      { key: 'image', label: 'Background picture', kind: 'image' },
    ],
    help: 'A box with a soft shadow, great for products, profiles and settings.',
  },
  {
    type: 'stage', label: 'Game stage', icon: '🎮', group: 'Layout', container: true, free: true,
    defaults: { width: '360', height: '280', bg: '#87ceeb', image: '', border: '#1d2433', borderWidth: 3, radius: 14 },
    fields: [{ key: 'image', label: 'Background picture', kind: 'image' }],
    help: 'A play area for games and animations. Drag things to place them anywhere on it.',
  },
  // (grid is defined above with the other boxes)
  { type: 'spacer', label: 'Space', icon: '↕', group: 'Layout', defaults: { height: '32' }, fields: [], help: 'Empty space between things.' },
  { type: 'divider', label: 'Line', icon: '―', group: 'Layout', defaults: { color: '#d9d6cf' }, fields: [], help: 'A thin line to separate parts.' },
  // Text
  {
    type: 'title', label: 'Title', icon: '🅃', group: 'Text', tappable: true,
    defaults: { text: 'Big title', level: '1' },
    fields: [
      { key: 'text', label: 'Words', kind: 'text' },
      { key: 'level', label: 'Size', kind: 'select', options: [['Huge', '1'], ['Big', '2'], ['Medium', '3']] },
    ],
    help: 'A heading.',
  },
  {
    type: 'text', label: 'Text', icon: '¶', group: 'Text', tappable: true,
    defaults: { text: 'Write something here.' },
    fields: [{ key: 'text', label: 'Words', kind: 'longtext' }],
    help: 'A paragraph of text.',
  },
  {
    type: 'list', label: 'List', icon: '☰', group: 'Text',
    defaults: { items: 'First thing\nSecond thing\nThird thing', numbered: false },
    fields: [
      { key: 'items', label: 'Items (one per line)', kind: 'longtext' },
      { key: 'numbered', label: 'Numbered', kind: 'toggle' },
    ],
    help: 'A bulleted or numbered list.',
  },
  {
    type: 'badge', label: 'Badge', icon: '🏷', group: 'Text', tappable: true,
    defaults: { text: 'New' },
    fields: [{ key: 'text', label: 'Words', kind: 'text' }],
    help: 'A small coloured label, like “New”, “Sale” or “Pro”.',
  },
  {
    type: 'faq', label: 'Question', icon: '❓', group: 'Text',
    defaults: { text: 'How does it work?', answer: 'Tap a question to see its answer.', open: false },
    fields: [
      { key: 'text', label: 'Question', kind: 'text' },
      { key: 'answer', label: 'Answer', kind: 'longtext' },
      { key: 'open', label: 'Open at the start', kind: 'toggle' },
    ],
    help: 'A question that opens to show its answer (for FAQ pages).',
  },
  {
    type: 'table', label: 'Table', icon: '▤', group: 'Text',
    defaults: { rows: 'Plan, Price, Support\nFree, $0, Email\nPro, $9, Chat' },
    fields: [{ key: 'rows', label: 'Rows (one per line, cells separated by commas; the first line is the heading)', kind: 'longtext' }],
    help: 'A simple table, like a price list or a timetable.',
  },
  {
    type: 'link', label: 'Link', icon: '🔗', group: 'Text', tappable: true,
    defaults: { text: 'Visit my site', url: 'https://example.com' },
    fields: [
      { key: 'text', label: 'Words', kind: 'text' },
      { key: 'url', label: 'Web address', kind: 'text', hint: 'Links open in the exported web page (the preview is offline).' },
    ],
    help: 'A link to another web page.',
  },
  // Pictures
  {
    type: 'image', label: 'Picture', icon: '🖼', group: 'Pictures', tappable: true,
    defaults: { image: '', fit: 'contain', alt: '', width: '120', height: '' },
    fields: [
      { key: 'image', label: 'Picture', kind: 'image' },
      { key: 'fit', label: 'Fit', kind: 'select', options: [['Show all of it', 'contain'], ['Fill the box', 'cover'], ['Stretch', 'fill']] },
      { key: 'round', label: 'Round (for profile pictures)', kind: 'toggle' },
      { key: 'alt', label: 'Describe it (for screen readers)', kind: 'text' },
    ],
    help: 'One of your pictures from Pictures & sounds.',
  },
  {
    type: 'character', label: 'Character', icon: '🐱', group: 'Pictures', tappable: true,
    defaults: { emoji: '🐱', size: 48 },
    fields: [{ key: 'emoji', label: 'Looks like (any emoji)', kind: 'text' }],
    help: 'An emoji character for games and stories.',
  },
  {
    type: 'shape', label: 'Shape', icon: '⬛', group: 'Pictures', tappable: true,
    defaults: { shape: 'box', bg: '#ff6b6b', width: '60', height: '60' },
    fields: [{ key: 'shape', label: 'Shape', kind: 'select', options: [['Box', 'box'], ['Circle', 'circle'], ['Pill', 'pill']] }],
    help: 'A coloured box or circle: walls, platforms, coins, decorations.',
  },
  {
    type: 'progress', label: 'Progress bar', icon: '▰', group: 'Pictures',
    defaults: { value: 60, max: 100, label: '' },
    fields: [
      { key: 'label', label: 'Label above it', kind: 'text' },
      { key: 'value', label: 'How full', kind: 'number' },
      { key: 'max', label: 'Full at', kind: 'number' },
    ],
    help: 'Shows how far along something is. Change it with “set value of”.',
  },
  // Controls
  {
    type: 'button', label: 'Button', icon: '🔘', group: 'Controls', tappable: true,
    defaults: { text: 'Click me', variant: 'primary' },
    fields: [
      { key: 'text', label: 'Words', kind: 'text' },
      { key: 'variant', label: 'Style', kind: 'select', options: [['Filled', 'primary'], ['Soft', 'soft'], ['Outline', 'outline'], ['Plain', 'plain']] },
    ],
    help: 'A button. Choose what it does under “When tapped”.',
  },
  {
    type: 'input', label: 'Text box', icon: '⌨', group: 'Controls', changes: true,
    defaults: { label: 'Your name', placeholder: 'Type here', inputType: 'text' },
    fields: [
      { key: 'label', label: 'Label above it', kind: 'text' },
      { key: 'placeholder', label: 'Hint inside it', kind: 'text' },
      { key: 'inputType', label: 'Kind', kind: 'select', options: [['Text', 'text'], ['Number', 'number'], ['Email', 'email'], ['Password', 'password'], ['Phone', 'tel'], ['Date', 'date'], ['Time', 'time'], ['Colour', 'color']] },
    ],
    help: 'A box people type into. Read it with “what is typed in”.',
  },
  {
    type: 'textarea', label: 'Big text box', icon: '📝', group: 'Controls', changes: true,
    defaults: { label: 'Message', placeholder: 'Write here…', rows: 4 },
    fields: [
      { key: 'label', label: 'Label above it', kind: 'text' },
      { key: 'placeholder', label: 'Hint inside it', kind: 'text' },
      { key: 'rows', label: 'Lines tall', kind: 'number' },
    ],
    help: 'A bigger box for longer writing.',
  },
  {
    type: 'checkbox', label: 'Checkbox', icon: '☑', group: 'Controls', changes: true,
    defaults: { text: 'I agree', checked: false },
    fields: [
      { key: 'text', label: 'Words', kind: 'text' },
      { key: 'checked', label: 'Ticked at the start', kind: 'toggle' },
    ],
    help: 'A tick box. “what is typed in” gives true or false.',
  },
  {
    type: 'select', label: 'Dropdown', icon: '▾', group: 'Controls', changes: true,
    defaults: { label: 'Choose one', options: 'Red, Green, Blue' },
    fields: [
      { key: 'label', label: 'Label above it', kind: 'text' },
      { key: 'options', label: 'Choices (separate with commas)', kind: 'text' },
    ],
    help: 'A list to pick one choice from.',
  },
  {
    type: 'slider', label: 'Slider', icon: '🎚', group: 'Controls', changes: true,
    defaults: { label: 'Volume', min: 0, max: 100, value: 50 },
    fields: [
      { key: 'label', label: 'Label above it', kind: 'text' },
      { key: 'min', label: 'Smallest', kind: 'number' },
      { key: 'max', label: 'Biggest', kind: 'number' },
      { key: 'value', label: 'Starts at', kind: 'number' },
    ],
    help: 'Slide to choose a number.',
  },
];

export const COMPONENT_BY_TYPE = new Map(COMPONENTS.map((c) => [c.type, c]));

/** Look fields every component has (shown under “Look”). */
export const LOOK_FIELDS: FieldSpec[] = [
  { key: 'bg', label: 'Fill colour', kind: 'color' },
  { key: 'color', label: 'Text colour', kind: 'color' },
  { key: 'size', label: 'Text size', kind: 'number' },
  { key: 'bold', label: 'Bold', kind: 'toggle' },
  { key: 'textAlign', label: 'Text', kind: 'select', options: [['(normal)', ''], ...ALIGN] },
  { key: 'radius', label: 'Roundness', kind: 'number' },
  { key: 'border', label: 'Border colour', kind: 'color' },
  { key: 'borderWidth', label: 'Border thickness', kind: 'number' },
  { key: 'shadow', label: 'Shadow', kind: 'select', options: [['None', ''], ['Soft', 'soft'], ['Strong', 'strong']] },
  { key: 'opacity', label: 'See-through %', kind: 'number' },
  { key: 'hidden', label: 'Hidden at the start', kind: 'toggle', hint: 'Show it later with the “show” block.' },
];

export const SIZE_FIELDS: FieldSpec[] = [
  { key: 'width', label: 'Width', kind: 'size', hint: 'A number (pixels), a % like 50%, or empty for automatic.' },
  { key: 'height', label: 'Height', kind: 'size' },
  { key: 'padding', label: 'Space inside', kind: 'number' },
  { key: 'gap', label: 'Space between items', kind: 'number' },
  { key: 'margin', label: 'Space below', kind: 'number' },
];

export const TAP_ACTIONS: [string, string][] = [
  ['Nothing (or use blocks)', ''],
  ['Go to a screen', 'screen'],
  ['Show a message', 'say'],
  ['Play a sound', 'sound'],
  ['Open a web link', 'link'],
];

export const SOUND_CHOICES: [string, string][] = [['beep', 'beep'], ['coin', 'coin'], ['jump', 'jump'], ['hit', 'hit'], ['win', 'win'], ['lose', 'lose']];

// ------------------------------------------------------------------ creating & reading

export function emptyDesign(): Design {
  return { version: DESIGN_VERSION, theme: { ...DEFAULT_THEME }, screens: [{ id: newId('scr'), name: 'Home', background: '', nodes: [] }] };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function cleanNode(v: unknown, seen: Set<string>): DesignNode | null {
  if (!isObj(v) || typeof v.type !== 'string' || !COMPONENT_BY_TYPE.has(v.type as CompType)) return null;
  const spec = COMPONENT_BY_TYPE.get(v.type as CompType)!;
  const props: Record<string, PropValue> = {};
  if (isObj(v.props)) {
    for (const [k, p] of Object.entries(v.props)) if (typeof p === 'string' || typeof p === 'number' || typeof p === 'boolean') props[k] = p;
  }
  let id = typeof v.id === 'string' && v.id ? v.id : newId('n');
  while (seen.has(id)) id = newId('n');
  seen.add(id);
  const node: DesignNode = { id, type: spec.type, name: typeof v.name === 'string' && v.name ? safeThingName(v.name) : spec.type, props };
  if (spec.container) node.children = Array.isArray(v.children) ? (v.children.map((c) => cleanNode(c, seen)).filter(Boolean) as DesignNode[]) : [];
  return node;
}

/** Parse design.json; returns null if it is not valid. Unknown parts are dropped, never crash. */
export function parseDesign(text: string): Design | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(raw) || !Array.isArray(raw.screens)) return null;
  const seen = new Set<string>();
  const t = isObj(raw.theme) ? raw.theme : {};
  const theme: Theme = {
    primary: typeof t.primary === 'string' ? t.primary : DEFAULT_THEME.primary,
    background: typeof t.background === 'string' ? t.background : DEFAULT_THEME.background,
    text: typeof t.text === 'string' ? t.text : DEFAULT_THEME.text,
    font: ['rounded', 'modern', 'classic', 'mono', 'playful'].includes(t.font as string) ? (t.font as Theme['font']) : DEFAULT_THEME.font,
    corners: ['square', 'rounded', 'round'].includes(t.corners as string) ? (t.corners as Theme['corners']) : DEFAULT_THEME.corners,
  };
  const screens: Screen[] = raw.screens.filter(isObj).map((s, i) => ({
    id: typeof s.id === 'string' && s.id ? s.id : newId('scr'),
    name: typeof s.name === 'string' && s.name.trim() ? s.name.trim().slice(0, 40) : `Screen ${i + 1}`,
    background: typeof s.background === 'string' ? s.background : '',
    nodes: Array.isArray(s.nodes) ? (s.nodes.map((n) => cleanNode(n, seen)).filter(Boolean) as DesignNode[]) : [],
  }));
  if (!screens.length) screens.push({ id: newId('scr'), name: 'Home', background: '', nodes: [] });
  return { version: DESIGN_VERSION, theme, screens };
}

export function serializeDesign(d: Design): string {
  return JSON.stringify(d, null, 2) + '\n';
}

/** The project's design, or null when it has none (or design.json has a mistake). */
export function readDesign(p: Pick<Project, 'files'>): Design | null {
  const f = p.files.find((x) => x.kind === 'file' && x.path === DESIGN_FILE);
  return f ? parseDesign(f.content) : null;
}

export function hasDesignFile(p: Pick<Project, 'files'>): boolean {
  return p.files.some((x) => x.kind === 'file' && x.path === DESIGN_FILE);
}

export function withDesign<P extends Pick<Project, 'files'>>(p: P, d: Design): P {
  const content = serializeDesign(d);
  const exists = hasDesignFile(p);
  return {
    ...p,
    files: exists
      ? p.files.map((f) => (f.kind === 'file' && f.path === DESIGN_FILE ? { ...f, content } : f))
      : [...p.files, { path: DESIGN_FILE, kind: 'file' as const, content }],
  };
}

// ------------------------------------------------------------------ tree helpers

export function safeThingName(name: string): string {
  const s = name.trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').slice(0, 40);
  return s || 'thing';
}

export function walk(nodes: DesignNode[], fn: (n: DesignNode, parent: DesignNode | null) => void, parent: DesignNode | null = null): void {
  for (const n of nodes) {
    fn(n, parent);
    if (n.children) walk(n.children, fn, n);
  }
}

export function allNodes(d: Design): DesignNode[] {
  const out: DesignNode[] = [];
  for (const s of d.screens) walk(s.nodes, (n) => out.push(n));
  return out;
}

export function designNames(d: Design | null): string[] {
  return d ? allNodes(d).map((n) => n.name) : [];
}

export function uniqueName(d: Design, base: string, ignoreId?: string): string {
  const taken = new Set(allNodes(d).filter((n) => n.id !== ignoreId).map((n) => n.name));
  const b = safeThingName(base);
  if (!taken.has(b)) return b;
  for (let i = 2; ; i++) if (!taken.has(`${b}${i}`)) return `${b}${i}`;
}

export interface Located {
  node: DesignNode;
  /** The list that holds the node (a screen's nodes or a container's children). */
  list: DesignNode[];
  index: number;
  parent: DesignNode | null;
  screen: Screen;
}

export function locate(d: Design, id: string): Located | null {
  for (const screen of d.screens) {
    const found = findIn(screen.nodes, id, null, screen);
    if (found) return found;
  }
  return null;
}

function findIn(list: DesignNode[], id: string, parent: DesignNode | null, screen: Screen): Located | null {
  for (let i = 0; i < list.length; i++) {
    const n = list[i];
    if (n.id === id) return { node: n, list, index: i, parent, screen };
    if (n.children) {
      const f = findIn(n.children, id, n, screen);
      if (f) return f;
    }
  }
  return null;
}

/** Deep copy (designs are small) so updates never mutate React state. */
export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function makeNode(d: Design, type: CompType, extra: Record<string, PropValue> = {}, name?: string): DesignNode {
  const spec = COMPONENT_BY_TYPE.get(type)!;
  const node: DesignNode = { id: newId('n'), type, name: uniqueName(d, name ?? defaultName(type)), props: { ...spec.defaults, ...extra } };
  if (spec.container) node.children = [];
  return node;
}

function defaultName(type: CompType): string {
  return ({ input: 'textbox', textarea: 'message', select: 'dropdown', image: 'picture', navbar: 'nav' } as Record<string, string>)[type] ?? type;
}

/**
 * Add a node. If `targetId` is a container it goes inside it (at the end); otherwise right after
 * the target. With no target it goes at the end of the screen. Returns the new design.
 */
export function insertNode(d: Design, screenId: string, node: DesignNode, targetId: string | null): Design {
  const next = clone(d);
  const screen = next.screens.find((s) => s.id === screenId) ?? next.screens[0];
  const loc = targetId ? locate(next, targetId) : null;
  if (loc && loc.screen.id === screen.id) {
    const spec = COMPONENT_BY_TYPE.get(loc.node.type)!;
    if (spec.container) {
      placeInFree(loc.node, node);
      loc.node.children!.push(node);
    } else {
      if (loc.parent) placeInFree(loc.parent, node);
      loc.list.splice(loc.index + 1, 0, node);
    }
  } else {
    screen.nodes.push(node);
  }
  return next;
}

function placeInFree(container: DesignNode, node: DesignNode): void {
  if (!COMPONENT_BY_TYPE.get(container.type)?.free) return;
  if (node.props.x === undefined || node.props.y === undefined) {
    const k = container.children?.length ?? 0;
    node.props.x = 20 + ((k * 40) % 240);
    node.props.y = 20 + ((k * 30) % 160);
  }
  if (node.type === 'image' && !node.props.width) node.props.width = '64';
}

/** The list a node would go into: a container's children, or the screen's top level. */
function listFor(d: Design, screenId: string, parentId: string | null): { list: DesignNode[]; parent: DesignNode | null } | null {
  const screen = d.screens.find((s) => s.id === screenId);
  if (!screen) return null;
  if (!parentId) return { list: screen.nodes, parent: null };
  const loc = locate(d, parentId);
  if (!loc || !loc.node.children || loc.screen.id !== screenId) return null;
  return { list: loc.node.children, parent: loc.node };
}

/** Insert at an exact place (used by drag and drop). `at` is {x, y} for a stage. */
export function insertAt(d: Design, screenId: string, node: DesignNode, parentId: string | null, index: number, at?: { x: number; y: number }): Design {
  const next = clone(d);
  const target = listFor(next, screenId, parentId);
  if (!target) return d;
  if (target.parent && COMPONENT_BY_TYPE.get(target.parent.type)?.free && at) {
    node.props.x = Math.round(at.x);
    node.props.y = Math.round(at.y);
  } else if (!target.parent || !COMPONENT_BY_TYPE.get(target.parent.type)?.free) {
    delete node.props.x;
    delete node.props.y;
  }
  if (target.parent) placeInFree(target.parent, node);
  target.list.splice(Math.max(0, Math.min(index, target.list.length)), 0, node);
  return next;
}

/** Move an existing node to an exact place. Refuses to put a box inside itself. */
export function moveTo(d: Design, id: string, parentId: string | null, index: number, at?: { x: number; y: number }): Design {
  const loc = locate(d, id);
  if (!loc) return d;
  if (parentId) {
    let inside = false;
    walk([loc.node], (n) => { if (n.id === parentId) inside = true; });
    if (inside) return d;
  }
  const sameList = (loc.parent?.id ?? null) === parentId;
  const removed = removeNode(d, id);
  const node = clone(loc.node);
  const idx = sameList && index > loc.index ? index - 1 : index;
  return insertAt(removed, loc.screen.id, node, parentId, idx, at);
}

/**
 * ↑ / ↓: swap with the neighbour; at the start/end of a box, step out of it (before/after the box).
 * Returns the same design when there is nowhere to go.
 */
export function stepNode(d: Design, id: string, delta: -1 | 1): Design {
  const loc = locate(d, id);
  if (!loc) return d;
  const to = loc.index + delta;
  if (to >= 0 && to < loc.list.length) return moveNode(d, id, delta);
  if (!loc.parent) return d;
  const outer = locate(d, loc.parent.id);
  if (!outer) return d;
  return moveTo(d, id, outer.parent?.id ?? null, outer.index + (delta > 0 ? 1 : 0));
}

export function canStep(d: Design, id: string, delta: -1 | 1): boolean {
  return stepNode(d, id, delta) !== d;
}

export function updateNode(d: Design, id: string, fn: (n: DesignNode) => void): Design {
  const next = clone(d);
  const loc = locate(next, id);
  if (loc) fn(loc.node);
  return next;
}

export function removeNode(d: Design, id: string): Design {
  const next = clone(d);
  const loc = locate(next, id);
  if (loc) loc.list.splice(loc.index, 1);
  return next;
}

export function moveNode(d: Design, id: string, delta: -1 | 1): Design {
  const next = clone(d);
  const loc = locate(next, id);
  if (!loc) return d;
  const to = loc.index + delta;
  if (to < 0 || to >= loc.list.length) return d;
  const [n] = loc.list.splice(loc.index, 1);
  loc.list.splice(to, 0, n);
  return next;
}

/** Move a node into another container (or to the screen's top level with parentId null). */
export function reparentNode(d: Design, id: string, parentId: string | null): Design {
  const next = clone(d);
  const loc = locate(next, id);
  if (!loc) return d;
  if (parentId) {
    const target = locate(next, parentId);
    if (!target || !target.node.children) return d;
    // never move a container into itself or its own children
    let inside = false;
    walk([loc.node], (n) => { if (n.id === parentId) inside = true; });
    if (inside) return d;
    loc.list.splice(loc.index, 1);
    delete loc.node.props.x;
    delete loc.node.props.y;
    placeInFree(target.node, loc.node);
    target.node.children.push(loc.node);
  } else {
    loc.list.splice(loc.index, 1);
    delete loc.node.props.x;
    delete loc.node.props.y;
    loc.screen.nodes.push(loc.node);
  }
  return next;
}

export function duplicateNode(d: Design, id: string): { design: Design; newId: string | null } {
  const next = clone(d);
  const loc = locate(next, id);
  if (!loc) return { design: d, newId: null };
  const copy = clone(loc.node);
  const names = new Set(allNodes(next).map((n) => n.name));
  const fresh = (n: DesignNode) => {
    n.id = newId('n');
    const base = safeThingName(n.name.replace(/\d+$/, '')) || n.type;
    let name = base;
    for (let i = 2; names.has(name); i++) name = `${base}${i}`;
    names.add(name);
    n.name = name;
    n.children?.forEach(fresh);
  };
  fresh(copy);
  if (typeof copy.props.x === 'number') copy.props.x += 20;
  if (typeof copy.props.y === 'number') copy.props.y += 20;
  loc.list.splice(loc.index + 1, 0, copy);
  return { design: next, newId: copy.id };
}

export function firstStage(screen: Screen): DesignNode | null {
  let found: DesignNode | null = null;
  walk(screen.nodes, (n) => { if (!found && n.type === 'stage') found = n; });
  return found;
}

// ------------------------------------------------------------------ starter designs

/** A blank project's design: an empty screen (games and animations get an empty stage to play on). */
export function starterDesign(type: ProjectType): Design {
  const d = emptyDesign();
  if (type === 'game' || type === 'animation') d.screens[0].nodes.push(makeNode(d, 'stage', {}, 'stage'));
  return d;
}
