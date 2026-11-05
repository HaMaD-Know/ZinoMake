/**
 * Registers ZinoMake blocks, theme and toolbox with Blockly (browser only).
 * Block shapes come from catalog.ts so generator, parser and editor agree.
 */
import * as Blockly from 'blockly';
import type { ProjectType } from '../../model/project';
import { CALL_BLOCKS, CATEGORIES, type ArgSpec, type CategoryId, type CallBlockSpec } from './catalog';
import { safeName } from '../generators/blocksToCode';
import { promptDialog } from '../../components/Dialog';

/**
 * What the name/picture/sound dropdowns offer. Kept up to date by the block editor
 * (names made by blocks + ids in index.html, and the project's uploaded files).
 */
export const zmChoices: { things: string[]; images: string[]; sounds: string[] } = { things: [], images: [], sounds: [] };

const NEW_NAME = '\u0000zm-new-name';
type ChoiceSource = 'thing' | 'image' | 'sound';

/**
 * A dropdown that lists known names (or files) but accepts any value, so code that
 * names something not (yet) in the list still loads exactly. “Type a name…” lets people
 * use a name that isn't listed.
 */
class FieldZmChoice extends Blockly.FieldDropdown {
  private zmSource: ChoiceSource;
  private zmPending: string | null = null;

  constructor(source: ChoiceSource, value: string) {
    super(function (this: FieldZmChoice) {
      return this.zmOptions();
    } as Blockly.MenuGeneratorFunction);
    this.zmSource = source;
    this.setValue(value);
  }

  static override fromJson(options: Blockly.FieldDropdownFromJsonConfig & { source?: ChoiceSource; text?: string }): FieldZmChoice {
    return new FieldZmChoice(options.source ?? 'thing', options.text ?? '');
  }

  zmOptions(): Blockly.MenuOption[] {
    const source = this.zmSource ?? 'thing';
    const list = source === 'thing' ? zmChoices.things : source === 'image' ? zmChoices.images : zmChoices.sounds;
    const values = new Set<string>(list);
    const current = this.zmPending ?? (this.getValue() as string | null);
    if (current) values.add(current);
    const opts: Blockly.MenuOption[] = [...values].map((v) => [v, v]);
    if (source === 'thing') opts.push(['✏️ type a name…', NEW_NAME]);
    else if (!list.length) opts.push([source === 'image' ? '(add pictures in Pictures & sounds)' : '(add sounds in Pictures & sounds)', current || '']);
    return opts.length ? opts : [['', '']];
  }

  override getOptions(): Blockly.MenuOption[] {
    return this.zmOptions();
  }

  protected override doClassValidation_(newValue?: string): string | null {
    if (newValue === NEW_NAME) {
      void promptDialog({ title: 'Which thing?', label: 'Type the name of the thing (the name you gave it in “add …”)', initial: String(this.getValue() ?? '') }).then((name) => {
        const n = name?.trim();
        if (n) this.setValue(n);
      });
      return null;
    }
    if (typeof newValue !== 'string') return null;
    this.zmPending = newValue;
    return newValue;
  }

  protected override doValueUpdate_(newValue: string): void {
    super.doValueUpdate_(newValue);
    this.zmPending = null;
  }
}

const colourOf = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)!.colour;

function argJson(a: ArgSpec): Record<string, unknown> {
  switch (a.kind) {
    case 'text':
      return { type: 'field_input', name: a.name, text: a.default, spellcheck: false };
    case 'thing':
      return { type: 'field_zm_choice', name: a.name, source: 'thing', text: a.default };
    case 'asset':
      return { type: 'field_zm_choice', name: a.name, source: a.media, text: a.default };
    case 'dropdown':
      return { type: 'field_dropdown', name: a.name, options: a.options };
    case 'number':
      return { type: 'field_number', name: a.name, value: a.default, min: 0 };
    case 'value':
      return { type: 'input_value', name: a.name, ...(a.check ? { check: a.check } : {}) };
  }
}

