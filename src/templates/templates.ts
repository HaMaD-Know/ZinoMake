/**
 * Starter templates. Each template's main.js is written in the supported block subset, so it
 * opens as fully editable blocks (verified by tests/unit/templates.test.ts).
 */
import type { ProjectType } from '../model/project';
import { starterDesign, type Design } from '../design/model';
import { DESIGN_TEMPLATES } from './designTemplates';

export interface Template {
  id: string;
  type: ProjectType;
  name: string;
  description: string;
  emoji: string;
  /** Two colours for the generated thumbnail. */
  colors: [string, string];
  html: string;
  css: string;
  js: string;
  /** "What can I do next?" ideas, in plain language. */
  nextIdeas: string[];
  /** Visual design (Design view), saved as design.json. */
  design?: Design;
}

const GAME_BASE_CSS = `body {
  margin: 0;
  font-family: system-ui, sans-serif;
  background: #f4f1ea;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
}
.hud {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 8px;
}
.stage {
  position: relative;
  width: 360px;
  height: 280px;
  border-radius: 14px;
  overflow: hidden;
  background: #bfe3ff;
  border: 3px solid #1d2433;
}
.sprite {
  position: absolute;
  border-radius: 10px;
}
.pad {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.pad button {
  font-size: 22px;
  width: 56px;
  height: 48px;
  border-radius: 12px;
  border: 2px solid #1d2433;
  background: white;
  touch-action: none;
}
`;

const PAD_LR = `<div class="pad">
    <button data-key="ArrowLeft" aria-label="Left">◀</button>
    <button data-key="ArrowRight" aria-label="Right">▶</button>
  </div>`;

const PAD_ALL = `<div class="pad">
    <button data-key="ArrowLeft" aria-label="Left">◀</button>
    <button data-key="ArrowUp" aria-label="Up">▲</button>
    <button data-key="ArrowDown" aria-label="Down">▼</button>
    <button data-key="ArrowRight" aria-label="Right">▶</button>
  </div>`;

const APP_BASE_CSS = `body {
  margin: 0;
  font-family: system-ui, sans-serif;
  background: #f4f6fb;
  color: #1d2433;
  display: flex;
  justify-content: center;
  padding: 24px 12px;
}
.card {
  background: white;
  border-radius: 18px;
  padding: 24px;
  width: 100%;
  max-width: 360px;
  box-shadow: 0 6px 24px rgba(29, 36, 51, 0.1);
  text-align: center;
}
button {
  font: inherit;
  font-weight: 700;
  padding: 10px 18px;
  border-radius: 12px;
  border: none;
  background: #4c6ef5;
  color: white;
  margin: 4px;
  cursor: pointer;
}
input {
  font: inherit;
  padding: 10px;
  border-radius: 10px;
  border: 2px solid #ccd3e0;
  width: 100%;
  box-sizing: border-box;
  margin: 6px 0;
}
`;

