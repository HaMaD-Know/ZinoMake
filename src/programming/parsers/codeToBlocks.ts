/**
 * JavaScript → block workspace (Blockly JSON), for the documented supported subset.
 *
 * Uses the real `acorn` JavaScript parser. Anything outside the subset is NOT
 * dropped or simplified: the whole statement becomes a "custom code" block
 * (`zm_raw`) that stores the original source text verbatim and regenerates it
 * unchanged. Line comments between statements become "note" blocks.
 *
 * See docs/SUPPORTED_CODE.md for the exact subset.
 */
import * as acorn from 'acorn';
import type { BlockState, WorkspaceState } from '../../model/project';
import {
  CALL_BLOCK_BY_FN,
  RESERVED_GLOBALS,
  RUNTIME_NAMES,
  type ArgSpec,
  type CallBlockSpec,
} from '../blocks/catalog';
import { ARITH_OPS, COMPARE_OPS } from '../generators/blocksToCode';

// Minimal structural typing of the ESTree nodes we touch.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = acorn.Node & Record<string, any>;

export interface UnsupportedPart {
  line: number;
  reason: string;
  snippet: string;
}

export type ConvertResult =
  | { ok: true; workspace: WorkspaceState; unsupported: UnsupportedPart[] }
  | { ok: false; error: { message: string; line: number; column: number } };

class Unsupported extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

const ARITH_BY_OP = new Map(Object.entries(ARITH_OPS).map(([k, [op]]) => [op, k]));
const COMPARE_BY_OP = new Map(Object.entries(COMPARE_OPS).map(([k, op]) => [op, k]));

interface Comment {
  type: 'Line' | 'Block';
  value: string;
  start: number;
  end: number;
  used: boolean;
}

export function parseJs(code: string): acorn.Program {
  const base: acorn.Options = {
    ecmaVersion: 'latest',
    allowAwaitOutsideFunction: true,
    allowReturnOutsideFunction: true,
    locations: true,
  };
  try {
    return acorn.parse(code, { ...base, sourceType: 'module' });
  } catch (moduleErr) {
    try {
      return acorn.parse(code, { ...base, sourceType: 'script' });
    } catch {
      throw moduleErr;
    }
  }
}

/** Friendly description of an acorn syntax error. */
export function describeSyntaxError(err: unknown): { message: string; line: number; column: number } {
  const e = err as { message?: string; loc?: { line: number; column: number } };
  const raw = (e.message ?? 'Unknown problem').replace(/\s*\(\d+:\d+\)$/, '');
  let hint = raw;
  if (/Unexpected token/.test(raw)) hint = 'Something here is out of place — check for a missing ( ) { } or comma.';
  else if (/Unterminated string/.test(raw)) hint = 'A piece of text is missing its closing quote mark.';
  else if (/Unexpected end of input|Unterminated/.test(raw)) hint = 'The code stops too early — a closing } or ) may be missing.';
  else if (/Identifier .* has already been declared/.test(raw)) hint = 'The same name is created twice. Use a different name.';
  return { message: hint, line: e.loc?.line ?? 1, column: e.loc?.column ?? 0 };
}

class Converter {
  private idCounter = 0;
  private vars = new Map<string, string>(); // name -> id
  unsupported: UnsupportedPart[] = [];

  constructor(private code: string, private comments: Comment[]) {}

  id(prefix: string): string {
    this.idCounter += 1;
    return `${prefix}${this.idCounter}`;
  }

  variable(name: string): { id: string } {
    let id = this.vars.get(name);
    if (!id) {
      id = `var_${name}`;
      this.vars.set(name, id);
    }
    return { id };
  }

  variables(): { name: string; id: string; type: string }[] {
    return [...this.vars.entries()].map(([name, id]) => ({ name, id, type: '' }));
  }

  private commentsIn(start: number, end: number): Comment[] {
    return this.comments.filter((c) => !c.used && c.start >= start && c.end <= end);
  }

  private assertNoComments(start: number, end: number): void {
    if (this.commentsIn(start, end).length) throw new Unsupported('has a comment in the middle of it');
  }

