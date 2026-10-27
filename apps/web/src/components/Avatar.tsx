import type { CSSProperties } from 'react';
import type { ProfileEffect } from '@app/shared';
import { avatarColor, initialOf } from '../lib/display-name';

interface AvatarProps {
  name: string;
  size?: number;
  // Plays the person's chosen animation around the avatar.
  effect?: ProfileEffect;
}

export function Avatar({ name, size = 40, effect }: AvatarProps) {
  const color = avatarColor(name);
  const avatar = (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.45, background: color }}
      aria-hidden="true"
    >
      {initialOf(name)}
    </span>
  );
  if (!effect) return avatar;
  return (
    <span
      className={`avatar-fx avatar-fx--${effect}`}
      style={{ width: size, height: size, '--avatar-color': color } as CSSProperties}
      aria-hidden="true"
    >
      {avatar}
    </span>
  );
}
