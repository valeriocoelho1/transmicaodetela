import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { PixelSprite } from './PixelSprite';
import { ProfileName } from './ProfileName';

interface RoomBarProps {
  name: string;
  onRename(name: string): void;
  children?: ReactNode;
}

export function RoomBar({ name, onRename, children }: RoomBarProps) {
  return (
    <header className="room-bar">
      <Link to="/" className="room-bar__brand">
        <PixelSprite name="tv" size={26} />
        <span>Transmitir tela</span>
      </Link>
      <div className="room-bar__meta" aria-live="polite">
        {children}
      </div>
      <ProfileName name={name} onRename={onRename} />
    </header>
  );
}