  private lineOf(pos: number): number {
    let line = 1;
    for (let i = 0; i < pos && i < this.code.length; i++) if (this.code.charCodeAt(i) === 10) line++;
    return line;
  }

  private columnOf(pos: number): number {
    const nl = this.code.lastIndexOf('\n', pos - 1);
    return pos - (nl + 1);
  }

  raw(node: { start: number; end: number }, reason: string): BlockState {
    const snippet = this.code.slice(node.start, node.end);
    for (const c of this.commentsIn(node.start, node.end)) c.used = true;
    this.unsupported.push({ line: this.lineOf(node.start), reason, snippet: snippet.split('\n')[0].slice(0, 80) });
    return { type: 'zm_raw', id: this.id('raw'), extraState: { code: snippet, col: this.columnOf(node.start) } };
  }

  note(c: Comment): BlockState {
    c.used = true;
    if (c.type === 'Block') {
      return { type: 'zm_raw', id: this.id('raw'), extraState: { code: this.code.slice(c.start, c.end), col: this.columnOf(c.start) } };
    }
    const text = c.value.startsWith(' ') ? c.value.slice(1) : c.value;
    return { type: 'zm_note', id: this.id('note'), fields: { TEXT: text } };
  }

  // ---------------- values ----------------

  value(n: Node): BlockState {
    switch (n.type) {
      case 'Literal': {
        if (typeof n.value === 'number' && Number.isFinite(n.value)) return { type: 'math_number', id: this.id('n'), fields: { NUM: n.value } };
        if (typeof n.value === 'string') return { type: 'text', id: this.id('t'), fields: { TEXT: n.value } };
        if (typeof n.value === 'boolean') return { type: 'logic_boolean', id: this.id('b'), fields: { BOOL: n.value ? 'TRUE' : 'FALSE' } };
        throw new Unsupported('uses a kind of value Blocks can’t show yet');
      }
      case 'Identifier':
        return { type: 'variables_get', id: this.id('v'), fields: { VAR: this.variable(this.userName(n.name)) } };
      case 'UnaryExpression': {
        if (n.operator === '-' && n.argument.type === 'Literal' && typeof n.argument.value === 'number') {
          return { type: 'math_number', id: this.id('n'), fields: { NUM: -n.argument.value } };
        }
        if (n.operator === '!') return { type: 'logic_negate', id: this.id('not'), inputs: { BOOL: { block: this.value(n.argument) } } };
        throw new Unsupported(`uses the "${n.operator}" operator`);
      }
      case 'BinaryExpression': {
        const arith = ARITH_BY_OP.get(n.operator);
        if (arith) {
          return { type: 'math_arithmetic', id: this.id('m'), fields: { OP: arith }, inputs: { A: { block: this.value(n.left) }, B: { block: this.value(n.right) } } };
        }
        const cmp = COMPARE_BY_OP.get(n.operator);
        if (cmp) {
          return { type: 'logic_compare', id: this.id('c'), fields: { OP: cmp }, inputs: { A: { block: this.value(n.left) }, B: { block: this.value(n.right) } } };
        }
        throw new Unsupported(`uses the "${n.operator}" operator`);
      }
      case 'LogicalExpression': {
        if (n.operator !== '&&' && n.operator !== '||') throw new Unsupported(`uses the "${n.operator}" operator`);
        return {
          type: 'logic_operation', id: this.id('l'), fields: { OP: n.operator === '&&' ? 'AND' : 'OR' },
          inputs: { A: { block: this.value(n.left) }, B: { block: this.value(n.right) } },
        };
      }
      case 'CallExpression': {
        const spec = this.callSpec(n);
        if (!spec || spec.shape !== 'value') throw new Unsupported('calls something that isn’t a value block');
        return this.callBlock(spec, n.arguments);
      }
      default:
        throw new Unsupported(`uses ${describeNode(n.type)}`);
    }
  }

  private userName(name: string): string {
    if (RESERVED_GLOBALS.has(name) || RUNTIME_NAMES.has(name)) throw new Unsupported(`uses the built-in name "${name}"`);
    return name;
  }

