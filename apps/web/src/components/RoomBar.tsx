import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { Profile } from '../hooks/useProfile';
import { PixelSprite } from './PixelSprite';
import { ProfileName } from './ProfileName';

interface RoomBarProps {
  profile: Profile;
  role: string;
  onProfileChange(profile: Profile): void;
  children?: ReactNode;
}

export function RoomBar({ profile, role, onProfileChange, children }: RoomBarProps) {
  return (
    <header className="room-bar">
      <Link
        to="/"
        className="room-bar__brand"
        aria-label="Transmitir tela, página inicial"
        title="Transmitir tela"
      >
        <PixelSprite name="tv" size={48} />
      </Link>
      <div className="room-bar__meta" aria-live="polite">
        {children}
      </div>
      <ProfileName profile={profile} role={role} onChange={onProfileChange} />
    </header>
  );
}
