export type StatusTone = 'live' | 'warning';

export function StatusPill({ tone, label }: { tone: StatusTone; label: string }) {
  return <span className={`status-pill status-pill--${tone}`}>{label}</span>;
}
