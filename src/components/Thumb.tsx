import type { ProjectType } from '../model/project';
import { findTemplate } from '../templates/templates';

export const TYPE_LABEL: Record<ProjectType, string> = { game: 'Game', app: 'App', website: 'Website', animation: 'Animation' };
export const TYPE_EMOJI: Record<ProjectType, string> = { game: '🎮', app: '📱', website: '🌐', animation: '🎬' };

/** Generated preview: template colours + emoji. */
export function Thumb({ templateId, type, showType = true }: { templateId: string; type: ProjectType; showType?: boolean }) {
  const t = findTemplate(templateId);
  const [a, b] = t?.colors ?? ['#adb5bd', '#f1f3f5'];
  return (
    <div className="thumb" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} aria-hidden="true">
      {showType && <span className="type-badge">{TYPE_LABEL[type]}</span>}
      <span>{t?.emoji ?? TYPE_EMOJI[type]}</span>
    </div>
  );
}

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  if (d < 14) return `${d} day${d === 1 ? '' : 's'} ago`;
  return new Date(ts).toLocaleDateString();
}
