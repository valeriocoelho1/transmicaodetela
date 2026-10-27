import { useCallback, useState } from 'react';
import type { ProfileAvatar } from '@app/shared';
import { loadDisplayName, saveDisplayName } from '../lib/display-name';
import { loadProfileAvatar, saveProfileAvatar } from '../lib/profile-avatar';

export interface Profile {
  name: string;
  avatar: ProfileAvatar;
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile>(() => ({
    name: loadDisplayName(),
    avatar: loadProfileAvatar(),
  }));
  const update = useCallback((next: Profile) => {
    saveDisplayName(next.name);
    saveProfileAvatar(next.avatar);
    setProfile(next);
  }, []);
  return [profile, update] as const;
}