export const TEMPLATES: Template[] = [
  // ------------------------------------------------------------------ GAMES
  {
    id: 'game-click-target',
    type: 'game',
    name: 'Click the Target',
    description: 'A target jumps around. Click it to score points. Reach 10 to win!',
    emoji: '🎯',
    colors: ['#ff8a65', '#ffd54f'],
    nextIdeas: ['Make the target jump faster by changing “every 1.5 seconds”.', 'Change the winning score from 10 to 20.', 'Change the target colour when you click it.'],
    html: `<!doctype html>
<html>
<head><title>Click the Target</title></head>
<body>
  <div class="hud" id="score">Score: 0</div>
  <div class="stage" id="stage">
    <div class="sprite" id="target"></div>
  </div>
</body>
</html>
`,
    css: GAME_BASE_CSS + `#target {
  width: 56px;
  height: 56px;
  left: 150px;
  top: 110px;
  border-radius: 50%;
  background: radial-gradient(circle, white 18%, #e53935 19%, #e53935 45%, white 46%, white 62%, #e53935 63%);
}
`,
    js: `let score = 0;

onStart(async () => {
  say("Click the target as fast as you can!");
  setText("score", join("Score: ", score));
});

onClick("target", async () => {
  score += 1;
  setText("score", join("Score: ", score));
  playSound("coin");
  moveTo("target", random(0, 300), random(0, 220));
  if (score === 10) {
    say("You win! 🎉");
    playSound("win");
  }
});

every(1.5, async () => {
  moveTo("target", random(0, 300), random(0, 220));
});
`,
  },
  {
    id: 'game-collect-coins',
    type: 'game',
    name: 'Collect the Coins',
    description: 'Move your character with the arrow keys and grab every coin.',
    emoji: '🪙',
    colors: ['#81c784', '#fff176'],
    nextIdeas: ['Make the player faster by changing 4 to 6.', 'Show a message when you collect 5 coins.', 'Change the background colour each time you get a coin.'],
    html: `<!doctype html>
<html>
<head><title>Collect the Coins</title></head>
<body>
  <div class="hud" id="score">Coins: 0</div>
  <div class="stage" id="stage">
    <div class="sprite" id="player"></div>
    <div class="sprite" id="coin"></div>
  </div>
  ${PAD_ALL}
</body>
</html>
`,
    css: GAME_BASE_CSS + `#player {
  width: 40px;
  height: 40px;
  left: 20px;
  top: 120px;
  background: #5c6bc0;
}
#coin {
  width: 28px;
  height: 28px;
  left: 250px;
  top: 60px;
  border-radius: 50%;
  background: gold;
  border: 3px solid #c79100;
}
`,
    js: `let score = 0;

onStart(async () => {
  say("Use the arrow keys or buttons to collect coins!");
  forever(async () => {
    if (isKeyDown("ArrowLeft") && getX("player") > 0) {
      move("player", -4, 0);
    }
    if (isKeyDown("ArrowRight") && getX("player") < 320) {
      move("player", 4, 0);
    }
    if (isKeyDown("ArrowUp") && getY("player") > 0) {
      move("player", 0, -4);
    }
    if (isKeyDown("ArrowDown") && getY("player") < 240) {
      move("player", 0, 4);
    }
    if (touching("player", "coin")) {
      score += 1;
      setText("score", join("Coins: ", score));
      playSound("coin");
      moveTo("coin", random(0, 325), random(0, 245));
    }
  });
});
`,
  },
  {
    id: 'game-catch',
    type: 'game',
    name: 'Catch the Falling Apples',
    description: 'Slide the basket left and right to catch falling apples.',
    emoji: '🍎',
    colors: ['#ef5350', '#a5d6a7'],
    nextIdeas: ['Make the apple fall faster as your score goes up.', 'Play the “lose” sound when you miss.', 'Give the player 3 lives.'],
    html: `<!doctype html>
<html>
<head><title>Catch the Falling Apples</title></head>
<body>
  <div class="hud"><span id="score">Caught: 0</span> · <span id="missed">Missed: 0</span></div>
  <div class="stage" id="stage">
    <div class="sprite" id="apple"></div>
    <div class="sprite" id="basket"></div>
  </div>
  ${PAD_LR}
</body>
</html>
`,
    css: GAME_BASE_CSS + `#apple {
  width: 26px;
  height: 26px;
  left: 160px;
  top: 0px;
  border-radius: 50%;
  background: #e53935;
}
#basket {
  width: 80px;
  height: 24px;
  left: 140px;
  top: 244px;
  background: #8d6e63;
  border-radius: 4px 4px 14px 14px;
}
`,
    js: `let caught = 0;
let missed = 0;
let speed = 3;

onStart(async () => {
  say("Catch the apples!");
  forever(async () => {
    move("apple", 0, speed);
    if (isKeyDown("ArrowLeft") && getX("basket") > 0) {
      move("basket", -6, 0);
    }
    if (isKeyDown("ArrowRight") && getX("basket") < 280) {
      move("basket", 6, 0);
    }
    if (touching("apple", "basket")) {
      caught += 1;
      speed += 0.2;
      setText("score", join("Caught: ", caught));
      playSound("coin");
      moveTo("apple", random(0, 330), 0);
    }
    if (getY("apple") > 280) {
      missed += 1;
      setText("missed", join("Missed: ", missed));
      playSound("hit");
      moveTo("apple", random(0, 330), 0);
    }
  });
});
`,
  },
  {
    id: 'game-racing',
    type: 'game',
    name: 'Simple Racing Game',
    description: 'Steer your car and dodge the traffic coming towards you.',
    emoji: '🏎️',
    colors: ['#90a4ae', '#ffcc80'],
    nextIdeas: ['Add a second car to dodge.', 'Make the road colour change at 10 points.', 'Change your car colour.'],
    html: `<!doctype html>
<html>
<head><title>Racing</title></head>
<body>
  <div class="hud" id="score">Points: 0</div>
  <div class="stage road" id="stage">
    <div class="sprite" id="traffic"></div>
    <div class="sprite" id="car"></div>
  </div>
  ${PAD_LR}
</body>
</html>
`,
    css: GAME_BASE_CSS + `.road {
  background: repeating-linear-gradient(to right, #555 0 118px, #fff 118px 122px);
}
#car {
  width: 40px;
  height: 64px;
  left: 160px;
  top: 200px;
  background: #e53935;
}
#traffic {
  width: 40px;
  height: 64px;
  left: 40px;
  top: -70px;
  background: #fdd835;
}
`,
    js: `let points = 0;
let speed = 4;

onStart(async () => {
  say("Dodge the yellow cars!");
  forever(async () => {
    move("traffic", 0, speed);
    if (isKeyDown("ArrowLeft") && getX("car") > 0) {
      move("car", -5, 0);
    }
    if (isKeyDown("ArrowRight") && getX("car") < 320) {
      move("car", 5, 0);
    }
    if (getY("traffic") > 290) {
      points += 1;
      speed += 0.3;
      setText("score", join("Points: ", points));
      moveTo("traffic", random(0, 320), -70);
    }
    if (touching("car", "traffic")) {
      say("Crash! Try again.");
      playSound("lose");
      points = 0;
      speed = 4;
      setText("score", join("Points: ", points));
      moveTo("traffic", random(0, 320), -70);
    }
  });
});
`,
  },
  {
    id: 'game-platformer',
    type: 'game',
    name: 'Basic Platformer',
    description: 'Run, jump onto the platform and reach the star.',
    emoji: '⭐',
    colors: ['#7e57c2', '#4fc3f7'],
    nextIdeas: ['Make the jump higher by changing -11 to -13.', 'Move the star somewhere new after you reach it.', 'Add a score.'],
    html: `<!doctype html>
<html>
<head><title>Platformer</title></head>
<body>
  <div class="hud" id="status">Reach the star!</div>
  <div class="stage" id="stage">
    <div class="sprite" id="platform"></div>
    <div class="sprite" id="star"></div>
    <div class="sprite" id="player"></div>
    <div class="sprite" id="ground"></div>
  </div>
  <div class="pad">
    <button data-key="ArrowLeft" aria-label="Left">◀</button>
    <button data-key="Space" aria-label="Jump">⤒</button>
    <button data-key="ArrowRight" aria-label="Right">▶</button>
  </div>
</body>
</html>
`,
    css: GAME_BASE_CSS + `#ground {
  left: 0;
  top: 260px;
  width: 360px;
  height: 20px;
  border-radius: 0;
  background: #6d4c41;
}
#platform {
  left: 200px;
  top: 170px;
  width: 110px;
  height: 16px;
  background: #43a047;
}
#player {
  left: 20px;
  top: 220px;
  width: 30px;
  height: 40px;
  background: #ff7043;
}
#star {
  left: 240px;
  top: 120px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: gold;
}
`,
    js: `let speedY = 0;
let onGround = 0;

onStart(async () => {
  say("Arrow keys to run, Space to jump.");
  forever(async () => {
    speedY += 0.6;
    move("player", 0, speedY);
    onGround = 0;
    if (getY("player") > 220) {
      moveTo("player", getX("player"), 220);
      speedY = 0;
      onGround = 1;
    }
    if (touching("player", "platform") && speedY > 0) {
      moveTo("player", getX("player"), getY("platform") - 40);
      speedY = 0;
      onGround = 1;
    }
    if (isKeyDown("ArrowLeft") && getX("player") > 0) {
      move("player", -4, 0);
    }
    if (isKeyDown("ArrowRight") && getX("player") < 330) {
      move("player", 4, 0);
    }
    if (touching("player", "star")) {
      setText("status", "You reached the star! ⭐");
      playSound("win");
      hide("star");
    }
  });
});

onKey("Space", async () => {
  if (onGround === 1) {
    speedY = -11;
    playSound("jump");
  }
});
`,
  },
  {
    id: 'game-fly-gaps',
    type: 'game',
    name: 'Fly Through the Gaps',
    description: 'Tap, click or press space to fly up. Glide through the gaps and don’t touch the walls!',
    emoji: '🐤',
    colors: ['#74c0fc', '#b2f2bb'],
    nextIdeas: [
      'Use your own pictures: add a bird and a wall picture in Pictures & sounds, then change “add character bird” to “add picture bird” and “add box wall” to “add picture wall”.',
      'Make the walls faster by changing the wall speed from -3 to -4.',
      'Make the gap bigger or smaller by changing 130 in the second “make a copy of wall”.',
    ],
    html: `<!doctype html>
<html>
<head><title>Fly Through the Gaps</title></head>
<body>
</body>
</html>
`,
    css: GAME_BASE_CSS,
    js: `let score = 0;
let gap = 0;
let started = false;

onStart(async () => {
  setStage(360, 400, "skyblue");
  addCharacter("bird", "🐤", 60, 160, 40);
  addBox("wall", 400, 0, 50, 260, "seagreen");
  setStyle("wall", "border", "darkgreen");
  hide("wall");
  setSpeed("wall", -3, 0);
  addLabel("score", "Score: 0", 10, 10, 22);
  setStyle("score", "layer", 10);
  say("Tap or press space to start!");
  forever(async () => {
    setAngle("bird", getSpeedY("bird") * 4);
    if (touching("bird", "wall") || touchingEdge("bird")) {
      sendMessage("game over");
    }
  });
});

onKey("Space", async () => {
  await flap();
});

onClick("stage", async () => {
  await flap();
});

every(1.6, async () => {
  if (started) {
    gap = random(50, 220);
    makeCopy("wall", 360, gap - 260);
    makeCopy("wall", 360, gap + 130);
    score += 1;
    setText("score", join("Score: ", score));
  }
});

onMessage("game over", async () => {
  playSound("lose");
  say(join("Game over! Your score: ", score));
  stop();
});

async function flap() {
  if (!started) {
    started = true;
    say("");
    setGravity("bird", 0.35);
  }
  setSpeed("bird", 0, -6.5);
  playSound("jump");
}
`,
  },
  // ------------------------------------------------------------------ APPS
  {
    id: 'app-counter',
    type: 'app',
    name: 'Click Counter',
    description: 'Count up, count down and reset. The simplest useful app.',
    emoji: '🔢',
    colors: ['#4c6ef5', '#a5d8ff'],
    nextIdeas: ['Add a button that adds 10.', 'Change the number colour when it is above 10.', 'Show a message at 100.'],
    html: `<!doctype html>
<html>
<head><title>Click Counter</title></head>
<body>
  <div class="card">
    <h1>Counter</h1>
    <p class="big" id="count">0</p>
    <button id="minus">− 1</button>
    <button id="plus">+ 1</button>
    <button id="reset" class="ghost">Reset</button>
  </div>
</body>
</html>
`,
    css: APP_BASE_CSS + `.big {
  font-size: 64px;
  font-weight: 800;
  margin: 8px 0 16px;
}
.ghost {
  background: #e9ecf5;
  color: #1d2433;
}
`,
    js: `let count = 0;

onClick("plus", async () => {
  count += 1;
  setText("count", count);
});

onClick("minus", async () => {
  count += -1;
  setText("count", count);
});

onClick("reset", async () => {
  count = 0;
  setText("count", count);
  say("Back to zero!");
});
`,
  },
  {
    id: 'app-calculator',
    type: 'app',
    name: 'Simple Calculator',
    description: 'Type two numbers and add, subtract, multiply or divide them.',
    emoji: '🧮',
    colors: ['#20c997', '#c3fae8'],
    nextIdeas: ['Add a “power” button using the ^ maths block.', 'Show a friendly message when dividing by 0.', 'Change the result colour.'],
    html: `<!doctype html>
<html>
<head><title>Calculator</title></head>
<body>
  <div class="card">
    <h1>Calculator</h1>
    <label for="first">First number</label>
    <input id="first" type="number" value="6">
    <label for="second">Second number</label>
    <input id="second" type="number" value="3">
    <div>
      <button id="add">+</button>
      <button id="subtract">−</button>
      <button id="multiply">×</button>
      <button id="divide">÷</button>
    </div>
    <p class="result">Result: <strong id="result">?</strong></p>
  </div>
</body>
</html>
`,
    css: APP_BASE_CSS + `label {
  display: block;
  text-align: left;
  font-weight: 600;
  margin-top: 8px;
}
.result {
  font-size: 24px;
}
button {
  width: 56px;
  font-size: 22px;
}
`,
    js: `onClick("add", async () => {
  setText("result", getValue("first") + getValue("second"));
});

onClick("subtract", async () => {
  setText("result", getValue("first") - getValue("second"));
});

onClick("multiply", async () => {
  setText("result", getValue("first") * getValue("second"));
});

onClick("divide", async () => {
  if (getValue("second") === 0) {
    setText("result", "Can’t divide by 0");
  } else {
    setText("result", getValue("first") / getValue("second"));
  }
});
`,
  },
  {
    id: 'app-todo',
    type: 'app',
    name: 'To-Do List',
    description: 'Type a task and add it to your list. Clear the list when you are done.',
    emoji: '✅',
    colors: ['#f06595', '#ffdeeb'],
    nextIdeas: ['Show how many tasks are left.', 'Play a sound when you add a task.', 'Change the list colour.'],
    html: `<!doctype html>
<html>
<head><title>To-Do List</title></head>
<body>
  <div class="card">
    <h1>My To-Do List</h1>
    <input id="task" placeholder="Something to do…">
    <button id="add">Add task</button>
    <button id="clear" class="ghost">Clear all</button>
    <p id="count">0 tasks</p>
    <div id="list" class="list">Nothing yet!</div>
  </div>
</body>
</html>
`,
    css: APP_BASE_CSS + `.list {
  white-space: pre-line;
  text-align: left;
  background: #fff9db;
  border-radius: 12px;
  padding: 12px;
  min-height: 60px;
  line-height: 1.8;
}
.ghost {
  background: #e9ecf5;
  color: #1d2433;
}
`,
    js: `let tasks = "";
let total = 0;

onClick("add", async () => {
  if (getValue("task") === "") {
    say("Type a task first!");
  } else {
    total += 1;
    tasks = join(tasks, join("☐ ", join(getValue("task"), "\\n")));
    setText("list", tasks);
    setText("count", join(total, " tasks"));
    playSound("beep");
  }
});

onClick("clear", async () => {
  tasks = "";
  total = 0;
  setText("list", "Nothing yet!");
  setText("count", "0 tasks");
});
`,
  },
  {
    id: 'app-timer',
    type: 'app',
    name: 'Timer',
    description: 'A countdown timer with start and stop buttons.',
    emoji: '⏲️',
    colors: ['#fab005', '#fff3bf'],
    nextIdeas: ['Start from 60 seconds instead of 10.', 'Turn the number red for the last 3 seconds.', 'Add a +10 seconds button.'],
    html: `<!doctype html>
<html>
<head><title>Timer</title></head>
<body>
  <div class="card">
    <h1>Countdown</h1>
    <p class="big" id="time">10</p>
    <button id="start">Start</button>
    <button id="pause" class="ghost">Pause</button>
    <button id="reset" class="ghost">Reset</button>
  </div>
</body>
</html>
`,
    css: APP_BASE_CSS + `.big {
  font-size: 72px;
  font-weight: 800;
  margin: 8px 0 16px;
  font-variant-numeric: tabular-nums;
}
.ghost {
  background: #e9ecf5;
  color: #1d2433;
}
`,
    js: `let seconds = 10;
let ticking = 0;

onClick("start", async () => {
  ticking = 1;
});

onClick("pause", async () => {
  ticking = 0;
});

onClick("reset", async () => {
  ticking = 0;
  seconds = 10;
  setText("time", seconds);
});

every(1, async () => {
  if (ticking === 1 && seconds > 0) {
    seconds += -1;
    setText("time", seconds);
    if (seconds === 0) {
      say("Time is up! ⏰");
      playSound("win");
      ticking = 0;
    }
  }
});
`,
  },
  {
    id: 'app-quiz',
    type: 'app',
    name: 'Simple Quiz',
    description: 'A quick three-question quiz that keeps score.',
    emoji: '❓',
    colors: ['#845ef7', '#e5dbff'],
    nextIdeas: ['Add a fourth question.', 'Play the “lose” sound for wrong answers.', 'Show a different message for a perfect score.'],
    html: `<!doctype html>
<html>
<head><title>Quiz</title></head>
<body>
  <div class="card">
    <h1>Quick Quiz</h1>
    <p id="question" class="question">Press Play to begin!</p>
    <button id="answerA">A</button>
    <button id="answerB">B</button>
    <p id="score">Score: 0</p>
  </div>
</body>
</html>
`,
    css: APP_BASE_CSS + `.question {
  font-size: 20px;
  font-weight: 600;
  min-height: 56px;
}
`,
    js: `let question = 1;
let score = 0;

async function showQuestion() {
  if (question === 1) {
    setText("question", "What colour is the sky on a sunny day?");
    setText("answerA", "Blue");
    setText("answerB", "Green");
  } else if (question === 2) {
    setText("question", "How many legs does a spider have?");
    setText("answerA", "6");
    setText("answerB", "8");
  } else if (question === 3) {
    setText("question", "Which is bigger: 7 × 3 or 20?");
    setText("answerA", "7 × 3");
    setText("answerB", "20");
  } else {
    setText("question", join("Finished! You scored ", join(score, " out of 3.")));
    hide("answerA");
    hide("answerB");
    playSound("win");
  }
}

onStart(async () => {
  await showQuestion();
});

onClick("answerA", async () => {
  if (question === 1 || question === 3) {
    score += 1;
    say("Correct! ✅");
  } else {
    say("Not quite!");
  }
  setText("score", join("Score: ", score));
  question += 1;
  await showQuestion();
});

onClick("answerB", async () => {
  if (question === 2) {
    score += 1;
    say("Correct! ✅");
  } else {
    say("Not quite!");
  }
  setText("score", join("Score: ", score));
  question += 1;
  await showQuestion();
});
`,
  },
  // ------------------------------------------------------------------ WEBSITES
  {
    id: 'web-portfolio',
    type: 'website',
    name: 'Personal Portfolio',
    description: 'A clean page to show who you are and what you have made.',
    emoji: '🧑‍🎨',
    colors: ['#495057', '#dee2e6'],
    nextIdeas: ['Change the name and text in index.html.', 'Add another project card.', 'Make the “Say hi” button show your own message.'],
    html: `<!doctype html>
<html>
<head><title>My Portfolio</title></head>
<body>
  <header class="hero">
    <div class="avatar" aria-hidden="true">🙂</div>
    <h1>Hi, I’m Alex</h1>
    <p>I make games, apps and websites with ZinoMake.</p>
    <button id="hello">Say hi</button>
  </header>
  <main>
    <h2>My projects</h2>
    <div class="grid">
      <article class="project"><h3>🎯 Target game</h3><p>A fast clicking game.</p></article>
      <article class="project"><h3>✅ To-do app</h3><p>Keeps track of my homework.</p></article>
      <article class="project"><h3>🎨 Shapes</h3><p>A colourful animation.</p></article>
    </div>
  </main>
  <footer>Made with ZinoMake</footer>
</body>
</html>
`,
    css: `body {
  margin: 0;
  font-family: Georgia, serif;
  color: #212529;
  background: #fafafa;
}
.hero {
  text-align: center;
  padding: 48px 16px 32px;
  background: #212529;
  color: white;
}
.avatar {
  font-size: 56px;
}
button {
  font: 600 16px system-ui, sans-serif;
  padding: 10px 20px;
  border-radius: 999px;
  border: none;
  background: #ffd43b;
  color: #212529;
  cursor: pointer;
}
main {
  max-width: 760px;
  margin: 0 auto;
  padding: 24px 16px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}
.project {
  background: white;
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
}
footer {
  text-align: center;
  padding: 24px;
  color: #868e96;
}
`,
    js: `onClick("hello", async () => {
  say("Thanks for visiting my page! 👋");
});
`,
  },
  {
    id: 'web-landing',
    type: 'website',
    name: 'Landing Page',
    description: 'A bold page for a product or idea, with a sign-up button.',
    emoji: '🚀',
    colors: ['#1c7ed6', '#d0ebff'],
    nextIdeas: ['Change the headline.', 'Make the button change colour after it is clicked.', 'Add a third feature.'],
    html: `<!doctype html>
<html>
<head><title>Rocket Notes</title></head>
<body>
  <section class="hero">
    <h1>Rocket Notes 🚀</h1>
    <p>The fastest way to write down your ideas.</p>
    <button id="signup">Join the waitlist</button>
    <p id="thanks"></p>
  </section>
  <section class="features">
    <div><h3>⚡ Fast</h3><p>Opens in a blink.</p></div>
    <div><h3>🔒 Private</h3><p>Your notes stay yours.</p></div>
    <div><h3>🌈 Fun</h3><p>Colourful and friendly.</p></div>
  </section>
</body>
</html>
`,
    css: `body {
  margin: 0;
  font-family: system-ui, sans-serif;
  color: #102a43;
}
.hero {
  text-align: center;
  padding: 64px 16px;
  background: linear-gradient(135deg, #1c7ed6, #5f3dc4);
  color: white;
}
.hero h1 {
  font-size: clamp(32px, 6vw, 56px);
  margin: 0 0 8px;
}
button {
  font: 700 18px system-ui, sans-serif;
  padding: 14px 28px;
  border-radius: 14px;
  border: none;
  background: white;
  color: #1c7ed6;
  cursor: pointer;
}
.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
  max-width: 800px;
  margin: 0 auto;
  padding: 32px 16px;
  text-align: center;
}
`,
    js: `onClick("signup", async () => {
  setText("thanks", "You’re on the list! We’ll be in touch. 🎉");
  setText("signup", "Joined ✓");
  playSound("coin");
});
`,
  },
  {
    id: 'web-profile-card',
    type: 'website',
    name: 'Profile Card',
    description: 'A small card with a picture, a short bio and a like button.',
    emoji: '🪪',
    colors: ['#e64980', '#fcc2d7'],
    nextIdeas: ['Write your own bio.', 'Change the card colour when liked.', 'Count likes up to 10 and show a message.'],
    html: `<!doctype html>
<html>
<head><title>Profile Card</title></head>
<body>
  <div class="card" id="card">
    <div class="photo" aria-hidden="true">🦊</div>
    <h2>Sam the Fox</h2>
    <p>Loves drawing, music and making tiny games.</p>
    <button id="like">❤ Like</button>
    <p id="likes">0 likes</p>
  </div>
</body>
</html>
`,
    css: `body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  font-family: system-ui, sans-serif;
  background: #fff0f6;
}
.card {
  width: 260px;
  padding: 24px;
  border-radius: 22px;
  background: white;
  text-align: center;
  box-shadow: 0 10px 30px rgba(230, 73, 128, 0.2);
}
.photo {
  font-size: 64px;
  width: 100px;
  height: 100px;
  margin: 0 auto;
  border-radius: 50%;
  background: #ffdeeb;
  display: grid;
  place-items: center;
}
button {
  font: 700 16px system-ui, sans-serif;
  padding: 10px 20px;
  border-radius: 999px;
  border: 2px solid #e64980;
  background: white;
  color: #e64980;
  cursor: pointer;
}
`,
    js: `let likes = 0;

onClick("like", async () => {
  likes += 1;
  setText("likes", join(likes, " likes"));
  setColor("like", "#ffdeeb");
  playSound("beep");
});
`,
  },
  {
    id: 'web-event',
    type: 'website',
    name: 'Event Page',
    description: 'Announce a party or event, with a button to say you are coming.',
    emoji: '🎉',
    colors: ['#f76707', '#ffe8cc'],
    nextIdeas: ['Change the date and place.', 'Count how many people are coming.', 'Change the background when someone says yes.'],
    html: `<!doctype html>
<html>
<head><title>Summer Party</title></head>
<body>
  <main class="event" id="stage">
    <p class="tag">You’re invited!</p>
    <h1>Summer Party 🎉</h1>
    <p class="when">Saturday · 3 pm · The Park</p>
    <p>Games, music and ice cream for everyone.</p>
    <button id="yes">I’m coming!</button>
    <p id="answer"></p>
  </main>
</body>
</html>
`,
    css: `body {
  margin: 0;
  font-family: system-ui, sans-serif;
}
.event {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 48px 16px;
  text-align: center;
  background: #ffe8cc;
  color: #5c2b00;
}
.tag {
  text-transform: uppercase;
  letter-spacing: 3px;
  font-weight: 700;
}
h1 {
  font-size: clamp(34px, 7vw, 60px);
  margin: 0;
}
.when {
  font-size: 20px;
  font-weight: 700;
}
button {
  font: 700 18px system-ui, sans-serif;
  padding: 12px 24px;
  border-radius: 14px;
  border: none;
  background: #f76707;
  color: white;
  cursor: pointer;
}
`,
    js: `onClick("yes", async () => {
  setText("answer", "Great! See you there! 🥳");
  setBackground("#d3f9d8");
  playSound("win");
});
`,
  },
  // ------------------------------------------------------------------ ANIMATIONS
  {
    id: 'anim-bouncing-ball',
    type: 'animation',
    name: 'Bouncing Ball',
    description: 'A ball bounces around the box forever.',
    emoji: '⚽',
    colors: ['#12b886', '#c3fae8'],
    nextIdeas: ['Make the ball faster.', 'Change the ball colour every time it bounces.', 'Play a sound on each bounce.'],
    html: `<!doctype html>
<html>
<head><title>Bouncing Ball</title></head>
<body>
  <div class="stage" id="stage">
    <div class="sprite" id="ball"></div>
  </div>
</body>
</html>
`,
    css: GAME_BASE_CSS + `#ball {
  width: 40px;
  height: 40px;
  left: 30px;
  top: 30px;
  border-radius: 50%;
  background: #12b886;
}
`,
    js: `let speedX = 4;
let speedY = 3;

onStart(async () => {
  forever(async () => {
    move("ball", speedX, speedY);
    if (getX("ball") > 314 || getX("ball") < 0) {
      speedX = 0 - speedX;
    }
    if (getY("ball") > 234 || getY("ball") < 0) {
      speedY = 0 - speedY;
    }
  });
});
`,
  },
  {
    id: 'anim-moving-character',
    type: 'animation',
    name: 'Moving Character',
    description: 'A little character walks across the screen and waves.',
    emoji: '🚶',
    colors: ['#fd7e14', '#ffe066'],
    nextIdeas: ['Make the character walk back again.', 'Change the number of steps.', 'Show a different message.'],
    html: `<!doctype html>
<html>
<head><title>Moving Character</title></head>
<body>
  <div class="stage" id="stage">
    <div class="sprite" id="hero">🙂</div>
    <div class="sprite" id="floor"></div>
  </div>
</body>
</html>
`,
    css: GAME_BASE_CSS + `#hero {
  left: 10px;
  top: 190px;
  width: 50px;
  height: 50px;
  font-size: 42px;
  line-height: 50px;
  text-align: center;
}
#floor {
  left: 0;
  top: 240px;
  width: 360px;
  height: 40px;
  border-radius: 0;
  background: #69db7c;
}
`,
    js: `onStart(async () => {
  say("Off I go!");
  for (let i = 0; i < 25; i++) {
    move("hero", 10, 0);
    await wait(0.08);
  }
  say("Hello there! 👋");
  for (let i = 0; i < 3; i++) {
    move("hero", 0, -20);
    await wait(0.15);
    move("hero", 0, 20);
    await wait(0.15);
  }
  setBackground("#ffe066");
});
`,
  },
  {
    id: 'anim-shapes',
    type: 'animation',
    name: 'Animated Shapes',
    description: 'Colourful shapes that change colour and dance.',
    emoji: '🔷',
    colors: ['#7048e8', '#ffa8a8'],
    nextIdeas: ['Add your own colours.', 'Make the shapes move faster.', 'Add a fourth shape in index.html.'],
    html: `<!doctype html>
<html>
<head><title>Animated Shapes</title></head>
<body>
  <div class="stage" id="stage">
    <div class="sprite" id="square"></div>
    <div class="sprite" id="circle"></div>
    <div class="sprite" id="pill"></div>
  </div>
</body>
</html>
`,
    css: GAME_BASE_CSS + `.sprite {
  transition: background-color 0.4s, translate 0.4s;
}
#square {
  left: 40px;
  top: 100px;
  width: 70px;
  height: 70px;
  background: #7048e8;
}
#circle {
  left: 150px;
  top: 100px;
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: #f03e3e;
}
#pill {
  left: 260px;
  top: 110px;
  width: 70px;
  height: 40px;
  border-radius: 20px;
  background: #fab005;
}
`,
    js: `let up = 1;

every(0.5, async () => {
  if (up === 1) {
    setColor("square", "#20c997");
    setColor("circle", "#4dabf7");
    setColor("pill", "#ff8787");
    move("square", 0, -40);
    move("circle", 0, 40);
    move("pill", 0, -40);
    up = 0;
  } else {
    setColor("square", "#7048e8");
    setColor("circle", "#f03e3e");
    setColor("pill", "#fab005");
    move("square", 0, 40);
    move("circle", 0, -40);
    move("pill", 0, 40);
    up = 1;
  }
});
`,
  },
  {
    id: 'anim-story',
    type: 'animation',
    name: 'Interactive Story',
    description: 'A tiny story. Click “Next” to turn the page.',
    emoji: '📖',
    colors: ['#2b8a3e', '#d3f9d8'],
    nextIdeas: ['Write your own story pages.', 'Change the background for each page.', 'Add a “Back” button.'],
    html: `<!doctype html>
<html>
<head><title>Interactive Story</title></head>
<body>
  <div class="stage story" id="stage">
    <div class="sprite" id="character">🐢</div>
    <p id="words" class="words">Once upon a time, there was a tiny turtle.</p>
  </div>
  <div class="pad"><button id="next" class="next">Next ▶</button></div>
</body>
</html>
`,
    css: GAME_BASE_CSS + `.story {
  background: #d3f9d8;
  transition: background 0.5s;
}
#character {
  left: 150px;
  top: 40px;
  font-size: 64px;
}
.words {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 12px;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  text-align: center;
}
.pad .next {
  width: auto;
  padding: 0 20px;
  font-size: 18px;
}
`,
    js: `let page = 1;

onClick("next", async () => {
  page += 1;
  if (page === 2) {
    setText("words", "The turtle wanted to see the sea.");
    setBackground("#a5d8ff");
    move("character", 60, 0);
  } else if (page === 3) {
    setText("words", "It walked and walked until the stars came out.");
    setBackground("#364fc7");
    move("character", 60, 40);
  } else if (page === 4) {
    setText("words", "Finally, it reached the sea. The end! 🌊");
    setBackground("#74c0fc");
    playSound("win");
  } else {
    page = 1;
    setText("words", "Once upon a time, there was a tiny turtle.");
    setBackground("#d3f9d8");
    moveTo("character", 150, 40);
  }
});
`,
  },
  {
    id: 'anim-scene',
    type: 'animation',
    name: 'Day and Night Scene',
    description: 'The sun rises and sets, and the sky changes colour.',
    emoji: '🌅',
    colors: ['#ff922b', '#364fc7'],
    nextIdeas: ['Make the day last longer.', 'Add a moon that appears at night.', 'Change the sky colours.'],
    html: `<!doctype html>
<html>
<head><title>Day and Night</title></head>
<body>
  <div class="stage" id="stage">
    <div class="sprite" id="sun"></div>
    <div class="sprite" id="hill"></div>
  </div>
</body>
</html>
`,
    css: GAME_BASE_CSS + `#stage {
  transition: background 1s;
}
#sun {
  left: 150px;
  top: 220px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #ffd43b;
  box-shadow: 0 0 30px #ffd43b;
}
#hill {
  left: -40px;
  top: 200px;
  width: 440px;
  height: 160px;
  border-radius: 50% 50% 0 0;
  background: #40c057;
}
`,
    js: `onStart(async () => {
  forever(async () => {
    setBackground("#ffa94d");
    for (let i = 0; i < 40; i++) {
      move("sun", 0, -5);
      await wait(0.05);
    }
    setBackground("#74c0fc");
    await wait(1);
    setBackground("#ff8787");
    for (let i = 0; i < 40; i++) {
      move("sun", 0, 5);
      await wait(0.05);
    }
    setBackground("#1c2a5a");
    await wait(1.5);
  });
});
`,
  },
  ...DESIGN_TEMPLATES,
];

