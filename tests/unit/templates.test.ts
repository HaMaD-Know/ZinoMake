import { describe, expect, it } from 'vitest';
import { TEMPLATES, blankTemplate, findTemplate } from '../../src/templates/templates';
import { codeToBlocks } from '../../src/programming/parsers/codeToBlocks';
import { blocksToCode } from '../../src/programming/generators/blocksToCode';
import { createProjectFromTemplate } from '../../src/model/createProject';
import { PROJECT_TYPES } from '../../src/model/project';

const all = [...TEMPLATES, ...PROJECT_TYPES.map(blankTemplate)];

describe('starter templates', () => {
  it('has at least 3 templates per project type', () => {
    for (const t of PROJECT_TYPES) expect(TEMPLATES.filter((x) => x.type === t).length).toBeGreaterThanOrEqual(3);
  });

  it.each(all.map((t) => [t.id, t] as const))('%s converts fully to blocks and round-trips exactly', (_id, t) => {
    const r = codeToBlocks(t.js);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.unsupported).toEqual([]);
    expect(blocksToCode(r.workspace)).toBe(t.js);
  });

  it.each(all.map((t) => [t.id, t] as const))('%s references only element ids that exist in its HTML', (_id, t) => {
    const ids = new Set([...t.html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
    for (const [, made] of t.js.matchAll(/add(?:Character|Box|Circle|Picture|Label|Title|Paragraph|Button|Input)\("([^"]+)"/g)) ids.add(made);
    const used = [...t.js.matchAll(/(?:onClick|move|moveTo|getX|getY|setText|setColor|setSize|setStyle|turn|remove|show|hide|getValue)\("([^"]+)"/g)].map((m) => m[1]);
    for (const [, a, b] of t.js.matchAll(/touching\("([^"]+)", "([^"]+)"\)/g)) used.push(a, b);
    for (const u of used) expect(ids, `${t.id} uses #${u}`).toContain(u);
  });

  it('creates an in-sync project with the standard files', () => {
    const p = createProjectFromTemplate(TEMPLATES[0]);
    expect(p.files.map((f) => f.path)).toEqual(['index.html', 'style.css', 'main.js']);
    expect(p.syncState).toBe('in-sync');
    expect(p.blocksFile).toBe('main.js');
    expect(findTemplate('blank-game')?.type).toBe('game');
  });
});