function callBlockJson(spec: CallBlockSpec): Record<string, unknown> {
  const def: Record<string, unknown> = {
    type: spec.type,
    message0: spec.message,
    args0: spec.args.map(argJson),
    colour: colourOf(spec.category),
    tooltip: spec.tooltip,
    inputsInline: true,
  };
  if (spec.shape === 'value') def.output = spec.output ?? null;
  if (spec.shape === 'statement') {
    def.previousStatement = null;
    def.nextStatement = null;
  }
  if (spec.shape === 'event' || spec.shape === 'statement-body') {
    def.message1 = '%1';
    def.args1 = [{ type: 'input_statement', name: 'DO' }];
    def.inputsInline = true;
    if (spec.shape === 'statement-body') {
      def.previousStatement = null;
      def.nextStatement = null;
    }
  }
  return def;
}

let registered = false;

export function registerZinoBlocks(): void {
  if (registered) return;
  registered = true;
  Blockly.fieldRegistry.register('field_zm_choice', FieldZmChoice as unknown as Blockly.fieldRegistry.RegistrableField);

  Blockly.common.defineBlocksWithJsonArray([
    ...CALL_BLOCKS.map(callBlockJson),
    {
      type: 'zm_repeat', message0: '🔁 repeat %1 times', args0: [{ type: 'input_value', name: 'TIMES', check: 'Number' }],
      message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }],
      previousStatement: null, nextStatement: null, colour: colourOf('repeat'), inputsInline: true,
      tooltip: 'Does the blocks inside this many times.',
    },
    {
      type: 'zm_while', message0: '🔁 repeat while %1', args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }],
      message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }],
      previousStatement: null, nextStatement: null, colour: colourOf('repeat'), inputsInline: true,
      tooltip: 'Keeps doing the blocks inside while this is true. Add a wait inside so it doesn’t get stuck.',
    },
    {
      type: 'zm_let', message0: '🧠 remember %1 starting at %2',
      args0: [{ type: 'field_variable', name: 'VAR', variable: 'score' }, { type: 'input_value', name: 'VALUE' }],
      colour: colourOf('variables'), inputsInline: true,
      tooltip: 'Creates a variable and gives it a starting value when the project starts.',
    },
    {
      type: 'zm_function_def', message0: '🧩 make a block called %1',
      args0: [{ type: 'field_input', name: 'NAME', text: 'myBlock', spellcheck: false }],
      message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }],
      colour: colourOf('functions'), tooltip: 'Make your own block. Use “run my block” to use it.',
    },
    {
      type: 'zm_function_call', message0: '🧩 run my block %1',
      args0: [{ type: 'field_input', name: 'NAME', text: 'myBlock', spellcheck: false }],
      previousStatement: null, nextStatement: null, colour: colourOf('functions'),
      tooltip: 'Runs one of your own blocks and waits for it to finish.',
    },
    {
      type: 'zm_note', message0: '📝 note: %1', args0: [{ type: 'field_input', name: 'TEXT', text: 'write a note' }],
      previousStatement: null, nextStatement: null, colour: '#9aa3b2',
      tooltip: 'A note for people reading your project. It doesn’t do anything.',
    },
  ]);

  const nameValidator = (v: string) => safeName(v);
  for (const t of ['zm_function_def', 'zm_function_call']) {
    const orig = Blockly.Blocks[t].init;
    Blockly.Blocks[t].init = function (this: Blockly.Block) {
      orig.call(this);
      (this.getField('NAME') as Blockly.FieldTextInput).setValidator(nameValidator);
    };
  }

  // "Custom code" block: holds code Blocks can't show, verbatim. Edited only in Code view.
  Blockly.Blocks['zm_raw'] = {
    init(this: Blockly.Block & { zmCode?: string; zmCol?: number }) {
      this.zmCode = '';
      this.zmCol = 0;
      this.appendDummyInput('HEAD').appendField('⚙ custom code (edit in Code view)');
      this.appendDummyInput('PREVIEW').appendField(new Blockly.FieldLabel('', 'zm-raw-preview'), 'PREVIEW');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour('#6b7280');
      this.setTooltip('This code uses features that Blocks doesn’t support yet. It is kept exactly as written. Open Code view to change it.');
      this.setEditable(false);
    },
    saveExtraState(this: Blockly.Block & { zmCode?: string; zmCol?: number }) {
      return { code: this.zmCode ?? '', col: this.zmCol ?? 0 };
    },
    loadExtraState(this: Blockly.Block & { zmCode?: string; zmCol?: number }, state: { code?: string; col?: number }) {
      this.zmCode = state.code ?? '';
      this.zmCol = state.col ?? 0;
      const first = this.zmCode.split('\n')[0];
      const lines = this.zmCode.split('\n').length;
      const label = (first.length > 46 ? first.slice(0, 45) + '…' : first) + (lines > 1 ? `  (+${lines - 1} lines)` : '');
      this.getField('PREVIEW')?.setValue(label);
    },
  };
}