  private callSpec(n: Node): CallBlockSpec | undefined {
    if (n.callee?.type !== 'Identifier' || n.optional) return undefined;
    return CALL_BLOCK_BY_FN.get(n.callee.name);
  }

  private literalArg(arg: Node | undefined, spec: ArgSpec): string | number {
    if (!arg) throw new Unsupported('is missing something it needs');
    if (spec.kind === 'number') {
      if (arg.type === 'Literal' && typeof arg.value === 'number') return arg.value;
      if (arg.type === 'UnaryExpression' && arg.operator === '-' && arg.argument.type === 'Literal' && typeof arg.argument.value === 'number') return -arg.argument.value;
      throw new Unsupported('needs a plain number here');
    }
    if (arg.type !== 'Literal' || typeof arg.value !== 'string') throw new Unsupported('needs plain text in quotes here');
    if (spec.kind === 'dropdown' && !spec.options.some(([, v]) => v === arg.value)) {
      throw new Unsupported(`uses "${arg.value}", which isn’t one of the choices`);
    }
    return arg.value;
  }

  callBlock(spec: CallBlockSpec, args: Node[], bodyFn?: Node): BlockState {
    const expected = spec.args.length;
    if (args.length !== expected) throw new Unsupported(`gives ${spec.fn} the wrong number of things`);
    const block: BlockState = { type: spec.type, id: this.id(spec.fn) };
    spec.args.forEach((a, i) => {
      if (a.kind === 'value') {
        block.inputs = { ...block.inputs, [a.name]: { block: this.value(args[i]) } };
      } else {
        block.fields = { ...block.fields, [a.name]: this.literalArg(args[i], a) };
      }
    });
    if (bodyFn) {
      const first = this.statementList(bodyFn.body.body, bodyFn.body.start + 1, bodyFn.body.end - 1, false);
      if (first) block.inputs = { ...block.inputs, DO: { block: first } };
    }
    return block;
  }

  private bodyFunction(n: Node | undefined): Node | undefined {
    if (!n) return undefined;
    if (n.type === 'ArrowFunctionExpression' && n.params.length === 0 && n.body.type === 'BlockStatement' && !n.generator) return n;
    return undefined;
  }

  // ---------------- statements ----------------

  /** Convert one statement; throws Unsupported if it can't be represented. */
  private statement(n: Node, topLevel: boolean): BlockState | null {
    switch (n.type) {
      case 'EmptyStatement':
        return null;
      case 'ExpressionStatement':
        return this.expressionStatement(n, topLevel);
      case 'VariableDeclaration': {
        if (!topLevel) throw new Unsupported('creates a variable inside a block (only top-level variables are supported)');
        if (n.kind !== 'let' || n.declarations.length !== 1) throw new Unsupported(`uses "${n.kind}" or several variables at once`);
        const d = n.declarations[0];
        if (d.id.type !== 'Identifier') throw new Unsupported('unpacks values into variables');
        const name = this.userName(d.id.name);
        this.assertNoComments(n.start, n.end);
        if (this.vars.has(name)) throw new Unsupported(`creates "${name}" a second time`);
        const isZero = !d.init || (d.init.type === 'Literal' && d.init.value === 0 && d.init.raw === '0');
        if (isZero) {
          this.variable(name);
          return null;
        }
        const init = this.value(d.init);
        return { type: 'zm_let', id: this.id('let'), fields: { VAR: this.variable(name) }, inputs: { VALUE: { block: init } } };
      }
      case 'IfStatement':
        return this.ifStatement(n);
      case 'ForStatement':
        return this.repeat(n);
      case 'WhileStatement': {
        if (n.body.type !== 'BlockStatement') throw new Unsupported('has a loop without { }');
        this.assertNoComments(n.start, n.body.start);
        const cond = this.value(n.test);
        const first = this.statementList(n.body.body, n.body.start + 1, n.body.end - 1, false);
        return { type: 'zm_while', id: this.id('while'), inputs: { COND: { block: cond }, ...(first ? { DO: { block: first } } : {}) } };
      }
      case 'FunctionDeclaration': {
        if (!topLevel) throw new Unsupported('creates a function inside another block');
        if (n.params.length || n.generator) throw new Unsupported('creates a function with inputs (not supported in Blocks yet)');
        const name = n.id.name as string;
        if (RUNTIME_NAMES.has(name) || RESERVED_GLOBALS.has(name)) throw new Unsupported(`reuses the built-in name "${name}"`);
        if (this.vars.has(name)) throw new Unsupported(`uses the name "${name}" for both a variable and a function`);
        this.assertNoComments(n.start, n.body.start);
        const first = this.statementList(n.body.body, n.body.start + 1, n.body.end - 1, false);
        return { type: 'zm_function_def', id: this.id('fn'), fields: { NAME: name }, ...(first ? { inputs: { DO: { block: first } } } : {}) };
      }
      default:
        throw new Unsupported(`uses ${describeNode(n.type)}`);
    }
  }

