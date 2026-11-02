import { describe, expect, it } from 'vitest';
import { codeToBlocks } from '../../src/programming/parsers/codeToBlocks';
import { blocksToCode } from '../../src/programming/generators/blocksToCode';

function roundTrip(code: string) {
  const r = codeToBlocks(code);
  if (!r.ok) throw new Error('syntax: ' + r.error.message);
  return { code: blocksToCode(r.workspace), result: r };
}

const CANONICAL = `let score = 0;

onStart(async () => {
  say("Hello!");
  score = 5;
  score += 1;
  for (let i = 0; i < 10; i++) {
    move("cat", 10, -2);
    await wait(0.5);
  }
  if (score > 3 && !(score === 7)) {
    setText("score", join("Score: ", score));
  } else if (score < 0 || false) {
    hide("cat");
  } else {
    show("cat");
  }
  while (getX("cat") < 300) {
    move("cat", (1 + 2) * 3, 2 ** 3);
  }
  forever(async () => {
    if (isKeyDown("ArrowLeft")) {
      move("cat", -5, 0);
    }
  });
  await celebrate();
});

onClick("button", async () => {
  playSound("coin");
  setColor("cat", "gold");
  // a friendly note
  moveTo("cat", random(1, 100), 0);
});

onKey("Space", async () => {
  setBackground("skyblue");
});

every(2, async () => {
  if (touching("cat", "coin")) {
    say(getValue("name"));
  }
});

async function celebrate() {
  playSound("win");
}
`;

describe('code <-> blocks round trip', () => {
  it('converts canonical supported code with no custom-code blocks and regenerates it exactly', () => {
    const { code, result } = roundTrip(CANONICAL);
    expect(result.ok && result.unsupported).toEqual([]);
    expect(code).toBe(CANONICAL);
  });

  it('is idempotent after the first conversion', () => {
    const src = `let a=1\nonStart(()=>{ say('hi'); a = a+1*2 })\n`;
    const once = roundTrip(src).code;
    expect(roundTrip(once).code).toBe(once);
    expect(once).toContain('a = a + 1 * 2;');
    expect(once).toContain('say("hi");');
  });

  it('preserves unsupported code verbatim as custom-code blocks', () => {
    const src = `import confetti from "confetti";\nconst colors = ['red', 'blue'];\n\nonStart(async () => {\n  say("go");\n  colors.forEach((c) => {\n    setColor("box", c);\n  });\n});\n`;
    const { code, result } = roundTrip(src);
    expect(result.ok && result.unsupported.length).toBe(3);
    expect(code).toContain('import confetti from "confetti";');
    expect(code).toContain("const colors = ['red', 'blue'];");
    expect(code).toContain('  colors.forEach((c) => {\n    setColor("box", c);\n  });');
    expect(roundTrip(code).code).toBe(code);
  });

  it('keeps comments', () => {
    const src = `// top comment\nonStart(async () => {\n  // inside\n  say("x"); // trailing\n  /* block\n     comment */\n});\n`;
    const { code } = roundTrip(src);
    expect(code).toContain('// top comment');
    expect(code).toContain('  // inside');
    expect(code).toContain('// trailing');
    expect(code).toContain('/* block\n     comment */');
  });

  it('does not touch code with a syntax error', () => {
    const r = codeToBlocks('onStart(async () => { say("hi" });');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.line).toBe(1);
  });

  it('treats a comment inside an expression as unsupported rather than losing it', () => {
    const { code } = roundTrip(`onStart(async () => {\n  say(/* hi */ "x");\n});\n`);
    expect(code).toContain('say(/* hi */ "x");');
  });

  it('rejects for-loops that use the counter', () => {
    const src = `onStart(async () => {\n  for (let i = 0; i < 3; i++) {\n    say(i);\n  }\n});\n`;
    const { code, result } = roundTrip(src);
    expect(result.ok && result.unsupported.length).toBe(1);
    expect(code).toBe(src);
  });
});