export function createTheme(dark: boolean): Blockly.Theme {
  return Blockly.Theme.defineTheme(dark ? 'zinomake-dark' : 'zinomake', {
    name: dark ? 'zinomake-dark' : 'zinomake',
    base: Blockly.Themes.Classic,
    blockStyles: {
      logic_blocks: { colourPrimary: colourOf('decisions'), colourSecondary: '#5aa9a9', colourTertiary: '#2b6b6b' },
      math_blocks: { colourPrimary: colourOf('values'), colourSecondary: '#6fb47c', colourTertiary: '#3b7346' },
      text_blocks: { colourPrimary: colourOf('values'), colourSecondary: '#6fb47c', colourTertiary: '#3b7346' },
      variable_blocks: { colourPrimary: colourOf('variables'), colourSecondary: '#e07a6a', colourTertiary: '#9c3e2f' },
      loop_blocks: { colourPrimary: colourOf('repeat'), colourSecondary: '#d98c55', colourTertiary: '#97521f' },
      procedure_blocks: { colourPrimary: colourOf('functions'), colourSecondary: '#9a8c7c', colourTertiary: '#5b4f42' },
    },
    categoryStyles: {},
    componentStyles: dark
      ? { workspaceBackgroundColour: '#1b1f2a', toolboxBackgroundColour: '#232836', toolboxForegroundColour: '#e8ebf2', flyoutBackgroundColour: '#2a3040', flyoutForegroundColour: '#e8ebf2', flyoutOpacity: 0.97, scrollbarColour: '#5b6478', insertionMarkerColour: '#fff', insertionMarkerOpacity: 0.3 }
      : { workspaceBackgroundColour: '#fbfaf7', toolboxBackgroundColour: '#ffffff', toolboxForegroundColour: '#1d2433', flyoutBackgroundColour: '#f1efe9', flyoutForegroundColour: '#1d2433', flyoutOpacity: 0.98, scrollbarColour: '#c5c9d3', insertionMarkerColour: '#000', insertionMarkerOpacity: 0.25 },
    fontStyle: { family: 'Nunito, "Segoe UI", system-ui, sans-serif', weight: '700', size: 12 },
    startHats: true,
  });
}

// ---------------- toolbox ----------------

type ToolboxItem = Record<string, unknown>;

const num = (n: number) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
const txt = (s: string) => ({ shadow: { type: 'text', fields: { TEXT: s } } });

function blockItem(spec: CallBlockSpec): ToolboxItem {
  const inputs: Record<string, unknown> = {};
  for (const a of spec.args) {
    if (a.kind !== 'value') continue;
    if (typeof a.default === 'number') inputs[a.name] = num(a.default);
    else if (typeof a.default === 'string') inputs[a.name] = txt(a.default);
  }
  return { kind: 'block', type: spec.type, ...(Object.keys(inputs).length ? { inputs } : {}) };
}

function callsIn(cat: CategoryId, type: ProjectType): ToolboxItem[] {
  const items: ToolboxItem[] = [];
  for (const b of CALL_BLOCKS) {
    if (b.category !== cat || (b.types && !b.types.includes(type))) continue;
    if (b.group) items.push({ kind: 'label', text: b.group });
    items.push(blockItem(b));
  }
  return items;
}

