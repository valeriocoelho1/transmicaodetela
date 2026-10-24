import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Tone = 'info' | 'warning' | 'error';

const icons: Record<Tone, IconName> = { info: 'info', warning: 'shield', error: 'alert' };

export function Callout({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div className={`callout callout--${tone}`}>
      <Icon name={icons[tone]} />
      <p>{children}</p>
    </div>
  );
}
