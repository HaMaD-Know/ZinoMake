/**
 * The ZinoMake block catalogue.
 *
 * This single description drives three things, so they can never drift apart:
 *   1. Blockly block definitions (src/programming/blocks/register.ts)
 *   2. Block → JavaScript generation (src/programming/generators/blocksToCode.ts)
 *   3. JavaScript → block conversion (src/programming/parsers/codeToBlocks.ts)
 *
 * "Call blocks" map 1:1 onto a function of the ZinoMake runtime (src/runtime/zinoRuntime.ts),
 * e.g. the "show message" block <-> `say("Hello!");`.
 */
import type { ProjectType } from '../../model/project';

export type CategoryId =
  | 'start'
  | 'objects'
  | 'events'
  | 'motion'
  | 'looks'
  | 'sound'
  | 'values'
  | 'decisions'
  | 'repeat'
  | 'variables'
  | 'functions'
  | 'time';

export interface CategorySpec {
  id: CategoryId;
  name: string;
  colour: string;
  /** Which project types show this category. Undefined = all. */
  types?: ProjectType[];
  help: string;
}

export const CATEGORIES: CategorySpec[] = [
  { id: 'start', name: 'Start', colour: '#e8a317', help: 'Every program begins with a start block. Put other blocks inside it.' },
  { id: 'objects', name: 'Make things', colour: '#0e8f9e', help: 'Add a stage, characters, shapes, text, buttons and boxes to type in — no code needed.' },
  { id: 'events', name: 'Events', colour: '#d9822b', help: 'Do something when a button is clicked or a key is pressed.' },
  { id: 'motion', name: 'Movement', colour: '#3b82c4', types: ['game', 'animation', 'website'], help: 'Move objects around the screen and check if they touch.' },
  { id: 'looks', name: 'Looks', colour: '#8a5cc2', help: 'Show messages, change colours and change what things look like.' },
  { id: 'sound', name: 'Sound', colour: '#c2509a', help: 'Play short sound effects.' },
  { id: 'values', name: 'Numbers & text', colour: '#4f9a5d', help: 'Numbers, words, maths and random numbers.' },
  { id: 'decisions', name: 'Decisions', colour: '#3a8f8f', help: 'Do something only if something is true.' },
  { id: 'repeat', name: 'Repeat', colour: '#c96e2e', help: 'Do the same thing many times.' },
  { id: 'variables', name: 'Remember', colour: '#d0533f', help: 'Remember a number or word (a “variable”), like a score.' },
  { id: 'functions', name: 'My blocks', colour: '#7a6a58', help: 'Make your own block from a group of blocks (a “function”).' },
  { id: 'time', name: 'Time', colour: '#5a7bd6', help: 'Wait, or do something again and again every few seconds.' },
];

export type ValueCheck = 'Number' | 'String' | 'Boolean' | null;

export type ArgSpec =
  | { kind: 'text'; name: string; default: string; label?: string }
  | { kind: 'dropdown'; name: string; options: [string, string][] }
  | { kind: 'number'; name: string; default: number }
  | { kind: 'value'; name: string; check: ValueCheck; default: number | string | boolean };

export interface CallBlockSpec {
  type: string;
  category: CategoryId;
  /** event: hat block whose body is the last call argument; statement; value: expression. */
  shape: 'event' | 'statement' | 'value' | 'statement-body';
  /** Runtime function name. */
  fn: string;
  /** Statement is emitted as `await fn(...)`. */
  await?: boolean;
  /** Blockly message; %1..%n refer to args in order. */
  message: string;
  args: ArgSpec[];
  output?: ValueCheck;
  tooltip: string;
  types?: ProjectType[];
  /** Optional heading shown above this block in the toolbox (starts a new group). */
  group?: string;
}

export const KEY_OPTIONS: [string, string][] = [
  ['right arrow', 'ArrowRight'],
  ['left arrow', 'ArrowLeft'],
  ['up arrow', 'ArrowUp'],
  ['down arrow', 'ArrowDown'],
  ['space', 'Space'],
  ['enter', 'Enter'],
  ['W', 'w'],
  ['A', 'a'],
  ['S', 's'],
  ['D', 'd'],
];

