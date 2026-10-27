import { PROFILE_EFFECTS, type ProfileEffect, profileEffect } from '@app/shared';

const STORAGE_KEY = 'profile-effect';

export const EFFECT_LABELS: Record<ProfileEffect, string> = {
  sparkle: 'Brilhos',
  bounce: 'Pulinho',
  rainbow: 'Arco-íris',
  pulse: 'Pulsar',
  wiggle: 'Balanço',
};

export function randomEffect(): ProfileEffect {
  const [value = 0] = crypto.getRandomValues(new Uint32Array(1));
  return PROFILE_EFFECTS[value % PROFILE_EFFECTS.length]!;
}

export function loadProfileEffect(): ProfileEffect {
  try {
    const stored = profileEffect.safeParse(localStorage.getItem(STORAGE_KEY));
    if (stored.success) return stored.data;
    const picked = randomEffect();
    localStorage.setItem(STORAGE_KEY, picked);
    return picked;
  } catch {
    return randomEffect();
  }
}

export function saveProfileEffect(effect: ProfileEffect): void {
  try {
    localStorage.setItem(STORAGE_KEY, effect);
  } catch {
    // Storage may be unavailable; the effect still applies to this visit.
  }
}
