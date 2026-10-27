import { PROFILE_AVATARS, type ProfileAvatar, profileAvatar } from '@app/shared';
import dancingPoster from '../assets/avatars/dancing.jpg';
import dancingVideo from '../assets/avatars/dancing.mp4';
import kittenPoster from '../assets/avatars/kitten.jpg';
import kittenVideo from '../assets/avatars/kitten.mp4';
import pointingPoster from '../assets/avatars/pointing.jpg';
import pointingVideo from '../assets/avatars/pointing.mp4';
import tonguePoster from '../assets/avatars/tongue.jpg';
import tongueVideo from '../assets/avatars/tongue.mp4';

const STORAGE_KEY = 'profile-avatar';

export const AVATAR_LABELS: Record<ProfileAvatar, string> = {
  pointing: 'Apontando',
  kitten: 'Gatinho',
  dancing: 'Dancinha',
  tongue: 'Linguinha',
};

// Short muted loops play like a GIF at a fraction of the size; the poster is the still frame.
export const AVATAR_CLIPS: Record<ProfileAvatar, { video: string; poster: string }> = {
  pointing: { video: pointingVideo, poster: pointingPoster },
  kitten: { video: kittenVideo, poster: kittenPoster },
  dancing: { video: dancingVideo, poster: dancingPoster },
  tongue: { video: tongueVideo, poster: tonguePoster },
};

export function randomAvatar(): ProfileAvatar {
  const [value = 0] = crypto.getRandomValues(new Uint32Array(1));
  return PROFILE_AVATARS[value % PROFILE_AVATARS.length]!;
}

export function loadProfileAvatar(): ProfileAvatar {
  try {
    const stored = profileAvatar.safeParse(localStorage.getItem(STORAGE_KEY));
    if (stored.success) return stored.data;
    const picked = randomAvatar();
    localStorage.setItem(STORAGE_KEY, picked);
    return picked;
  } catch {
    return randomAvatar();
  }
}

export function saveProfileAvatar(avatar: ProfileAvatar): void {
  try {
    localStorage.setItem(STORAGE_KEY, avatar);
  } catch {
    // Storage may be unavailable; the avatar still applies to this visit.
  }
}
