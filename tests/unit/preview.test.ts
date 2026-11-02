import { describe, expect, it } from 'vitest';
import { buildPreviewDocument, instrumentLoops, validatePreviewMessage, PREVIEW_CSP } from '../../src/runtime/buildPreview';
import { createProjectFromTemplate } from '../../src/model/createProject';
import { TEMPLATES } from '../../src/templates/templates';

describe('preview document', () => {
  it('guards every kind of loop', () => {
    const out = instrumentLoops('while (true) {}\nfor (;;) x++;\ndo { } while (a);\nfor (const a of b) {}');
    expect(out.match(/__zmGuard\(\);/g)?.length).toBe(4);
    expect(out).toContain('for (;;) {__zmGuard();x++;}');
    expect(out.split('\n').length).toBe(4); // line numbers are preserved
  });

  it('includes CSP, runtime, CSS, HTML and the user code', () => {
    const p = createProjectFromTemplate(TEMPLATES[0]);
    const doc = buildPreviewDocument({ project: p, assetUrls: {} });
    expect(doc).toContain(PREVIEW_CSP);
    expect(doc).toContain('#target');
    expect(doc).toContain('id="target"');
    expect(doc).toContain('onClick("target"');
    expect(doc.indexOf('zinomake-runtime.js')).toBeLessThan(doc.indexOf('onClick("target"'));
  });

  it('escapes </script> in user code and inlines assets', () => {
    const p = createProjectFromTemplate(TEMPLATES[0]);
    p.files = p.files.map((f) => (f.path === 'main.js' ? { ...f, content: 'say("</script><b>")' } : f.path === 'index.html' ? { ...f, content: '<img src="assets/cat.png">' } : f));
    const doc = buildPreviewDocument({ project: p, assetUrls: { 'cat.png': 'data:image/png;base64,AA==' } });
    expect(doc).not.toContain('say("</script>');
    expect(doc).toContain('<img src="data:image/png;base64,AA==">');
  });

  it('accepts only well-formed preview messages', () => {
    expect(validatePreviewMessage({ source: 'zinomake-preview', type: 'say', message: 'hi' })).toEqual({ source: 'zinomake-preview', type: 'say', message: 'hi' });
    expect(validatePreviewMessage({ source: 'other', type: 'say', message: 'hi' })).toBeNull();
    expect(validatePreviewMessage({ source: 'zinomake-preview', type: 'navigate', url: 'x' })).toBeNull();
    expect(validatePreviewMessage({ source: 'zinomake-preview', type: 'log', message: 5 })).toBeNull();
    expect(validatePreviewMessage('nope')).toBeNull();
    const e = validatePreviewMessage({ source: 'zinomake-preview', type: 'error', message: 'x'.repeat(5000), line: '3' });
    expect(e && e.type === 'error' && e.message.length).toBe(1000);
    expect(e && e.type === 'error' && e.line).toBeNull();
  });
});
