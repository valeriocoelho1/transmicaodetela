import type { ProfileAvatar } from '@app/shared';
import { avatarColor, initialOf } from '../lib/display-name';
import { AVATAR_CLIPS } from '../lib/profile-avatar';

interface AvatarProps {
  name: string;
  // Without a picture the avatar is the first letter of the name.
  avatar: ProfileAvatar | null;
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

export function Avatar({ name, avatar, size = 40 }: AvatarProps) {
  // A server from another release may send a picture this page does not know.
  const clip = avatar ? AVATAR_CLIPS[avatar] : undefined;
  if (!clip) {
    return (
      <span
        className="avatar avatar--letter"
        style={{ width: size, height: size, fontSize: size * 0.45, background: avatarColor(name) }}
        aria-hidden="true"
      >
        {initialOf(name)}
      </span>
    );
  }
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
