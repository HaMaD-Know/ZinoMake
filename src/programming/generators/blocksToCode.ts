/**
 * Block workspace (Blockly JSON) → readable JavaScript.
 *
 * Pure function over the serialised workspace so it can run in tests, in a
 * worker, or in the browser without a live Blockly instance.
 * Output is deterministic: same workspace → same code.
 */
import type { BlockState, WorkspaceState } from '../../model/project';
import { CALL_BLOCK_BY_TYPE, type ArgSpec } from '../blocks/catalog';

const INDENT = '  ';

// Operator precedence (higher binds tighter).
const PREC = {
  ATOM: 20,
  CALL: 19,
  UNARY: 15,
  POW: 14,
  MUL: 13,
  ADD: 12,
  REL: 10,
  EQ: 9,
  AND: 5,
  OR: 4,
  NONE: 0,
} as const;

type Expr = [code: string, prec: number];

export const ARITH_OPS: Record<string, [string, number]> = {
  ADD: ['+', PREC.ADD],
  MINUS: ['-', PREC.ADD],
  MULTIPLY: ['*', PREC.MUL],
  DIVIDE: ['/', PREC.MUL],
  POWER: ['**', PREC.POW],
};
export const COMPARE_OPS: Record<string, string> = {
  EQ: '===', NEQ: '!==', LT: '<', LTE: '<=', GT: '>', GTE: '>=',
};

interface GenContext {
  varNames: Map<string, string>; // variable id -> name
}

function isDisabled(b: BlockState): boolean {
  if (b.enabled === false) return true;
  return Array.isArray(b.disabledReasons) && b.disabledReasons.length > 0;
}

function inputBlock(b: BlockState, name: string): BlockState | undefined {
  const inp = b.inputs?.[name];
  const blk = inp?.block ?? inp?.shadow;
  return blk && !isDisabled(blk) ? blk : undefined;
}

function field(b: BlockState, name: string): unknown {
  return b.fields?.[name];
}

function fieldString(b: BlockState, name: string, fallback = ''): string {
  const v = field(b, name);
  return v === undefined || v === null ? fallback : String(v);
}

function varName(b: BlockState, ctx: GenContext): string {
  const v = field(b, 'VAR') as { id?: string; name?: string } | string | undefined;
  if (typeof v === 'string') return ctx.varNames.get(v) ?? v;
  if (v?.name) return v.name;
  if (v?.id) return ctx.varNames.get(v.id) ?? 'item';
  return 'item';
}

function literal(v: number | string | boolean): Expr {
  if (typeof v === 'number') return v < 0 ? [String(v), PREC.UNARY] : [String(v), PREC.ATOM];
  if (typeof v === 'boolean') return [v ? 'true' : 'false', PREC.ATOM];
  return [JSON.stringify(v), PREC.ATOM];
}

function emptyDefault(check: ArgSpec & { kind: 'value' }): number | string | boolean {
  if (check.check === 'Number') return 0;
  if (check.check === 'Boolean') return false;
  return '';
}

function value(b: BlockState | undefined, ctx: GenContext, fallback: number | string | boolean): Expr {
  if (!b) return literal(fallback);
  switch (b.type) {
    case 'math_number': {
      const n = Number(field(b, 'NUM'));
      return literal(Number.isFinite(n) ? n : 0);
    }
    case 'text':
      return literal(fieldString(b, 'TEXT'));
    case 'logic_boolean':
      return literal(fieldString(b, 'BOOL') === 'TRUE');
    case 'variables_get':
      return [varName(b, ctx), PREC.ATOM];
    case 'math_arithmetic': {
      const [op, prec] = ARITH_OPS[fieldString(b, 'OP', 'ADD')] ?? ARITH_OPS.ADD;
      return binary(op, prec, value(inputBlock(b, 'A'), ctx, 0), value(inputBlock(b, 'B'), ctx, 0), op === '**');
    }
    case 'logic_compare': {
      const op = COMPARE_OPS[fieldString(b, 'OP', 'EQ')] ?? '===';
      const prec = op === '===' || op === '!==' ? PREC.EQ : PREC.REL;
      return binary(op, prec, value(inputBlock(b, 'A'), ctx, 0), value(inputBlock(b, 'B'), ctx, 0), false);
    }
    case 'logic_operation': {
      const isAnd = fieldString(b, 'OP', 'AND') === 'AND';
      return binary(isAnd ? '&&' : '||', isAnd ? PREC.AND : PREC.OR,
        value(inputBlock(b, 'A'), ctx, false), value(inputBlock(b, 'B'), ctx, false), false);
    }
    case 'logic_negate': {
      const [c, p] = value(inputBlock(b, 'BOOL'), ctx, false);
      return ['!' + (p < PREC.UNARY ? `(${c})` : c), PREC.UNARY];
    }
    default: {
      const spec = CALL_BLOCK_BY_TYPE.get(b.type);
      if (spec && spec.shape === 'value') return [callCode(spec.fn, spec.args, b, ctx), PREC.CALL];
      // Unknown value block: keep the program valid.
      return literal(fallback);
    }
  }
}