  private expressionStatement(n: Node, topLevel: boolean): BlockState {
    const e = n.expression as Node;
    if (e.type === 'AssignmentExpression' && e.left.type === 'Identifier') {
      this.assertNoComments(n.start, n.end);
      const name = this.userName(e.left.name);
      if (e.operator === '=') return { type: 'variables_set', id: this.id('set'), fields: { VAR: this.variable(name) }, inputs: { VALUE: { block: this.value(e.right) } } };
      if (e.operator === '+=') return { type: 'math_change', id: this.id('chg'), fields: { VAR: this.variable(name) }, inputs: { DELTA: { block: this.value(e.right) } } };
      throw new Unsupported(`uses the "${e.operator}" operator`);
    }
    if (e.type === 'AwaitExpression' && e.argument.type === 'CallExpression') {
      const call = e.argument as Node;
      this.assertNoComments(n.start, n.end);
      const spec = this.callSpec(call);
      if (spec?.await) return this.callBlock(spec, call.arguments);
      if (!spec && call.callee.type === 'Identifier' && call.arguments.length === 0 && !RESERVED_GLOBALS.has(call.callee.name) && !RUNTIME_NAMES.has(call.callee.name)) {
        return { type: 'zm_function_call', id: this.id('call'), fields: { NAME: call.callee.name } };
      }
      throw new Unsupported('waits for something Blocks doesn’t know');
    }
    if (e.type === 'CallExpression') {
      const spec = this.callSpec(e);
      if (!spec) throw new Unsupported('calls a function Blocks doesn’t know');
      if (spec.await) throw new Unsupported(`needs "await" before ${spec.fn}(…)`);
      if (spec.shape === 'event' || spec.shape === 'statement-body') {
        if (spec.shape === 'event' && !topLevel) throw new Unsupported('puts a “when…” block inside another block');
        const fnNode = this.bodyFunction(e.arguments[e.arguments.length - 1]);
        if (!fnNode) throw new Unsupported(`needs "async () => { … }" as the last part of ${spec.fn}(…)`);
        this.assertNoComments(n.start, fnNode.body.start);
        this.assertNoComments(fnNode.body.end, n.end);
        return this.callBlock(spec, e.arguments.slice(0, -1), fnNode);
      }
      if (spec.shape === 'value') throw new Unsupported('uses a value block on its own');
      this.assertNoComments(n.start, n.end);
      return this.callBlock(spec, e.arguments);
    }
    throw new Unsupported(`uses ${describeNode(e.type)}`);
  }

  private ifStatement(n: Node): BlockState {
    const block: BlockState = { type: 'controls_if', id: this.id('if'), inputs: {} };
    let cur: Node = n;
    let i = 0;
    let hasElse = false;
    for (;;) {
      if (cur.consequent.type !== 'BlockStatement') throw new Unsupported('has an “if” without { }');
      this.assertNoComments(cur.start, cur.consequent.start);
      block.inputs![`IF${i}`] = { block: this.value(cur.test) };
      const first = this.statementList(cur.consequent.body, cur.consequent.start + 1, cur.consequent.end - 1, false);
      if (first) block.inputs![`DO${i}`] = { block: first };
      const alt = cur.alternate as Node | null;
      if (!alt) break;
      this.assertNoComments(cur.consequent.end, alt.start);
      if (alt.type === 'IfStatement') {
        cur = alt;
        i += 1;
        continue;
      }
      if (alt.type !== 'BlockStatement') throw new Unsupported('has an “else” without { }');
      const elseFirst = this.statementList(alt.body, alt.start + 1, alt.end - 1, false);
      if (elseFirst) block.inputs!.ELSE = { block: elseFirst };
      hasElse = true;
      break;
    }
    if (i > 0 || hasElse) block.extraState = { elseIfCount: i, hasElse };
    return block;
  }

