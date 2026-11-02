import { useState } from 'react';
import { Logo } from '../components/Logo';
import { Icon } from '../components/Icon';
import { Thumb, TYPE_EMOJI, TYPE_LABEL } from '../components/Thumb';
import { navigate } from '../app/App';
import { toast } from '../app/ui-store';
import { blankTemplate, findTemplate, templatesFor } from '../templates/templates';
import { PROJECT_TYPES, type ProjectType } from '../model/project';

const TYPE_DESC: Record<ProjectType, string> = {
  game: 'Something you can play',
  app: 'A useful tool with buttons',
  website: 'A page to show the world',
  animation: 'Things that move by themselves',
};

export function CreatePage({ initialType, initialTemplate }: { initialType?: string; initialTemplate?: string }) {
  const startType = PROJECT_TYPES.includes(initialType as ProjectType) ? (initialType as ProjectType) : null;
  const [type, setType] = useState<ProjectType | null>(startType);
  const [templateId, setTemplateId] = useState<string | null>(initialTemplate && findTemplate(initialTemplate) ? initialTemplate : null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const step = !type ? 1 : !templateId ? 2 : 3;
  const template = templateId ? findTemplate(templateId) : null;

  const start = async () => {
    if (!templateId) return;
    setBusy(true);
    try {
      const { createFromTemplate } = await import('../app/projectService');
      const p = await createFromTemplate(templateId, name);
      navigate(`#/p/${p.id}`);
    } catch (e) {
      console.error('[ZinoMake] could not create project', e);
      toast('Your project couldn’t be created. Your browser may be blocking storage. Try again.', 'error');
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <header className="topnav">
        <Logo />
        <a className="btn btn-ghost" href="#/"><Icon name="back" /> My Projects</a>
      </header>
      <main className="create-wrap">
        <ol className="stepper" aria-label="Steps" style={{ listStyle: 'none', padding: 0 }}>
          <li><span aria-current={step === 1 ? 'step' : undefined}>1. Choose</span></li>
          <li aria-hidden="true">→</li>
          <li><span aria-current={step === 2 ? 'step' : undefined}>2. Pick a starter</span></li>
          <li aria-hidden="true">→</li>
          <li><span aria-current={step === 3 ? 'step' : undefined}>3. Start creating</span></li>
        </ol>

        {!type ? (
          <section aria-labelledby="what-title">
            <h1 id="what-title" style={{ textAlign: 'center', fontSize: 32 }}>What do you want to make?</h1>
            <div className="type-grid" style={{ marginTop: 22 }}>
              {PROJECT_TYPES.map((t) => (
                <button key={t} className="type-card" onClick={() => setType(t)} data-testid={`type-${t}`}>
                  <span className="emoji" aria-hidden="true">{TYPE_EMOJI[t]}</span>
                  <strong>{TYPE_LABEL[t]}</strong>
                  <span className="desc">{TYPE_DESC[t]}</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section aria-labelledby="pick-title">
            <div className="section-head">
              <h1 id="pick-title" style={{ fontSize: 28, margin: 0 }}>Pick a {TYPE_LABEL[type].toLowerCase()} to start with</h1>
              <button className="btn btn-ghost" onClick={() => { setType(null); setTemplateId(null); }}><Icon name="back" /> Choose something else</button>
            </div>
            <p className="hint">Every starter already works. Press Play in the editor to try it, then change it however you like.</p>
            <ul className="grid" style={{ padding: 0, margin: 0 }} role="list">
              {[...templatesFor(type), blankTemplate(type)].map((t) => (
                <li key={t.id} className={`card${templateId === t.id ? ' selected' : ''}`} style={{ listStyle: 'none' }}>
                  <button className="card-button" aria-pressed={templateId === t.id} onClick={() => setTemplateId(t.id)} data-testid={`template-${t.id}`}>
                    <Thumb templateId={t.id} type={t.type} showType={false} />
                    <div className="card-body"><h3>{t.name}</h3><p>{t.description}</p></div>
                  </button>
                </li>
              ))}
            </ul>
            {template && (
              <form className="start-bar" onSubmit={(e) => { e.preventDefault(); void start(); }} aria-label="Start creating">
                <span style={{ fontSize: 28 }} aria-hidden="true">{template.emoji}</span>
                <label className="sr-only" htmlFor="pname">Project name</label>
                <input id="pname" className="input" placeholder={template.id.startsWith('blank-') ? 'My project' : template.name} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
                <button type="submit" className="btn btn-primary btn-big" disabled={busy} data-testid="start-creating">
                  {busy ? 'Creating…' : 'Start Creating'}
                </button>
              </form>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