function binary(op: string, prec: number, left: Expr, right: Expr, rightAssoc: boolean): Expr {
  const wrapLeft = rightAssoc ? left[1] <= Math.max(prec, PREC.UNARY) : left[1] < prec;
  const wrapRight = rightAssoc ? right[1] < prec : right[1] <= prec;
  const l = wrapLeft ? `(${left[0]})` : left[0];
  const r = wrapRight ? `(${right[0]})` : right[0];
  return [`${l} ${op} ${r}`, prec];
}

function argCode(arg: ArgSpec, b: BlockState, ctx: GenContext): string {
  switch (arg.kind) {
    case 'text':
      return JSON.stringify(fieldString(b, arg.name, arg.default));
    case 'dropdown':
      return JSON.stringify(fieldString(b, arg.name, arg.options[0][1]));
    case 'number': {
      const n = Number(field(b, arg.name));
      return String(Number.isFinite(n) ? n : arg.default);
    }
    case 'value':
      return value(inputBlock(b, arg.name), ctx, emptyDefault(arg))[0];
  }
}

function callCode(fn: string, args: ArgSpec[], b: BlockState, ctx: GenContext): string {
  return `${fn}(${args.map((a) => argCode(a, b, ctx)).join(', ')})`;
}

/** Generate a statement chain starting at `first`. */
function statements(first: BlockState | undefined, ctx: GenContext, indent: string): string[] {
  const out: string[] = [];
  let b = first;
  while (b) {
    if (!isDisabled(b)) out.push(statement(b, ctx, indent));
    b = b.next?.block;
  }
  return out;
}

function body(b: BlockState, name: string, ctx: GenContext, indent: string): string {
  const lines = statements(b.inputs?.[name]?.block, ctx, indent + INDENT);
  return lines.length ? `{\n${lines.join('\n')}\n${indent}}` : '{\n' + indent + '}';
}

function rawCode(b: BlockState, indent: string): string {
  const st = (b.extraState ?? {}) as { code?: string; col?: number };
  const code = st.code ?? '';
  const col = st.col ?? 0;
  const lines = code.split('\n');
  if (code.includes('`')) {
    // Template literals may span lines; never re-indent their inner lines.
    return indent + code;
  }
  return lines
    .map((line, i) => {
      if (i === 0) return indent + line;
      const strip = Math.min(col, line.length - line.trimStart().length);
      const rest = line.slice(strip);
      return rest.length ? indent + rest : '';
    })
    .join('\n');
}

