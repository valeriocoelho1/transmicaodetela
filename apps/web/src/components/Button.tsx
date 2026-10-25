import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'danger' | 'success';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'lg';
  icon?: IconName;
  trailingIcon?: IconName;
  busy?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  trailingIcon,
  busy = false,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = ['btn', `btn--${variant}`, size === 'lg' && 'btn--lg', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={classes} aria-busy={busy || undefined} {...rest}>
      {busy ? <span className="spinner" aria-hidden="true" /> : icon && <Icon name={icon} />}
      <span>{children}</span>
      {!busy && trailingIcon && <Icon name={trailingIcon} />}
    </button>
  );
}
