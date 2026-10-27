// @vitest-environment jsdom
import { PROFILE_AVATARS } from '@app/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { AVATAR_LABELS, loadProfileAvatar, saveProfileAvatar } from './profile-avatar';

describe('profile-avatar', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('picks a preset on the first visit and keeps it', () => {
    const first = loadProfileAvatar();
    expect(PROFILE_AVATARS).toContain(first);
    expect(loadProfileAvatar()).toBe(first);
  });

  it('replaces a stored value that is not a preset', () => {
    localStorage.setItem('profile-avatar', 'confetti');
    expect(PROFILE_AVATARS).toContain(loadProfileAvatar());
    saveProfileAvatar('kitten');
    expect(loadProfileAvatar()).toBe('kitten');
  });

  it('has a label for every preset', () => {
    expect(Object.keys(AVATAR_LABELS).sort()).toEqual([...PROFILE_AVATARS].sort());
  });
});
