import { type ProfileAvatar, profileAvatar } from '@app/shared';
import dancingPoster from '../assets/avatars/dancing.jpg';
import dancingVideo from '../assets/avatars/dancing.mp4';
import kittenPoster from '../assets/avatars/kitten.jpg';
import kittenVideo from '../assets/avatars/kitten.mp4';
import pointingPoster from '../assets/avatars/pointing.jpg';
import pointingVideo from '../assets/avatars/pointing.mp4';
import tonguePoster from '../assets/avatars/tongue.jpg';
import tongueVideo from '../assets/avatars/tongue.mp4';

// A new key, so pictures assigned at random by an earlier version do not stick.
const STORAGE_KEY = 'profile-picture';

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

// Without a saved picture the avatar is the first letter of the name.
export function loadProfileAvatar(): ProfileAvatar | null {
  try {
    const stored = profileAvatar.safeParse(localStorage.getItem(STORAGE_KEY));
    return stored.success ? stored.data : null;
  } catch {
    return null;
  }
}

export function saveProfileAvatar(avatar: ProfileAvatar | null): void {
  try {
    if (avatar) localStorage.setItem(STORAGE_KEY, avatar);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable; the avatar still applies to this visit.
  }
}
