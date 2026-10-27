import type { PublicViewer } from '@app/shared';
import { formatViewerCount } from '../lib/format';
import { Avatar } from './Avatar';
import { Card } from './Card';
import { Icon } from './Icon';

interface ViewerListProps {
  viewers: PublicViewer[];
  maxViewers: number | null;
  selfId?: string | null;
  emptyText: string;
  hint?: string;
}

export function ViewerList({ viewers, maxViewers, selfId, emptyText, hint }: ViewerListProps) {
  return (
    <Card className="viewers">
      <div className="viewers__head">
        <h2 className="card__title">Espectadores</h2>
        <span className="viewers__count" aria-label={formatViewerCount(viewers.length)}>
          {viewers.length}
          {maxViewers !== null && <span className="muted">/{maxViewers}</span>}
        </span>
      </div>
      {viewers.length === 0 ? (
        <p className="viewers__empty">
          <Icon name="users" />
          {emptyText}
        </p>
      ) : (
        <ul className="viewer-list" aria-live="polite">
          {viewers.map((viewer) => (
            <li
              key={viewer.id}
              className={
                viewer.id === selfId
                  ? 'viewer-list__item viewer-list__item--self'
                  : 'viewer-list__item'
              }
            >
              <Avatar name={viewer.name} size={34} />
              <span className="viewer-list__name">{viewer.name}</span>
              {viewer.id === selfId && <span className="viewer-list__self">você</span>}
            </li>
          ))}
        </ul>
      )}
      {hint && <p className="viewers__hint muted">{hint}</p>}
    </Card>
  );
}
