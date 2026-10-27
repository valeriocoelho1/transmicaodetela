import { type FormEvent, useState } from 'react';
import { MAX_DISPLAY_NAME_LENGTH } from '@app/shared';
import { parseDisplayName } from '../lib/display-name';
import { Avatar } from './Avatar';
import { Icon } from './Icon';

interface ProfileNameProps {
  name: string;
  onRename(name: string): void;
}

export function ProfileName({ name, onRename }: ProfileNameProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const parsed = draft === null ? null : parseDisplayName(draft);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!parsed) return;
    if (parsed !== name) onRename(parsed);
    setDraft(null);
  }

  if (draft !== null) {
    return (
      <form className="profile profile--editing" onSubmit={submit}>
        <Avatar name={parsed ?? name} />
        <input
          className="profile__input"
          value={draft}
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          aria-label="Seu nome"
          aria-invalid={!parsed}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setDraft(null);
          }}
        />
        <button className="profile__action" type="submit" disabled={!parsed} aria-label="Salvar">
          <Icon name="check" size={18} />
        </button>
        <button
          className="profile__action"
          type="button"
          onClick={() => setDraft(null)}
          aria-label="Cancelar"
        >
          <Icon name="close" size={18} />
        </button>
      </form>
    );
  }

  return (
    <button
      type="button"
      className="profile"
      onClick={() => setDraft(name)}
      title="Alterar seu nome"
      aria-label={`Seu nome: ${name}. Alterar`}
    >
      <Avatar name={name} />
      <span className="profile__name">{name}</span>
      <Icon name="edit" size={16} />
    </button>
  );
}
