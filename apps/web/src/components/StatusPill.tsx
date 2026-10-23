export type StatusTone = 'live' | 'neutral' | 'warning' | 'error';

export function StatusPill({ tone, label }: { tone: StatusTone; label: string }) {
  return <span className={`status-pill status-pill--${tone}`}>{label}</span>;
}
