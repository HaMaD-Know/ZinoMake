# Supported code (the Blocks ↔ Code subset)

`main.js` is the file that is linked to the block editor. ZinoMake parses it with the
[acorn](https://github.com/acornjs/acorn) JavaScript parser (not regular expressions) and turns
the statements below into blocks. **Everything else is preserved exactly as written** and shown
as a grey **custom code** block. Nothing you type is ever simplified or thrown away.

The two-way guarantee applies only to this subset. ZinoMake does not claim that arbitrary
JavaScript can be turned into blocks.

## Statements that become blocks

| Code | Block |
| --- | --- |
| `onStart(async () => { … });` | ▶ when Play is pressed |
| `onClick("id", async () => { … });` | 👆 when *id* is clicked |
| `onKey("ArrowLeft", async () => { … });` | ⌨ when *key* is pressed (keys: ArrowLeft/Right/Up/Down, Space, Enter, w, a, s, d) |
| `every(2, async () => { … });` | ⏱ every *n* seconds |
| `forever(async () => { … });` | 🔁 forever (runs ~60×/second in the background) |
| `let score = 0;` (top level) | a variable (“Remember” category) |
| `let lives = 3;` (top level, non-zero start) | 🧠 remember *lives* starting at 3 |
| `score = expr;` | set *score* to … |
| `score += expr;` | change *score* by … |
| `if (…) { … } else if (…) { … } else { … }` | if / else if / otherwise |
| `for (let i = 0; i < N; i++) { … }` (counter not used inside) | 🔁 repeat N times |
| `while (cond) { … }` | 🔁 repeat while … |
| `async function name() { … }` (top level, no parameters) | 🧩 make a block called *name* |
| `await name();` | 🧩 run my block *name* |
| `await wait(seconds);` | ⏳ wait |
| `say(x)`, `setText("id", x)`, `setColor("id", c)`, `setBackground(c)`, `setImage("id", "file.png")`, `show("id")`, `hide("id")`, `move("id", dx, dy)`, `moveTo("id", x, y)`, `playSound("coin")`, `playAudio("file.mp3")` | the matching action block |
| `setStage(w, h, colour)`, `addCharacter("name", "🐱", x, y, size)`, `addBox("name", x, y, w, h, colour)`, `addCircle("name", x, y, size, colour)`, `addPicture("name", "file.png", x, y, size)`, `addLabel("name", text, x, y, size)`, `addTitle("name", text)`, `addParagraph("name", text)`, `addButton("name", text)`, `addInput("name", hint)`, `addArrowButtons()`, `remove("name")` | the matching **Make things** block (creates things without editing `index.html`) |
| `setSize("id", w, h)`, `setStyle("id", "fill", value)` (styles: fill, textColor, textSize, roundness, border, seeThrough, layer, font), `turn("id", degrees)`, `stop()` | the matching action block |
| `// a comment` between statements | 📝 note |

## Values that become blocks

Numbers (`3`, `-2.5`), strings (`"hi"`), `true`/`false`, variable names, `+ - * / **`,
`=== !== < <= > >=`, `&& ||`, `!`, and the value functions `random(a, b)`, `join(a, b)`,
`getX("id")`, `getY("id")`, `touching("a", "b")`, `isKeyDown("Space")`, `getValue("id")`,
`mouseX()`, `mouseY()`, `roundNumber(n)`.

Dropdown arguments (keys, sounds) must be one of the listed choices; names of things (ids)
must be plain text in quotes.

## Kept as custom code (examples)

`import`/`export`, `const`/`var`, several variables in one `let`, variables or functions declared
inside blocks, functions with parameters, arrow functions outside events, `obj.prop`, arrays,
objects, template strings, `%`, `==`, `++`, `? :`, `try`, `switch`, `for…of`, `return`, calls to
functions that aren't ZinoMake blocks, a comment *inside* an expression, and so on.

When the code has a **syntax error**, the blocks keep showing the last working version and are
locked until the code is fixed (or you choose “Use the blocks instead”).

## Formatting

Blocks always generate the same code, formatted the same way (2-space indentation, double
quotes). Code you type in Code view keeps your formatting until you next change the blocks, at
which point `main.js` is regenerated from the blocks; custom-code blocks are emitted verbatim.
