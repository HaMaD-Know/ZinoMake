/**
 * Rule-based "describe it" helper. Turns a short plain-English request into supported ZinoMake
 * code (and therefore blocks). Deterministic, offline, no AI service. It understands a small,
 * documented set of phrases; anything else gets a friendly "I can't do that yet" with examples.
 *
 * Designed so a future optional AI assistant could return the same kind of `HelperResult`.
 */
export interface HelperResult {
  ok: true;
  code: string;
  summary: string[];
}
export interface HelperFailure {
  ok: false;
  message: string;
}

export const HELPER_EXAMPLES = [
  'Make the player move when I press the arrow keys',
  'When I click the button, say "Hello!"',
  'Make the player blue',
  'Every 2 seconds play the coin sound',
  'When I press space, hide the coin',
  'Change the background to pink',
];

const COLORS = ['red', 'orange', 'yellow', 'gold', 'green', 'blue', 'purple', 'pink', 'black', 'white', 'gray', 'grey', 'brown', 'skyblue', 'tomato', 'teal', 'navy'];
const SOUNDS = ['beep', 'coin', 'jump', 'hit', 'win', 'lose'];
const KEYS: Record<string, string> = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', space: 'Space', enter: 'Enter' };

function q(s: string): string {
  return JSON.stringify(s);
}

/** Pick the element the sentence talks about: a known id mentioned in the text, else the first known sprite. */
function pickTarget(text: string, ids: string[], useFirstAsFallback = true): string | null {
  const words = text.toLowerCase();
  const byMention = [...ids].sort((a, b) => b.length - a.length).find((id) => new RegExp(`\\b${id.toLowerCase().replace(/[^a-z0-9]/g, '.?')}\\b`).test(words));
  return byMention ?? (useFirstAsFallback ? ids[0] ?? null : null);
}

function actions(text: string, ids: string[], target: string | null, keyDir?: string): { lines: string[]; summary: string[] } {
  const t = text.toLowerCase();
  const lines: string[] = [];
  const summary: string[] = [];
  const say = /\b(?:say|show (?:a )?message|write)\b\s*["“']([^"”']+)["”']/i.exec(text);
  if (say) {
    lines.push(`say(${q(say[1])});`);
    summary.push(`show the message “${say[1]}”`);
  }
  const color = COLORS.find((c) => new RegExp(`\\b${c}\\b`).test(t));
  const bg = /\bbackground\b/.test(t);
  if (color && bg) {
    lines.push(`setBackground(${q(color === 'grey' ? 'gray' : color)});`);
    summary.push(`change the background to ${color}`);
  } else if (color && target && /\b(make|turn|colou?r|change|paint)\b/.test(t)) {
    lines.push(`setColor(${q(target)}, ${q(color === 'grey' ? 'gray' : color)});`);
    summary.push(`make ${target} ${color}`);
  }
  const sound = SOUNDS.find((s) => new RegExp(`\\b${s}\\b`).test(t));
  if (sound && /\b(sound|play|noise)\b/.test(t)) {
    lines.push(`playSound(${q(sound)});`);
    summary.push(`play the ${sound} sound`);
  } else if (/\bplay (?:a )?sound\b/.test(t)) {
    lines.push('playSound("beep");');
    summary.push('play a beep');
  }
  if (target && /\bhide\b/.test(t)) {
    lines.push(`hide(${q(target)});`);
    summary.push(`hide ${target}`);
  }
  if (target && /\b(show|appear)\b/.test(t) && !say && !/\bshow (?:a )?message\b/.test(t)) {
    lines.push(`show(${q(target)});`);
    summary.push(`show ${target}`);
  }
  const dirMatch = /\bmove\b.*?\b(left|right|up|down)\b/.exec(t);
  const dir = dirMatch?.[1] ?? keyDir;
  if (target && /\b(move|go|walk|drive|run|jump)\b/.test(t) && dir) {
    const amount = Number(/\b(\d{1,3})\b/.exec(t)?.[1] ?? 10);
    const [dx, dy] = dir === 'left' ? [-amount, 0] : dir === 'right' ? [amount, 0] : dir === 'up' ? [0, -amount] : [0, amount];
    lines.push(`move(${q(target)}, ${dx}, ${dy});`);
    summary.push(`move ${target} ${dir}`);
  }
  void ids;
  return { lines, summary };
}

