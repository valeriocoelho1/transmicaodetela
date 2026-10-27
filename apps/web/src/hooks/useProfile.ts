import { useCallback, useState } from 'react';
import type { ProfileEffect } from '@app/shared';
import { loadDisplayName, saveDisplayName } from '../lib/display-name';
import { loadProfileEffect, saveProfileEffect } from '../lib/profile-effect';

export interface Profile {
  name: string;
  effect: ProfileEffect;
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile>(() => ({
    name: loadDisplayName(),
    effect: loadProfileEffect(),
  }));
  const update = useCallback((next: Profile) => {
    saveDisplayName(next.name);
    saveProfileEffect(next.effect);
    setProfile(next);
  }, []);
  return [profile, update] as const;
}