/**
 * Blank starter per type: an empty page plus a small visual design (Design view), so a new
 * project can be built by placing things and choosing what they do — no code needed.
 */
export function blankTemplate(type: ProjectType): Template {
  const stage = type === 'game' || type === 'animation';
  return {
    id: `blank-${type}`,
    type,
    name: 'Blank project',
    description: 'Start from an empty project.',
    emoji: '✨',
    colors: ['#adb5bd', '#f1f3f5'],
    nextIdeas: stage
      ? ['In Design, tap ＋ under Pictures to add your own pictures, then drag them onto the stage.', 'Select a picture and press “Make it do more with blocks”, or use “when right arrow key is pressed” in Blocks.', 'Use “give … gravity” and “set speed of …” to make things fall and jump.']
      : ['In Design, open “Ready-made sections” and add a Hero, Features or Contact form.', 'Drag things from the left onto the canvas, and drag them around to change the order.', 'Click an empty part of the canvas to change the theme: main colour, font and corners.'],
    design: starterDesign(type),
    html: `<!doctype html>
<html>
<head><title>My project</title></head>
<body>
</body>
</html>
`,
    css: stage ? GAME_BASE_CSS : `body {
  margin: 0;
}
`,
    js: ``,
  };
}

export function templatesFor(type: ProjectType): Template[] {
  return TEMPLATES.filter((t) => t.type === type);
}

export function findTemplate(id: string): Template | undefined {
  if (id.startsWith('blank-')) {
    const type = id.slice(6) as ProjectType;
    if (['game', 'app', 'website', 'animation'].includes(type)) return blankTemplate(type);
  }
  return TEMPLATES.find((t) => t.id === id);
}
