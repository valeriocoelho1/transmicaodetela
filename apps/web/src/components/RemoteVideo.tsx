import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';

interface RemoteVideoProps {
  stream: MediaStream;
  hasAudio: boolean;
}

export function RemoteVideo({ stream, hasAudio }: RemoteVideoProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

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
    // The browser may refuse fullscreen (e.g. permissions policy); the video keeps playing inline.
    frameRef.current?.requestFullscreen().catch(() => undefined);
  }

  const canFullscreen = document.fullscreenEnabled;

  return (
    <div className="stage">
      <div className="tv pixel-box">
        <div className="stage__frame" ref={frameRef}>
          <video ref={videoRef} data-testid="remote-video" autoPlay playsInline muted={muted} />
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
