// @vitest-environment jsdom
import { PROFILE_AVATARS } from '@app/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { AVATAR_LABELS, loadProfileAvatar, saveProfileAvatar } from './profile-avatar';

describe('profile-avatar', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('starts without a picture so the initial letter shows', () => {
    expect(loadProfileAvatar()).toBeNull();
  });

  it('keeps a chosen picture and forgets it when cleared', () => {
    saveProfileAvatar('kitten');
    expect(loadProfileAvatar()).toBe('kitten');
    saveProfileAvatar(null);
    expect(loadProfileAvatar()).toBeNull();
  });

  it('ignores a stored value that is not a preset', () => {
    localStorage.setItem('profile-picture', 'confetti');
    expect(loadProfileAvatar()).toBeNull();
  });

  it('has a label for every preset', () => {
    expect(Object.keys(AVATAR_LABELS).sort()).toEqual([...PROFILE_AVATARS].sort());
  });
});
