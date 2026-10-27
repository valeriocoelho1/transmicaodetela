import { type FormEvent, useEffect, useRef, useState } from 'react';
import { MAX_DISPLAY_NAME_LENGTH, PROFILE_AVATARS } from '@app/shared';
import type { Profile } from '../hooks/useProfile';
import { parseDisplayName } from '../lib/display-name';
import { AVATAR_LABELS } from '../lib/profile-avatar';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Icon } from './Icon';
import { ProfileHover } from './ProfileHover';

// The first option keeps the initial letter; the GIFs are optional.
const AVATAR_OPTIONS = [null, ...PROFILE_AVATARS];

interface ProfileNameProps {
  profile: Profile;
  role: string;
  onChange(profile: Profile): void;
}

export function ProfileName({ profile, role, onChange }: ProfileNameProps) {
  const [draft, setDraft] = useState<Profile | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const parsedName = draft === null ? null : parseDisplayName(draft.name);

  useEffect(() => {
    if (draft === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDraft(null);
    };
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setDraft(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [draft]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft || !parsedName) return;
    if (parsedName !== profile.name || draft.avatar !== profile.avatar) {
      onChange({ name: parsedName, avatar: draft.avatar });
    }
    setDraft(null);
  }

  return (
    <div className="profile-menu" ref={menuRef}>
      <ProfileHover profile={profile} role={role} disabled={draft !== null}>
        <button
          type="button"
          className="profile"
          onClick={() => setDraft(draft ? null : profile)}
          title="Editar seu perfil"
          aria-label={`Seu perfil: ${profile.name}. Editar`}
          aria-expanded={draft !== null}
        >
          <Avatar name={profile.name} avatar={profile.avatar} />
          <span className="profile__name">{profile.name}</span>
          <Icon name="edit" size={16} />
        </button>
      </ProfileHover>

      {draft && (
        <form className="profile-editor" onSubmit={submit} aria-label="Editar perfil">
          <div className="profile-editor__preview">
            <Avatar name={parsedName ?? profile.name} avatar={draft.avatar} size={72} />
          </div>
          <label className="profile-editor__field">
            <span>Seu nome</span>
            <input
              className="profile-editor__input"
              value={draft.name}
              maxLength={MAX_DISPLAY_NAME_LENGTH}
              aria-invalid={!parsedName}
              autoFocus
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
          <fieldset className="avatar-picker">
            <legend>Foto do perfil</legend>
            <div className="avatar-picker__options">
              {AVATAR_OPTIONS.map((avatar) => (
                <label key={avatar ?? 'none'} className="avatar-picker__option">
                  <input
                    type="radio"
                    name="profile-avatar"
                    value={avatar ?? 'none'}
                    checked={draft.avatar === avatar}
                    onChange={() => setDraft({ ...draft, avatar })}
                  />
                  <Avatar name={parsedName ?? profile.name} avatar={avatar} size={44} />
                  <span>{avatar ? AVATAR_LABELS[avatar] : 'Inicial'}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="profile-editor__actions">
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" icon="check" disabled={!parsedName}>
              Salvar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
