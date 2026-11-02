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
    types: ['app', 'website'],
  },
  // ---- Repeat ----
  {
    type: 'zm_forever', category: 'repeat', shape: 'statement-body', fn: 'forever',
    message: '🔁 forever', args: [],
    tooltip: 'Keeps doing the blocks inside about 60 times a second, in the background.',
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