function wrap(header: string, lines: string[]): string {
  return `${header}async () => {\n${lines.map((l) => '  ' + l).join('\n')}\n});\n`;
}

export function interpret(request: string, elementIds: string[]): HelperResult | HelperFailure {
  const text = request.trim();
  if (!text) return { ok: false, message: 'Type what you would like to happen.' };
  const t = text.toLowerCase();
  const sprites = elementIds.filter((id) => !/^(score|stage|status|hud)$/.test(id));
  const target = pickTarget(t, sprites);

  // "move with the arrow keys" → four key handlers.
  if (/\barrow keys\b/.test(t) && /\b(move|go|drive|walk|control|steer)\b/.test(t)) {
    if (!target) return { ok: false, message: 'I couldn’t find anything on the page to move. Give something an id in index.html first.' };
    const code = (['left', 'right', 'up', 'down'] as const)
      .map((d) => wrap(`onKey(${q(KEYS[d])}, `, actions(`move ${d}`, sprites, target).lines))
      .join('\n');
    const extra = actions(t.replace(/\bmove\b|arrow keys/g, ''), sprites, target);
    const start = extra.lines.length ? '\n' + wrap('onStart(', extra.lines) : '';
    return { ok: true, code: code + start, summary: [`move ${target} with the arrow keys`, ...extra.summary] };
  }

  const every = /\bevery (\d+(?:\.\d+)?) ?(?:seconds?|secs?|s)\b/.exec(t);
  const key = /\bwhen (?:i |you )?(?:press|hit|tap) (?:the )?(left|right|up|down|space|enter)\b/.exec(t);
  const click = /\bwhen (?:i |you |someone )?(?:click|tap|press)(?:s)? (?:on )?(?:the )?([\w-]+)/.exec(t);

  let header = 'onStart(';
  let keyDir: string | undefined;
  let what = 'when Play is pressed';
  if (every) {
    header = `every(${Number(every[1])}, `;
    what = `every ${every[1]} seconds`;
  } else if (key) {
    header = `onKey(${q(KEYS[key[1]])}, `;
    keyDir = ['left', 'right', 'up', 'down'].includes(key[1]) ? key[1] : undefined;
    what = `when ${key[1]} is pressed`;
  } else if (click) {
    const clicked = elementIds.find((id) => id.toLowerCase() === click[1]) ?? pickTarget(click[1], elementIds, false);
    if (!clicked || !elementIds.includes(clicked)) {
      return { ok: false, message: `I couldn’t find “${click[1]}” on the page. Things you can click: ${elementIds.join(', ') || 'none yet'}.` };
    }
    header = `onClick(${q(clicked)}, `;
    what = `when ${clicked} is clicked`;
  }
  const rest = click && !every && !key ? t.slice(click.index + click[0].length) : t;
  const act = actions(click ? text.slice(click.index + click[0].length) || rest : text, sprites, target, keyDir);
  if (!act.lines.length) {
    return { ok: false, message: 'Sorry, I don’t understand that yet. I can move things, change colours, show messages, play sounds and hide or show things.' };
  }
  return { ok: true, code: wrap(header, act.lines), summary: [what + ':', ...act.summary] };
}

export function elementIdsFromHtml(html: string): string[] {
  return [...new Set([...html.matchAll(/\bid\s*=\s*["']([\w-]+)["']/g)].map((m) => m[1]))];
}

/** Names of things made by “Make things” blocks, e.g. addCharacter("player", …). */
export function madeNamesFromCode(code: string): string[] {
  return [...new Set([...code.matchAll(/\badd(?:Character|Box|Circle|Picture|Label|Title|Paragraph|Button|Input)\(\s*"([^"]+)"/g)].map((m) => m[1]))];
}