export const SOUND_OPTIONS: [string, string][] = [
  ['beep', 'beep'],
  ['coin', 'coin'],
  ['jump', 'jump'],
  ['hit', 'hit'],
  ['win', 'win'],
  ['lose', 'lose'],
];

export const STYLE_OPTIONS: [string, string][] = [
  ['fill colour', 'fill'],
  ['text colour', 'textColor'],
  ['text size', 'textSize'],
  ['roundness', 'roundness'],
  ['border colour', 'border'],
  ['see-through % (0–100)', 'seeThrough'],
  ['layer (bigger = in front)', 'layer'],
  ['font', 'font'],
];

const NAME = (d: string): ArgSpec => ({ kind: 'text', name: 'NAME', default: d });
const num = (name: string, d: number): ArgSpec => ({ kind: 'value', name, check: 'Number', default: d });
const str = (name: string, d: string): ArgSpec => ({ kind: 'value', name, check: null, default: d });

export const CALL_BLOCKS: CallBlockSpec[] = [
  // ---- Start / time ----
  {
    type: 'zm_on_start', category: 'start', shape: 'event', fn: 'onStart',
    message: '▶ when Play is pressed', args: [],
    tooltip: 'The blocks inside run when you press Play (when the project starts).',
  },
  {
    type: 'zm_every', category: 'time', shape: 'event', fn: 'every',
    message: '⏱ every %1 seconds', args: [{ kind: 'number', name: 'SECONDS', default: 1 }],
    tooltip: 'Runs the blocks inside again and again, every few seconds.',
  },
  // ---- Make things (create objects without editing index.html) ----
  {
    type: 'zm_set_stage', category: 'objects', shape: 'statement', fn: 'setStage', group: 'On the stage',
    message: '🖼 make the stage width %1 height %2 colour %3',
    args: [num('WIDTH', 360), num('HEIGHT', 280), str('COLOR', 'skyblue')],
    tooltip: 'Makes (or resizes) the stage: the box where characters and shapes live.',
  },
  {
    type: 'zm_add_character', category: 'objects', shape: 'statement', fn: 'addCharacter',
    message: '➕ add character %1 looking like %2 at x %3 y %4 size %5',
    args: [NAME('player'), str('LOOK', '🐱'), num('X', 160), num('Y', 120), num('SIZE', 48)],
    tooltip: 'Adds a character to the stage. Its look can be any emoji, like 🐱 🚀 ⭐ 👾.',
  },
  {
    type: 'zm_add_box', category: 'objects', shape: 'statement', fn: 'addBox',
    message: '➕ add box %1 at x %2 y %3 width %4 height %5 colour %6',
    args: [NAME('box'), num('X', 40), num('Y', 40), num('WIDTH', 60), num('HEIGHT', 40), str('COLOR', 'tomato')],
    tooltip: 'Adds a rectangle to the stage. Use it for players, walls, floors and platforms.',
  },
  {
    type: 'zm_add_circle', category: 'objects', shape: 'statement', fn: 'addCircle',
    message: '➕ add circle %1 at x %2 y %3 size %4 colour %5',
    args: [NAME('ball'), num('X', 100), num('Y', 100), num('SIZE', 40), str('COLOR', 'gold')],
    tooltip: 'Adds a circle to the stage. Great for balls and coins.',
  },
  {
    type: 'zm_add_picture', category: 'objects', shape: 'statement', fn: 'addPicture',
    message: '➕ add picture %1 using %2 at x %3 y %4 size %5',
    args: [NAME('picture'), { kind: 'text', name: 'ASSET', default: 'picture.png' }, num('X', 40), num('Y', 40), num('SIZE', 80)],
    tooltip: 'Adds one of your pictures (from Pictures & sounds) to the stage.',
  },
  {
    type: 'zm_add_label', category: 'objects', shape: 'statement', fn: 'addLabel',
    message: '➕ add words %1 saying %2 at x %3 y %4 size %5',
    args: [NAME('score'), str('TEXT', 'Score: 0'), num('X', 10), num('Y', 10), num('SIZE', 20)],
    tooltip: 'Adds words to the stage, like a score or a title. Change them later with “set text of”.',
  },
  {
    type: 'zm_add_title', category: 'objects', shape: 'statement', fn: 'addTitle', group: 'On the page',
    message: '➕ add title %1 saying %2',
    args: [NAME('title'), str('TEXT', 'Hello!')],
    tooltip: 'Adds a big heading to the page.',
  },
  {
    type: 'zm_add_paragraph', category: 'objects', shape: 'statement', fn: 'addParagraph',
    message: '➕ add words %1 saying %2',
    args: [NAME('words'), str('TEXT', 'Write something here.')],
    tooltip: 'Adds a line of text to the page.',
  },
  {
    type: 'zm_add_button', category: 'objects', shape: 'statement', fn: 'addButton',
    message: '➕ add button %1 saying %2',
    args: [NAME('button'), str('TEXT', 'Click me')],
    tooltip: 'Adds a button. Use “when … is clicked” with the same name to make it do something.',
  },
  {
    type: 'zm_add_input', category: 'objects', shape: 'statement', fn: 'addInput',
    message: '➕ add typing box %1 with hint %2',
    args: [NAME('input'), str('TEXT', 'Type here')],
    tooltip: 'Adds a box people can type into. Read it with “what is typed in”.',
  },
  {
    type: 'zm_add_arrows', category: 'objects', shape: 'statement', fn: 'addArrowButtons',
    message: '🎮 add arrow buttons for phones', args: [],
    tooltip: 'Adds on-screen ◀ ▲ ▼ ▶ buttons that work like the arrow keys, for phones and tablets.',
  },
  {
    type: 'zm_remove', category: 'objects', shape: 'statement', fn: 'remove', group: 'Take away',
    message: '🗑 remove %1', args: [{ kind: 'text', name: 'TARGET', default: 'box' }],
    tooltip: 'Takes a thing away for good. (Use “hide” if you want to show it again later.)',
  },
  // ---- Events ----
  {
    type: 'zm_on_click', category: 'events', shape: 'event', fn: 'onClick',
    message: '👆 when %1 is clicked', args: [{ kind: 'text', name: 'TARGET', default: 'button' }],
    tooltip: 'Runs when the thing with this name (its id) is clicked or tapped.',
  },
  {
    type: 'zm_on_key', category: 'events', shape: 'event', fn: 'onKey',
    message: '⌨ when %1 key is pressed', args: [{ kind: 'dropdown', name: 'KEY', options: KEY_OPTIONS }],
    tooltip: 'Runs each time this key is pressed. Click the preview first so it can hear the keyboard.',
  },
  {
    type: 'zm_key_down', category: 'events', shape: 'value', fn: 'isKeyDown', output: 'Boolean',
    message: '%1 key is held down', args: [{ kind: 'dropdown', name: 'KEY', options: KEY_OPTIONS }],
    tooltip: 'True while this key is held down. Great inside “forever”.',
  },
  // ---- Motion ----
  {
    type: 'zm_move', category: 'motion', shape: 'statement', fn: 'move',
    message: 'move %1 by x %2 y %3',
    args: [
      { kind: 'text', name: 'TARGET', default: 'player' },
      { kind: 'value', name: 'DX', check: 'Number', default: 10 },
      { kind: 'value', name: 'DY', check: 'Number', default: 0 },
    ],
    tooltip: 'Moves an object. Positive x goes right, positive y goes down.',
  },
  {
    type: 'zm_move_to', category: 'motion', shape: 'statement', fn: 'moveTo',
    message: 'put %1 at x %2 y %3',
    args: [
      { kind: 'text', name: 'TARGET', default: 'player' },
      { kind: 'value', name: 'X', check: 'Number', default: 0 },
      { kind: 'value', name: 'Y', check: 'Number', default: 0 },
    ],
    tooltip: 'Places an object at an exact spot. 0, 0 is the top-left corner.',
  },
  {
    type: 'zm_get_x', category: 'motion', shape: 'value', fn: 'getX', output: 'Number',
    message: 'x of %1', args: [{ kind: 'text', name: 'TARGET', default: 'player' }],
    tooltip: 'How far right the object is.',
  },
  {
    type: 'zm_get_y', category: 'motion', shape: 'value', fn: 'getY', output: 'Number',
    message: 'y of %1', args: [{ kind: 'text', name: 'TARGET', default: 'player' }],
    tooltip: 'How far down the object is.',
  },
  {
    type: 'zm_touching', category: 'motion', shape: 'value', fn: 'touching', output: 'Boolean',
    message: '%1 is touching %2',
    args: [
      { kind: 'text', name: 'A', default: 'player' },
      { kind: 'text', name: 'B', default: 'coin' },
    ],
    tooltip: 'True when the two objects overlap.',
  },
  {
    type: 'zm_turn', category: 'motion', shape: 'statement', fn: 'turn',
    message: '↻ turn %1 by %2 degrees',
    args: [{ kind: 'text', name: 'TARGET', default: 'player' }, num('DEGREES', 15)],
    tooltip: 'Spins an object. Positive numbers turn clockwise.',
  },
  {
    type: 'zm_mouse_x', category: 'motion', shape: 'value', fn: 'mouseX', output: 'Number',
    message: 'mouse x', args: [],
    tooltip: 'How far right the mouse (or finger) is on the stage.',
  },
  {
    type: 'zm_mouse_y', category: 'motion', shape: 'value', fn: 'mouseY', output: 'Number',
    message: 'mouse y', args: [],
    tooltip: 'How far down the mouse (or finger) is on the stage.',
  },
  // ---- Looks ----
  {
    type: 'zm_say', category: 'looks', shape: 'statement', fn: 'say',
    message: '💬 show message %1', args: [{ kind: 'value', name: 'MESSAGE', check: null, default: 'Hello!' }],
    tooltip: 'Shows a message bubble in the preview.',
  },
  {
    type: 'zm_set_text', category: 'looks', shape: 'statement', fn: 'setText',
    message: 'set text of %1 to %2',
    args: [
      { kind: 'text', name: 'TARGET', default: 'score' },
      { kind: 'value', name: 'VALUE', check: null, default: 'Hi' },
    ],
    tooltip: 'Changes the words or number shown by a thing on the page.',
  },
  {
    type: 'zm_set_color', category: 'looks', shape: 'statement', fn: 'setColor',
    message: 'set colour of %1 to %2',
    args: [
      { kind: 'text', name: 'TARGET', default: 'player' },
      { kind: 'value', name: 'COLOR', check: 'String', default: 'tomato' },
    ],
    tooltip: 'Changes the colour of a thing. Try red, blue, gold or #ff8800.',
  },
  {
    type: 'zm_set_background', category: 'looks', shape: 'statement', fn: 'setBackground',
    message: 'set background to %1', args: [{ kind: 'value', name: 'COLOR', check: 'String', default: 'skyblue' }],
    tooltip: 'Changes the background colour of the scene.',
  },
  {
    type: 'zm_set_image', category: 'looks', shape: 'statement', fn: 'setImage',
    message: 'show picture %2 on %1',
    args: [
      { kind: 'text', name: 'TARGET', default: 'player' },
      { kind: 'text', name: 'ASSET', default: 'picture.png' },
    ],
    tooltip: 'Shows one of your project pictures (from Assets) on a thing.',
  },
  {
    type: 'zm_set_size', category: 'looks', shape: 'statement', fn: 'setSize',
    message: 'set size of %1 to width %2 height %3',
    args: [{ kind: 'text', name: 'TARGET', default: 'player' }, num('WIDTH', 60), num('HEIGHT', 60)],
    tooltip: 'Makes a thing bigger or smaller. For characters, the height is the size.',
  },
  {
    type: 'zm_set_style', category: 'looks', shape: 'statement', fn: 'setStyle',
    message: '🎨 set %2 of %1 to %3',
    args: [
      { kind: 'text', name: 'TARGET', default: 'player' },
      { kind: 'dropdown', name: 'STYLE', options: STYLE_OPTIONS },
      str('VALUE', 'purple'),
    ],
    tooltip: 'Changes how a thing looks: colours, text size, roundness, border, see-through, layer or font.',
  },
  {
    type: 'zm_show', category: 'looks', shape: 'statement', fn: 'show',
    message: 'show %1', args: [{ kind: 'text', name: 'TARGET', default: 'player' }],
    tooltip: 'Makes a hidden thing visible.',
  },
  {
    type: 'zm_hide', category: 'looks', shape: 'statement', fn: 'hide',
    message: 'hide %1', args: [{ kind: 'text', name: 'TARGET', default: 'player' }],
    tooltip: 'Hides a thing.',
  },
  // ---- Sound ----
  {
    type: 'zm_play_sound', category: 'sound', shape: 'statement', fn: 'playSound',
    message: '🔊 play sound %1', args: [{ kind: 'dropdown', name: 'SOUND', options: SOUND_OPTIONS }],
    tooltip: 'Plays a short sound effect. Browsers only allow sound after you click or tap the preview.',
  },
  {
    type: 'zm_play_asset', category: 'sound', shape: 'statement', fn: 'playAudio',
    message: '🔊 play audio file %1', args: [{ kind: 'text', name: 'ASSET', default: 'sound.mp3' }],
    tooltip: 'Plays one of your uploaded audio files (from Assets).',
  },
  // ---- Values ----
  {
    type: 'zm_random', category: 'values', shape: 'value', fn: 'random', output: 'Number',
    message: 'random number from %1 to %2',
    args: [
      { kind: 'value', name: 'FROM', check: 'Number', default: 1 },
      { kind: 'value', name: 'TO', check: 'Number', default: 10 },
    ],
    tooltip: 'Picks a whole number between the two numbers.',
  },
  {
    type: 'zm_join', category: 'values', shape: 'value', fn: 'join', output: 'String',
    message: 'join %1 %2',
    args: [
      { kind: 'value', name: 'A', check: null, default: 'Score: ' },
      { kind: 'value', name: 'B', check: null, default: 'text' },
    ],
    tooltip: 'Sticks two pieces of text (or numbers) together.',
  },
  {
    type: 'zm_get_value', category: 'values', shape: 'value', fn: 'getValue', output: null,
    message: 'what is typed in %1', args: [{ kind: 'text', name: 'TARGET', default: 'input' }],
    tooltip: 'The text typed into an input box. Numbers come back as numbers.',
  },
  {
    type: 'zm_round', category: 'values', shape: 'value', fn: 'roundNumber', output: 'Number',
    message: 'round %1', args: [num('VALUE', 2.5)],
    tooltip: 'Rounds a number to the nearest whole number.',
  },
  // ---- Repeat ----
  {
    type: 'zm_forever', category: 'repeat', shape: 'statement-body', fn: 'forever',
    message: '🔁 forever', args: [],
    tooltip: 'Keeps doing the blocks inside about 60 times a second, in the background.',
  },
  {
    type: 'zm_stop', category: 'repeat', shape: 'statement', fn: 'stop',
    message: '⏹ stop the project', args: [],
    tooltip: 'Stops everything, just like pressing Stop. Use it when the game is over.',
  },
  // ---- Time ----
  {
    type: 'zm_wait', category: 'time', shape: 'statement', fn: 'wait', await: true,
    message: '⏳ wait %1 seconds', args: [{ kind: 'value', name: 'SECONDS', check: 'Number', default: 1 }],
    tooltip: 'Pauses before doing the next block.',
  },
];

