import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';

interface RemoteVideoProps {
  stream: MediaStream;
  hasAudio: boolean;
}

// iPhone Safari has no element fullscreen; only the native video player can go fullscreen.
type IosVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };
// ScreenOrientation.lock is missing from the TypeScript DOM lib.
type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> };

const supportsNativeVideoFullscreen =
  typeof HTMLVideoElement !== 'undefined' && 'webkitEnterFullscreen' in HTMLVideoElement.prototype;

function lockToVideoOrientation(video: HTMLVideoElement): void {
  const orientation = screen.orientation as LockableOrientation | undefined;
  if (!orientation?.lock || !window.matchMedia('(pointer: coarse)').matches) return;
  if (!video.videoWidth || !video.videoHeight) return;
  const target = video.videoWidth >= video.videoHeight ? 'landscape' : 'portrait';
  // Desktop browsers and some phones refuse the lock; the video still fills the screen.
  orientation.lock(target).catch(() => undefined);
}

export function RemoteVideo({ stream, hasAudio }: RemoteVideoProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    const video = videoRef.current;
    if (!fullscreen || !video) return;
    // The host may switch to a screen or window with another shape while we are fullscreen.
    const relock = () => lockToVideoOrientation(video);
    relock();
    video.addEventListener('resize', relock);
    return () => {
      video.removeEventListener('resize', relock);
      screen.orientation?.unlock?.();
    };
  }, [fullscreen]);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  function toggleSound() {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !muted;
    video.muted = nextMuted;
    setMuted(nextMuted);
    if (video.paused) {
      // Autoplay with sound can be refused; fall back to muted playback instead of a frozen frame.
      video.play().catch(() => {
        video.muted = true;
        setMuted(true);
      });
    }
  }

  function enterFullscreen() {
    const frame = frameRef.current;
    const video = videoRef.current as IosVideo | null;
    if (!frame || !video) return;
    if (document.fullscreenEnabled) {
      // The browser may refuse fullscreen (e.g. permissions policy); the video keeps playing inline.
      frame.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
    } else {
      video.webkitEnterFullscreen?.();
    }
  }

  function exitFullscreen() {
    document.exitFullscreen().catch(() => undefined);
  }

  const canFullscreen = document.fullscreenEnabled || supportsNativeVideoFullscreen;

  return (
    <div className="stage">
      <div className="tv pixel-box">
        <div className="stage__frame" ref={frameRef}>
          <video
            ref={videoRef}
            data-testid="remote-video"
            autoPlay
            playsInline
            muted={muted}
            onDoubleClick={fullscreen ? exitFullscreen : enterFullscreen}
          />
          {fullscreen && (
            <div className="stage__overlay">
              {hasAudio && (
                <button
                  type="button"
                  className="stage__overlay-btn"
                  onClick={toggleSound}
                  aria-label={muted ? 'Ativar som' : 'Desativar som'}
                >
                  <Icon name={muted ? 'mute' : 'volume'} />
                </button>
              )}
              <button
                type="button"
                className="stage__overlay-btn"
                onClick={exitFullscreen}
                aria-label="Sair da tela cheia"
              >
                <Icon name="shrink" />
              </button>
            </div>
          )}
        </div>
        <div className="tv__knobs" aria-hidden="true">
          <span />
          <span />
        </div>
      </div>
      <div className="stage__bar">
        {hasAudio ? (
          <Button
            variant={muted ? 'primary' : 'secondary'}
            icon={muted ? 'volume' : 'mute'}
            onClick={toggleSound}
          >
            {muted ? 'Ativar som' : 'Desativar som'}
          </Button>
        ) : (
          <p className="stage__hint">
            <Icon name="mute" size={18} />
            Esta transmissão está sem áudio.
          </p>
        )}
        {canFullscreen && (
          <Button variant="secondary" icon="expand" onClick={enterFullscreen}>
            Tela cheia
          </Button>
        )}
      </div>
    </div>
  );
}
