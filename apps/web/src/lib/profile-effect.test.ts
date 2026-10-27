// @vitest-environment jsdom
import { PROFILE_EFFECTS } from '@app/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { EFFECT_LABELS, loadProfileEffect, saveProfileEffect } from './profile-effect';

describe('profile-effect', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('picks a preset on the first visit and keeps it', () => {
    const first = loadProfileEffect();
    expect(PROFILE_EFFECTS).toContain(first);
    expect(loadProfileEffect()).toBe(first);
  });

  it('replaces a stored value that is not a preset', () => {
    localStorage.setItem('profile-effect', 'confetti');
    expect(PROFILE_EFFECTS).toContain(loadProfileEffect());
    saveProfileEffect('rainbow');
    expect(loadProfileEffect()).toBe('rainbow');
  });

  it('has a label for every preset', () => {
    expect(Object.keys(EFFECT_LABELS).sort()).toEqual([...PROFILE_EFFECTS].sort());
  });
});
