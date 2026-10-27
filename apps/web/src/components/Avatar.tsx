import type { ProfileAvatar } from '@app/shared';
import { AVATAR_CLIPS } from '../lib/profile-avatar';

interface AvatarProps {
  avatar: ProfileAvatar;
  size?: number;
}

const reducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Browsers only autoplay muted media; setting the property here avoids relying on the attribute.
function startMuted(video: HTMLVideoElement | null) {
  if (!video) return;
  video.muted = true;
  // Older engines (and jsdom) return nothing from play().
  if (!reducedMotion()) video.play()?.catch(() => undefined);
}

export function Avatar({ avatar, size = 40 }: AvatarProps) {
  // A server from another release may send a picture this page does not know.
  const clip = AVATAR_CLIPS[avatar] ?? AVATAR_CLIPS.kitten;
  return (
    <span className="avatar" style={{ width: size, height: size }} aria-hidden="true">
      <video
        key={avatar}
        ref={startMuted}
        src={clip.video}
        poster={clip.poster}
        loop
        muted
        playsInline
        disablePictureInPicture
        preload={reducedMotion() ? 'none' : 'auto'}
        tabIndex={-1}
      />
    </span>
  );
}
