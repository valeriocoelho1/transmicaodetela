import { type PointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

interface RemoteVideoProps {
  stream: MediaStream;
  hasAudio: boolean;
}

// iPhone Safari has no element fullscreen; only the native video player can go fullscreen.
type IosVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };
// ScreenOrientation.lock is missing from the TypeScript DOM lib.
type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> };

const CONTROLS_IDLE_MS = 2_500;

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
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [muted, setMuted] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsShown, setControlsShown] = useState(true);

  const showControls = useCallback(() => {
    setControlsShown(true);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setControlsShown(false), CONTROLS_IDLE_MS);
  }, []);

  useEffect(() => {
    showControls();
    return () => clearTimeout(idleTimer.current);
  }, [showControls]);

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

  function toggleFullscreen() {
    if (fullscreen) {
      document.exitFullscreen().catch(() => undefined);
      return;
    }
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

  function onVideoPointerDown(event: PointerEvent) {
    // On touch screens a tap toggles the controls, like a video player app.
    if (event.pointerType !== 'touch') return;
    if (controlsShown) {
      clearTimeout(idleTimer.current);
      setControlsShown(false);
    } else {
      showControls();
    }
  }

  const canFullscreen = document.fullscreenEnabled || supportsNativeVideoFullscreen;
  // While the sound is off, keep the button in sight so viewers know they can turn it on.
  const visible = controlsShown || (hasAudio && muted);

  return (
    <div className="stage">
      <div className="stage__screen">
        <div className="tv pixel-box">
          <div
            className={visible ? 'stage__frame player' : 'stage__frame player player--idle'}
            ref={frameRef}
            onPointerMove={(event) => event.pointerType !== 'touch' && showControls()}
            onPointerLeave={() => setControlsShown(false)}
            onFocus={showControls}
          >
            <video
              ref={videoRef}
              data-testid="remote-video"
              autoPlay
              playsInline
              muted={muted}
              onPointerDown={onVideoPointerDown}
              onDoubleClick={toggleFullscreen}
            />
            <div className="player__controls">
              {hasAudio ? (
                <button
                  type="button"
                  className={muted ? 'player__btn player__btn--label' : 'player__btn'}
                  onClick={toggleSound}
                  aria-label={muted ? 'Ativar som' : 'Desativar som'}
                  title={muted ? 'Ativar som' : 'Desativar som'}
                >
                  <Icon name={muted ? 'mute' : 'volume'} />
                  {muted && <span>Ativar som</span>}
                </button>
              ) : (
                <p className="player__hint">
                  <Icon name="mute" size={18} />
                  Esta transmissão está sem áudio.
                </p>
              )}
              {canFullscreen && (
                <button
                  type="button"
                  className="player__btn"
                  onClick={toggleFullscreen}
                  aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                  title={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                >
                  <Icon name={fullscreen ? 'shrink' : 'expand'} />
                </button>
              )}
            </div>
          </div>
          <div className="tv__knobs" aria-hidden="true">
            <span />
            <span />
          </div>
        </div>
      </div>
    </div>
  );
}
