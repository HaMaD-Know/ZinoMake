/**
 * End-to-end browser test of the ZinoMake "definition of done" flow.
 * Usage: start the app (npm run dev, or npm run build && npm run preview), then
 *   BASE_URL=http://localhost:5173/ npm run test:e2e
 * Requires Playwright with Chromium available.
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.env.BASE_URL || 'http://localhost:5173/';
mkdirSync('tests/e2e/screenshots', { recursive: true });

let passed = 0;
let failed = 0;
async function step(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    await page.screenshot({ path: `tests/e2e/screenshots/FAIL-${name.slice(0, 30).replace(/[^\w]+/g, '_')}.png` }).catch(() => {});
    console.log(`  ✗ ${name}\n      ${String(e && e.message ? e.message : e).split('\n')[0]}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => m.type() === 'error' && pageErrors.push(m.text()));

async function getCode() {
  return page.evaluate(() => document.querySelector('.cm-content')?.innerText ?? '');
}
async function setCode(text) {
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(text);
  await page.waitForTimeout(700);
}
async function waitSaved() {
  await page.getByTestId('save-state').filter({ hasText: 'Saved' }).waitFor({ timeout: 8000 });
}
const frame = () => page.frameLocator('[data-testid=preview-frame]');

console.log('ZinoMake end-to-end test');

await step('home page shows branding, Create Something and examples', async () => {
  await page.goto(base);
  await page.getByRole('heading', { name: 'Create anything.' }).waitFor();
  assert(await page.getByTestId('create-something').isVisible(), 'no Create Something');
  assert((await page.locator('#examples-title ~ ul li, section[aria-labelledby=examples-title] li').count()) >= 4, 'examples missing');
});

await step('keyboard: Tab reaches Create Something', async () => {
  await page.goto(base);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'create-something')) return;
  }
  throw new Error('Create Something not reachable by keyboard');
});

await step('create flow: choose Game → template → Start Creating opens the editor', async () => {
  await page.getByTestId('create-something').click();
  await page.getByRole('heading', { name: 'What do you want to make?' }).waitFor();
  await page.getByTestId('type-game').click();
  await page.getByTestId('template-game-click-target').click();
  await page.locator('#pname').fill('E2E Target');
  await page.getByTestId('start-creating').click();
  await page.waitForSelector('.blocklySvg', { timeout: 15000 });
  assert(/#\/p\//.test(page.url()), 'not in editor');
  assert((await page.locator('.blocklyDraggable').count()) > 10, 'template blocks not loaded');
  const skip = page.getByRole('button', { name: 'Skip tour' });
  if (await skip.isVisible()) await skip.click();
});

await step('blocks: add a block with “Add block” and it updates the generated code', async () => {
  await page.getByTestId('add-block').click();
  await page.getByRole('tab', { name: 'Looks' }).click();
  await page.getByRole('button', { name: 'set background to …' }).click();
  await page.waitForTimeout(600);
  await page.getByTestId('view-code').click();
  await page.locator('.cm-content').waitFor();
  const code = await getCode();
  assert(code.includes('setBackground("skyblue");'), 'generated code missing setBackground: ' + code.slice(0, 300));
  await page.getByTestId('view-blocks').click();
});

await step('Play runs the project and shows the expected result', async () => {
  await page.getByTestId('play').click();
  await frame().locator('#score').waitFor({ timeout: 8000 });
  await page.waitForTimeout(500);
  assert((await frame().locator('#score').textContent()) === 'Score: 0', 'score not set by onStart');
  const bg = await frame().locator('#stage').evaluate((el) => getComputedStyle(el).backgroundColor);
  assert(bg === 'rgb(135, 206, 235)', 'background block did not run: ' + bg);
  await frame().locator('#target').click({ force: true });
  await page.waitForTimeout(300);
  assert((await frame().locator('#score').textContent()) === 'Score: 1', 'click handler did not run');
  await page.screenshot({ path: 'tests/e2e/screenshots/desktop-playing.png' });
});

await step('Stop stops execution', async () => {
  await page.getByTestId('stop').click();
  await page.waitForTimeout(200);
  assert((await page.locator('[data-testid=preview-frame]').count()) === 0, 'iframe still present');
  assert(await page.getByTestId('play').isVisible(), 'Play button not back');
});

await step('code → blocks: editing a supported statement updates the blocks', async () => {
  await page.getByTestId('view-code').click();
  await page.locator('.cm-content').waitFor();
  const code = await getCode();
  await setCode(code.replace('setBackground("skyblue");', 'setBackground("pink");'));
  await page.getByTestId('view-blocks').click();
  await page.waitForTimeout(500);
  const texts = await page.locator('.blocklyText').allTextContents();
  assert(texts.some((t) => t.includes('pink')), 'block did not update to pink');
  assert(!texts.some((t) => t.includes('skyblue')), 'old value still shown');
  const pill = await page.getByTestId('sync-state').textContent();
  assert(/match|updated/.test(pill), 'unexpected sync state: ' + pill);
});

await step('unsupported code is preserved and shown as a custom-code block', async () => {
  await page.getByTestId('view-code').click();
  await page.locator('.cm-content').waitFor();
  const code = await getCode();
  await setCode(`const colors = ["red", "blue"];\n${code.trim()}\n`);
  await page.getByTestId('view-blocks').click();
  await page.waitForTimeout(500);
  assert((await page.getByTestId('sync-state').textContent()).includes('custom'), 'sync state not unsupported');
  const labels = (await page.locator('.blocklyText').allTextContents()).map((t) => t.replace(/\u00a0/g, ' '));
  assert(labels.some((t) => t.includes('const colors')), 'custom code block missing');
  // A block edit must keep the unsupported code verbatim.
  await page.getByTestId('add-block').click();
  await page.getByRole('tab', { name: 'Sound' }).click();
  await page.getByRole('button', { name: 'play sound …' }).click();
  await page.waitForTimeout(600);
  await page.getByTestId('view-code').click();
  await page.locator('.cm-content').waitFor();
  const after = await getCode();
  assert(after.includes('const colors = ["red", "blue"];'), 'unsupported code lost');
  assert(after.includes('playSound("beep");'), 'new block not generated');
});

await step('syntax error keeps the code and locks the blocks', async () => {
  const code = await getCode();
  await setCode(code + '\nonStart(async () => {\n');
  await page.getByTestId('view-blocks').click();
  await page.getByText('Your code has a small mistake').waitFor({ timeout: 3000 });
  await page.getByRole('button', { name: 'Fix it in Code' }).click();
  await page.locator('.cm-content').waitFor();
  assert((await getCode()).includes('onStart(async () => {\n'), 'broken code was changed');
  await setCode(code);
  await page.getByTestId('view-blocks').click();
  await page.waitForTimeout(400);
  assert((await page.getByText('Your code has a small mistake').count()) === 0, 'still locked after fix');
});

await step('refresh recovers the project exactly', async () => {
  await waitSaved();
  await page.getByTestId('view-code').click();
  const before = await getCode();
  await page.reload();
  await page.waitForSelector('.blocklySvg', { timeout: 15000 });
  await page.getByTestId('view-code').click();
  await page.locator('.cm-content').waitFor();
  const after = await getCode();
  assert(after === before, 'code differs after refresh');
  assert(after.includes('const colors'), 'unsupported code lost after refresh');
});

await step('files: create a folder and a file inside it; it survives a refresh', async () => {
  await page.getByRole('button', { name: 'Files', exact: true }).first().click();
  await page.getByRole('button', { name: 'New folder' }).click();
  await page.getByRole('dialog').locator('input').fill('scripts');
  await page.getByRole('button', { name: 'Create folder' }).click();
  await page.getByRole('button', { name: 'Options for scripts' }).click();
  await page.getByRole('menuitem', { name: 'New file here…' }).click();
  await page.getByRole('dialog').locator('input').fill('helpers.js');
  await page.getByRole('button', { name: 'Create file' }).click();
  await page.waitForTimeout(300);
  await waitSaved();
  await page.reload();
  await page.waitForSelector('.blocklySvg', { timeout: 15000 });
  await page.getByRole('button', { name: 'Files', exact: true }).first().click();
  assert(await page.getByRole('treeitem', { name: /scripts/ }).isVisible(), 'folder missing after refresh');
  await page.locator('.tree-item', { hasText: 'helpers.js' }).waitFor({ timeout: 3000 });
});

let exportedPath = null;
await step('export project as ZIP', async () => {
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('menuitem', { name: 'Download project (.zip)' }).click();
  const d = await dl;
  exportedPath = 'tests/e2e/screenshots/' + d.suggestedFilename();
  await d.saveAs(exportedPath);
  assert(readFileSync(exportedPath).subarray(0, 2).toString() === 'PK', 'not a zip');
});

await step('import the exported ZIP from the dashboard (keeps both)', async () => {
  await page.goto(base);
  await page.locator('input[type=file]').setInputFiles(exportedPath);
  await page.getByRole('button', { name: 'Keep both' }).click();
  await page.getByText('E2E Target (imported)').first().waitFor({ timeout: 5000 });
  await page.getByRole('link', { name: 'Open E2E Target (imported)' }).first().click();
  await page.waitForSelector('.blocklySvg', { timeout: 15000 });
  await page.getByTestId('view-code').click();
  await page.locator('.cm-content').waitFor();
  assert((await getCode()).includes('const colors'), 'imported code differs');
  await page.getByRole('button', { name: 'Files', exact: true }).first().click();
  await page.locator('.tree-item', { hasText: 'helpers.js' }).waitFor({ timeout: 3000 });
});

await step('dashboard: folder, move, rename, duplicate, search', async () => {
  await page.goto(base);
  await page.getByRole('button', { name: 'New folder' }).click();
  await page.getByRole('dialog').locator('input').fill('School');
  await page.getByRole('button', { name: 'Create folder' }).click();
  await page.getByRole('button', { name: 'All projects' }).click();
  await page.locator('#my-projects').getByRole('button', { name: 'Options for E2E Target', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Move to folder…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /School/ }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.getByRole('group', { name: 'Folders' }).getByRole('button', { name: '📁 School' }).click();
  assert((await page.getByTestId('project-list').locator('li').count()) === 1, 'folder filter wrong');
  await page.getByRole('button', { name: 'All projects' }).click();
  await page.locator('#search').fill('imported');
  assert((await page.getByTestId('project-list').locator('li').count()) === 1, 'search wrong');
  await page.locator('#search').fill('');
});

await step('runaway loop is stopped with a friendly message', async () => {
  await page.goto(base + '#/new?type=app&template=blank-app');
  await page.getByTestId('start-creating').click();
  await page.waitForSelector('.blocklySvg', { timeout: 15000 });
  await page.getByTestId('view-code').click();
  await page.locator('.cm-content').waitFor();
  await setCode('onStart(async () => {\n  while (true) {\n  }\n});\n');
  await page.getByTestId('play').click();
  await page.getByText(/loop ran for too long/).waitFor({ timeout: 12000 });
});

await step('assets: add a picture and show it with a block', async () => {
  await page.goto(base + '#/new?type=game&template=blank-game');
  await page.getByTestId('start-creating').click();
  await page.waitForSelector('.blocklySvg', { timeout: 15000 });
  await page.getByRole('button', { name: 'Pictures and sounds' }).click();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.locator('input[aria-label="Add pictures or sounds"]').setInputFiles({ name: 'cat.png', mimeType: 'image/png', buffer: png });
  await page.getByText('cat.png').first().waitFor({ timeout: 5000 });
  await page.locator('input[aria-label="Add pictures or sounds"]').setInputFiles({ name: 'notes.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('MZ') });
  await page.getByText(/can’t be used/).waitFor({ timeout: 3000 });
  await page.getByTestId('view-code').click();
  await page.locator('.cm-content').waitFor();
  await setCode('onStart(async () => {\n  setImage("player", "cat.png");\n  setImage("player", "missing.png");\n});\n');
  await page.getByTestId('play').click();
  await page.waitForTimeout(1200);
  const bgImg = await frame().locator('#player').evaluate((el) => el.style.backgroundImage);
  assert(bgImg.includes('data:image/png'), 'picture not shown: ' + bgImg);
  await page.getByText(/“missing.png” could not be loaded/).waitFor({ timeout: 3000 });
});

await step('two tabs: a stale tab never overwrites newer work', async () => {
  const url = page.url();
  const other = await context.newPage();
  await other.goto(url);
  await other.waitForSelector('.blocklySvg', { timeout: 15000 });
  // Edit and save in the first tab.
  await page.getByTestId('stop').click().catch(() => {});
  await setCode('onStart(async () => {\n  say("first tab");\n});\n');
  await waitSaved();
  // Now edit the stale second tab.
  await other.getByTestId('view-code').click();
  await other.locator('.cm-content').click();
  await other.keyboard.press('End');
  await other.keyboard.insertText('\n// second tab');
  await other.getByText('This project was changed somewhere else').waitFor({ timeout: 8000 });
  await other.getByRole('button', { name: 'Load the other version' }).click();
  await other.waitForTimeout(300);
  const code = await other.evaluate(() => document.querySelector('.cm-content')?.innerText ?? '');
  assert(code.includes('first tab'), 'did not load newer version');
  await other.close();
});

await step('phone layout: single panel, bottom view switcher, no horizontal scroll', async () => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto(base);
  await page.waitForTimeout(300);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'home scrolls horizontally');
  await page.screenshot({ path: 'tests/e2e/screenshots/phone-home.png' });
  await page.getByRole('link', { name: 'Open E2E Target', exact: true }).first().click();
  await page.waitForSelector('.blocklySvg', { timeout: 15000 });
  const nav = page.getByRole('navigation', { name: 'Editor views' });
  assert(await nav.isVisible(), 'mobile nav hidden');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'editor scrolls horizontally');
  await page.screenshot({ path: 'tests/e2e/screenshots/phone-blocks.png' });
  await page.getByTestId('play').click();
  await frame().locator('#score').waitFor({ timeout: 8000 });
  assert(await page.locator('[data-testid=preview-frame]').isVisible(), 'preview not visible on phone');
  await page.screenshot({ path: 'tests/e2e/screenshots/phone-preview.png' });
  await nav.getByRole('button', { name: 'Code' }).click();
  await page.locator('.cm-content').waitFor();
});

await step('tablet layout: blocks and preview side by side', async () => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.reload();
  await page.waitForSelector('.blocklySvg', { timeout: 15000 });
  await page.getByTestId('play').click();
  await frame().locator('#score').waitFor({ timeout: 8000 });
  const blocksBox = await page.locator('.blocks-wrap').boundingBox();
  const previewBox = await page.locator('.preview-col').boundingBox();
  assert(blocksBox && previewBox && blocksBox.x < previewBox.x && blocksBox.width > 300, 'tablet layout wrong');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'tablet scrolls horizontally');
  await page.screenshot({ path: 'tests/e2e/screenshots/tablet.png' });
});

await step('every template runs without errors', async () => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const ids = await page.evaluate(async () => (await import('/src/templates/templates.ts')).TEMPLATES.map((t) => t.id)).catch(() => null);
  assert(ids && ids.length >= 12, 'could not list templates (this step needs the dev server)');
  for (const id of ids) {
    const type = id.split('-')[0] === 'web' ? 'website' : id.split('-')[0] === 'anim' ? 'animation' : id.split('-')[0];
    await page.goto(`${base}#/new?type=${type}&template=${id}`);
    await page.getByTestId('start-creating').click();
    await page.waitForSelector('.blocklySvg', { timeout: 15000 });
    await page.getByTestId('play').click();
    await page.waitForTimeout(1200);
    const errs = await page.locator('.console-row.error').allTextContents();
    assert(errs.length === 0, `${id}: ${errs.join(' | ')}`);
    assert((await page.getByTestId('sync-state').textContent()).includes('match'), `${id} not in sync`);
  }
});

await step('no unexpected errors in the ZinoMake page console', async () => {
  const relevant = pageErrors.filter((e) => !/favicon/.test(e));
  assert(relevant.length === 0, relevant.slice(0, 3).join(' | '));
});

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