export function buildToolbox(type: ProjectType): Blockly.utils.toolbox.ToolboxDefinition {
  const cats: Record<CategoryId, ToolboxItem[]> = {
    start: [...callsIn('start', type), { kind: 'block', type: 'zm_note' }],
    objects: callsIn('objects', type),
    events: callsIn('events', type),
    motion: callsIn('motion', type),
    looks: callsIn('looks', type),
    sound: callsIn('sound', type),
    values: [
      { kind: 'block', type: 'math_number', fields: { NUM: 0 } },
      { kind: 'block', type: 'text', fields: { TEXT: 'hello' } },
      { kind: 'block', type: 'math_arithmetic', fields: { OP: 'ADD' }, inputs: { A: num(1), B: num(1) } },
      ...callsIn('values', type),
    ],
    decisions: [
      { kind: 'block', type: 'controls_if' },
      { kind: 'block', type: 'controls_if', extraState: { hasElse: true } },
      { kind: 'block', type: 'logic_compare', fields: { OP: 'EQ' }, inputs: { A: num(0), B: num(0) } },
      { kind: 'block', type: 'logic_compare', fields: { OP: 'GT' }, inputs: { A: num(0), B: num(0) } },
      { kind: 'block', type: 'logic_operation', fields: { OP: 'AND' } },
      { kind: 'block', type: 'logic_operation', fields: { OP: 'OR' } },
      { kind: 'block', type: 'logic_negate' },
      { kind: 'block', type: 'logic_boolean', fields: { BOOL: 'TRUE' } },
    ],
    repeat: [
      { kind: 'block', type: 'zm_repeat', inputs: { TIMES: num(10) } },
      { kind: 'block', type: 'zm_while' },
      ...callsIn('repeat', type),
    ],
    variables: [],
    functions: [],
    time: callsIn('time', type),
  };
  const contents = CATEGORIES.filter((c) => !c.types || c.types.includes(type)).map((c) => {
    if (c.id === 'variables') return { kind: 'category', name: c.name, colour: c.colour, custom: 'ZM_VARIABLES', toolboxitemid: c.id };
    if (c.id === 'functions') return { kind: 'category', name: c.name, colour: c.colour, custom: 'ZM_FUNCTIONS', toolboxitemid: c.id };
    return { kind: 'category', name: c.name, colour: c.colour, contents: cats[c.id], toolboxitemid: c.id };
  });
  return { kind: 'categoryToolbox', contents } as Blockly.utils.toolbox.ToolboxDefinition;
}

/** Dynamic categories for variables and "My blocks". */
export function registerDynamicCategories(ws: Blockly.WorkspaceSvg, createVariable: (ws: Blockly.WorkspaceSvg) => void): void {
  ws.registerButtonCallback('ZM_CREATE_VARIABLE', () => createVariable(ws));
  ws.registerToolboxCategoryCallback('ZM_VARIABLES', (w: Blockly.WorkspaceSvg) => {
    const items: ToolboxItem[] = [{ kind: 'button', text: '＋ Make something to remember', callbackkey: 'ZM_CREATE_VARIABLE' }];
    const vars = w.getVariableMap().getAllVariables().sort((a, b) => a.getName().localeCompare(b.getName()));
    if (vars.length) {
      const first = { name: vars[0].getName(), id: vars[0].getId() };
      items.push(
        { kind: 'block', type: 'zm_let', fields: { VAR: first }, inputs: { VALUE: num(0) } },
        { kind: 'block', type: 'variables_set', fields: { VAR: first }, inputs: { VALUE: num(0) } },
        { kind: 'block', type: 'math_change', fields: { VAR: first }, inputs: { DELTA: num(1) } },
        ...vars.map((v) => ({ kind: 'block', type: 'variables_get', fields: { VAR: { name: v.getName(), id: v.getId() } } })),
      );
    } else {
      items.push({ kind: 'label', text: 'Make one first, e.g. “score”.' });
    }
    return items as unknown as Blockly.utils.toolbox.FlyoutItemInfoArray;
  });
  ws.registerToolboxCategoryCallback('ZM_FUNCTIONS', (w: Blockly.WorkspaceSvg) => {
    const names = [...new Set(w.getBlocksByType('zm_function_def', false).map((b) => String(b.getFieldValue('NAME'))))].sort();
    const items: ToolboxItem[] = [{ kind: 'block', type: 'zm_function_def' }];
    if (names.length) items.push(...names.map((n) => ({ kind: 'block', type: 'zm_function_call', fields: { NAME: n } })));
    else items.push({ kind: 'label', text: 'Make a block, then run it from anywhere.' });
    return items as unknown as Blockly.utils.toolbox.FlyoutItemInfoArray;
  });
}

export { Blockly };