export const CALL_BLOCK_BY_TYPE = new Map(CALL_BLOCKS.map((b) => [b.type, b]));
export const CALL_BLOCK_BY_FN = new Map(CALL_BLOCKS.map((b) => [b.fn, b]));

/** Every name the runtime provides; users can't use these as variable or function names. */
export const RUNTIME_NAMES = new Set<string>([
  ...CALL_BLOCKS.map((b) => b.fn),
  'stop',
  'log',
]);

/** Identifiers that must never be treated as user variables. */
export const RESERVED_GLOBALS = new Set<string>([
  'undefined', 'NaN', 'Infinity', 'window', 'document', 'console', 'Math', 'JSON', 'Date', 'Object',
  'Array', 'String', 'Number', 'Boolean', 'Promise', 'globalThis', 'self', 'this', 'arguments',
  'parent', 'top', 'location', 'alert', 'fetch', 'setTimeout', 'setInterval', 'eval',
]);

/** Non-call blocks the generator and parser handle specially. */
export const SPECIAL_BLOCK_TYPES = [
  'controls_if', 'logic_compare', 'logic_operation', 'logic_negate', 'logic_boolean',
  'math_number', 'math_arithmetic', 'text', 'variables_set', 'variables_get', 'math_change',
  'zm_let', 'zm_repeat', 'zm_while', 'zm_function_def', 'zm_function_call', 'zm_raw', 'zm_note',
] as const;