  private repeat(n: Node): BlockState {
    // Supported shape: for (let i = 0; i < TIMES; i++) { ... }
    const init = n.init as Node | null;
    if (
      !init || init.type !== 'VariableDeclaration' || init.kind !== 'let' || init.declarations.length !== 1 ||
      init.declarations[0].id.type !== 'Identifier' || init.declarations[0].init?.type !== 'Literal' || init.declarations[0].init.value !== 0
    ) throw new Unsupported('uses a “for” loop that isn’t a simple repeat');
    const loopVar = init.declarations[0].id.name as string;
    const test = n.test as Node | null;
    if (!test || test.type !== 'BinaryExpression' || test.operator !== '<' || test.left.type !== 'Identifier' || test.left.name !== loopVar) {
      throw new Unsupported('uses a “for” loop that isn’t a simple repeat');
    }
    const upd = n.update as Node | null;
    if (!upd || upd.type !== 'UpdateExpression' || upd.operator !== '++' || upd.argument.type !== 'Identifier' || upd.argument.name !== loopVar) {
      throw new Unsupported('uses a “for” loop that isn’t a simple repeat');
    }
    if (n.body.type !== 'BlockStatement') throw new Unsupported('has a loop without { }');
    if (mentionsIdentifier(n.body, loopVar) || mentionsIdentifier(test.right, loopVar)) {
      throw new Unsupported(`uses the loop counter "${loopVar}" (not supported in Blocks yet)`);
    }
    this.assertNoComments(n.start, n.body.start);
    const times = this.value(test.right);
    const first = this.statementList(n.body.body, n.body.start + 1, n.body.end - 1, false);
    return { type: 'zm_repeat', id: this.id('rep'), inputs: { TIMES: { block: times }, ...(first ? { DO: { block: first } } : {}) } };
  }

  /** Convert a list of statements into a connected chain (with notes for comments). */
  statementList(nodes: Node[], rangeStart: number, rangeEnd: number, topLevel: boolean): BlockState | undefined {
    const chain: BlockState[] = [];
    let cursor = rangeStart;
    const flushComments = (until: number) => {
      for (const c of this.commentsIn(cursor, until)) chain.push(this.note(c));
    };
    for (const node of nodes) {
      flushComments(node.start);
      chain.push(...this.convertOne(node, topLevel));
      cursor = node.end;
    }
    flushComments(rangeEnd);
    return link(chain);
  }

  convertOne(node: Node, topLevel: boolean): BlockState[] {
    const snapshot = this.vars.size;
    const savedVars = new Map(this.vars);
    const savedUnsupported = this.unsupported.length;
    try {
      const b = this.statement(node, topLevel);
      return b ? [b] : [];
    } catch (err) {
      if (!(err instanceof Unsupported)) throw err;
      // Roll back side effects of the failed attempt and keep the code verbatim.
      if (this.vars.size !== snapshot) this.vars = savedVars;
      this.unsupported.length = savedUnsupported;
      for (const c of this.comments) if (c.start >= node.start && c.end <= node.end) c.used = false;
      return [this.raw(node, err.reason)];
    }
  }
}

function link(chain: BlockState[]): BlockState | undefined {
  for (let i = chain.length - 2; i >= 0; i--) chain[i].next = { block: chain[i + 1] };
  return chain[0];
}