function statement(b: BlockState, ctx: GenContext, indent: string): string {
  switch (b.type) {
    case 'variables_set':
      return `${indent}${varName(b, ctx)} = ${value(inputBlock(b, 'VALUE'), ctx, 0)[0]};`;
    case 'math_change':
      return `${indent}${varName(b, ctx)} += ${value(inputBlock(b, 'DELTA'), ctx, 1)[0]};`;
    case 'controls_if': {
      const st = (b.extraState ?? {}) as { elseIfCount?: number; hasElse?: boolean };
      const n = st.elseIfCount ?? 0;
      let code = `${indent}if (${value(inputBlock(b, 'IF0'), ctx, false)[0]}) ${body(b, 'DO0', ctx, indent)}`;
      for (let i = 1; i <= n; i++) {
        code += ` else if (${value(inputBlock(b, 'IF' + i), ctx, false)[0]}) ${body(b, 'DO' + i, ctx, indent)}`;
      }
      if (st.hasElse) code += ` else ${body(b, 'ELSE', ctx, indent)}`;
      return code;
    }
    case 'zm_repeat': {
      const times = value(inputBlock(b, 'TIMES'), ctx, 10);
      const t = times[1] <= PREC.REL ? `(${times[0]})` : times[0];
      return `${indent}for (let i = 0; i < ${t}; i++) ${body(b, 'DO', ctx, indent)}`;
    }
    case 'zm_while':
      return `${indent}while (${value(inputBlock(b, 'COND'), ctx, false)[0]}) ${body(b, 'DO', ctx, indent)}`;
    case 'zm_function_call':
      return `${indent}await ${safeName(fieldString(b, 'NAME', 'myBlock'))}();`;
    case 'zm_function_def':
      return `${indent}async function ${safeName(fieldString(b, 'NAME', 'myBlock'))}() ${body(b, 'DO', ctx, indent)}`;
    case 'zm_note': {
      const text = fieldString(b, 'TEXT').replace(/\n/g, ' ');
      return `${indent}//${text ? ' ' + text : ''}`;
    }
    case 'zm_raw':
      return rawCode(b, indent);
    default: {
      const spec = CALL_BLOCK_BY_TYPE.get(b.type);
      if (!spec) return `${indent}// (unknown block "${b.type}" skipped)`;
      if (spec.shape === 'value') {
        // A value block used on its own: evaluate it (harmless) so the code stays faithful.
        return `${indent}${callCode(spec.fn, spec.args, b, ctx)};`;
      }
      if (spec.shape === 'event' || spec.shape === 'statement-body') {
        const args = spec.args.map((a) => argCode(a, b, ctx));
        args.push(`async () => ${body(b, 'DO', ctx, indent)}`);
        return `${indent}${spec.fn}(${args.join(', ')});`;
      }
      return `${indent}${spec.await ? 'await ' : ''}${callCode(spec.fn, spec.args, b, ctx)};`;
    }
  }
}

/** Turn any user-entered name into a valid JS identifier (deterministically). */
export function safeName(name: string): string {
  let s = name.trim().replace(/[^A-Za-z0-9_$]+(.)?/g, (_m, c: string | undefined) => (c ? c.toUpperCase() : ''));
  if (!s) s = 'myBlock';
  if (/^[0-9]/.test(s)) s = '_' + s;
  return s;
}

export function blocksToCode(ws: WorkspaceState | null | undefined): string {
  const ctx: GenContext = { varNames: new Map() };
  const vars = ws?.variables ?? [];
  for (const v of vars) ctx.varNames.set(v.id, v.name);
  const top = [...(ws?.blocks?.blocks ?? [])].filter((b) => !isDisabled(b));
  // Blockly orders top blocks by position; mirror that (top-to-bottom, then left-to-right).
  top.sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));

  const chunks: string[] = [];
  // Starting values come from "remember … starting at …" (zm_let) blocks; other variables start at 0.
  const initial = new Map<string, string>();
  for (const b of top) {
    if (b.type !== 'zm_let') continue;
    const name = varName(b, ctx);
    if (!initial.has(name)) initial.set(name, value(inputBlock(b, 'VALUE'), ctx, 0)[0]);
  }
  const declared = [...new Set(vars.map((v) => v.name))];
  if (declared.length) chunks.push(declared.map((n) => `let ${n} = ${initial.get(n) ?? '0'};`).join('\n'));

  for (const b of top) {
    const spec = CALL_BLOCK_BY_TYPE.get(b.type);
    if (spec?.shape === 'value' || b.type === 'zm_let') continue; // loose value blocks do nothing
    if (['math_number', 'text', 'logic_boolean', 'variables_get', 'math_arithmetic', 'logic_compare', 'logic_operation', 'logic_negate'].includes(b.type)) continue;
    const lines = statements(b, ctx, '');
    if (lines.length) chunks.push(lines.join('\n'));
  }
  return chunks.length ? chunks.join('\n\n') + '\n' : '';
}
