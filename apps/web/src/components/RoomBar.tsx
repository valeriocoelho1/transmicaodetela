import { Link } from 'react-router';
import { PixelSprite } from './PixelSprite';
import { ProfileName } from './ProfileName';

interface RoomBarProps {
  name: string;
  onRename(name: string): void;
}

export function RoomBar({ name, onRename }: RoomBarProps) {
  return (
    <header className="room-bar">
      <Link to="/" className="room-bar__brand">
        <PixelSprite name="tv" size={26} />
        <span>Compartilhar tela</span>
      </Link>
      <ProfileName name={name} onRename={onRename} />
    </header>
  );
}