function mentionsIdentifier(node: unknown, name: string): boolean {
  if (!node || typeof node !== 'object') return false;
  const n = node as Record<string, unknown>;
  if (n.type === 'Identifier' && n.name === name) return true;
  for (const key of Object.keys(n)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    const v = n[key];
    if (Array.isArray(v)) {
      if (v.some((c) => mentionsIdentifier(c, name))) return true;
    } else if (v && typeof v === 'object' && mentionsIdentifier(v, name)) return true;
  }
  return false;
}

function describeNode(type: string): string {
  const names: Record<string, string> = {
    ImportDeclaration: 'an import', ExportNamedDeclaration: 'an export', ExportDefaultDeclaration: 'an export',
    ClassDeclaration: 'a class', TryStatement: 'try/catch', SwitchStatement: 'a switch',
    DoWhileStatement: 'a do…while loop', ForOfStatement: 'a for…of loop', ForInStatement: 'a for…in loop',
    ReturnStatement: 'return', BreakStatement: 'break', ContinueStatement: 'continue', ThrowStatement: 'throw',
    MemberExpression: 'a dot (like obj.thing)', ArrowFunctionExpression: 'an arrow function',
    FunctionExpression: 'a function expression', TemplateLiteral: 'a `template` string', ArrayExpression: 'a list [ ]',
    ObjectExpression: 'an object { }', ConditionalExpression: 'the ? : operator', NewExpression: '“new”',
    UpdateExpression: '++ or --', AssignmentExpression: 'an assignment Blocks doesn’t support', AwaitExpression: 'await',
    BlockStatement: 'a bare { } block', LabeledStatement: 'a label', SequenceExpression: 'commas between expressions',
  };
  return names[type] ?? `code Blocks doesn’t know (${type})`;
}

/** Estimate a block stack's height so converted stacks don't overlap before Blockly lays them out. */
function estimateHeight(b: BlockState | undefined): number {
  let h = 0;
  let cur = b;
  while (cur) {
    h += 34;
    for (const [name, inp] of Object.entries(cur.inputs ?? {})) {
      if (inp.block && (/^DO\d*$/.test(name) || name === 'ELSE')) h += estimateHeight(inp.block) + 18;
    }
    cur = cur.next?.block;
  }
  return h;
}

const HAT_TYPES = new Set(['zm_function_def', 'zm_let']);
function isHat(b: BlockState): boolean {
  if (HAT_TYPES.has(b.type)) return true;
  for (const spec of CALL_BLOCK_BY_FN.values()) if (spec.type === b.type && spec.shape === 'event') return true;
  return false;
}

export function codeToBlocks(code: string): ConvertResult {
  const comments: Comment[] = [];
  let program: acorn.Program;
  try {
    program = parseJs(code);
    acorn.parse(code, {
      ecmaVersion: 'latest', sourceType: program.sourceType, allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true,
      onComment: (block, text, start, end) => comments.push({ type: block ? 'Block' : 'Line', value: text, start, end, used: false }),
    });
  } catch (err) {
    return { ok: false, error: describeSyntaxError(err) };
  }
  const conv = new Converter(code, comments);
  const tops: BlockState[] = [];
  let loose: BlockState[] = [];
  const flushLoose = () => {
    const first = link(loose);
    if (first) tops.push(first);
    loose = [];
  };
  let cursor = 0;
  const body = program.body as Node[];
  for (const node of body) {
    for (const c of comments.filter((c) => !c.used && c.start >= cursor && c.end <= node.start)) loose.push(conv.note(c));
    for (const b of conv.convertOne(node, true)) {
      if (isHat(b)) {
        flushLoose();
        tops.push(b);
      } else {
        loose.push(b);
      }
    }
    cursor = node.end;
  }
  for (const c of comments.filter((c) => !c.used && c.start >= cursor)) loose.push(conv.note(c));
  flushLoose();

  let y = 20;
  for (const b of tops) {
    b.x = 20;
    b.y = y;
    y += estimateHeight(b) + 60;
  }
  return {
    ok: true,
    workspace: { blocks: { languageVersion: 0, blocks: tops }, variables: conv.variables(), zmLayout: 'estimated' },
    unsupported: conv.unsupported,
  };
}
