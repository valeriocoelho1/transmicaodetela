import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface StateMessageProps {
  icon: IconName;
  tone?: 'neutral' | 'error';
  busy?: boolean;
  message: string;
  children?: ReactNode;
}

export function StateMessage({
  icon,
  tone = 'neutral',
  busy,
  message,
  children,
}: StateMessageProps) {
  return (
    <div className={`state state--${tone}`}>
      <div className={busy ? 'state__icon state__icon--busy' : 'state__icon'}>
        <Icon name={icon} size={28} />
      </div>
      <p className="state__message" aria-live="polite">
        {message}
      </p>
      {children && <div className="state__actions">{children}</div>}
    </div>
  );
}
