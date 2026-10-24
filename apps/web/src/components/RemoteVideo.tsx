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
    video.muted = !muted;
    setMuted(!muted);
    if (video.paused) void video.play().catch(() => undefined);
  }

  function enterFullscreen() {
    void frameRef.current?.requestFullscreen?.().catch(() => undefined);
  }

  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled;

  return (
    <div className="stage">
      <div className="stage__frame" ref={frameRef}>
        <video ref={videoRef} data-testid="remote-video" autoPlay playsInline muted={muted} />
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
          <Button variant="ghost" icon="expand" onClick={enterFullscreen}>
            Tela cheia
          </Button>
        )}
      </div>
    </div>
  );
}
