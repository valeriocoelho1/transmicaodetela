export type StatusTone = 'live' | 'warning' | 'neutral';

export function StatusPill({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span className={`status-pill status-pill--${tone} pixel-box`}>
      <span className="status-pill__dot" aria-hidden="true" />
      {label}
    </span>
  );
}
