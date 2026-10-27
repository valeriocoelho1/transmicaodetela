import { avatarColor, initialOf } from '../lib/display-name';

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.45, background: avatarColor(name) }}
      aria-hidden="true"
    >
      {initialOf(name)}
    </span>
  );
}
