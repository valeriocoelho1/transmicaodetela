import { useEffect, useRef, useState } from 'react';

interface RemoteVideoProps {
  stream: MediaStream;
  hasAudio: boolean;
}

export function RemoteVideo({ stream, hasAudio }: RemoteVideoProps) {
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
    void videoRef.current?.requestFullscreen?.().catch(() => undefined);
  }

  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled;

  return (
    <div className="remote-video">
      <video ref={videoRef} data-testid="remote-video" autoPlay playsInline muted={muted} />
      <div className="actions">
        {hasAudio && (
          <button type="button" onClick={toggleSound}>
            {muted ? 'Ativar som' : 'Desativar som'}
          </button>
        )}
        {canFullscreen && (
          <button type="button" onClick={enterFullscreen}>
            Tela cheia
          </button>
        )}
      </div>
      {!hasAudio && <p className="hint">Esta transmissão está sem áudio.</p>}
    </div>
  );
}
