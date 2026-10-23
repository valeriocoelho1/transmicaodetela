import { useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import { CopyButton } from '../components/CopyButton';
import { Layout } from '../components/Layout';
import { StatusPill } from '../components/StatusPill';
import { useHostSession } from '../hooks/useHostSession';
import {
  isDisplayCaptureSupported,
  NO_AUDIO_SHARED_MESSAGE,
  UNSUPPORTED_BROWSER_MESSAGE,
} from '../lib/capture';
import {
  CONNECTING_MESSAGE,
  END_REASON_MESSAGES,
  RECONNECTING_MESSAGE,
  ROOM_NOT_FOUND_MESSAGE,
} from '../lib/end-reason';
import { formatViewerCount } from '../lib/format';

function LocalPreview({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream;
    return () => {
      video.srcObject = null;
    };
  }, [stream]);
  return <video ref={ref} className="preview" autoPlay playsInline muted />;
}

export function HostPage() {
  const { roomId = '' } = useParams();
  const session = useHostSession(roomId);
  const linkRef = useRef<HTMLInputElement>(null);
  const link = `${window.location.origin}/r/${roomId}`;
  const supported = isDisplayCaptureSupported();
  const { state } = session;

  if (state === 'forbidden' || state === 'not_found' || state === 'ended') {
    const message =
      state === 'forbidden'
        ? 'Você não tem acesso de anfitrião a esta sala.'
        : state === 'not_found'
          ? ROOM_NOT_FOUND_MESSAGE
          : session.endedReason === 'HOST_REPLACED'
            ? 'Esta sala foi aberta em outra aba.'
            : END_REASON_MESSAGES[session.endedReason ?? 'HOST_ENDED'];
    return (
      <Layout>
        <h1>Sua sala</h1>
        <p aria-live="polite">{message}</p>
      </Layout>
    );
  }

  const inRoom = state === 'ready' || state === 'starting' || state === 'live';

  return (
    <Layout>
      <h1>Sua sala</h1>
      <div className="link-row">
        <input
          ref={linkRef}
          type="text"
          readOnly
          value={link}
          aria-label="Link"
          onFocus={(event) => event.currentTarget.select()}
        />
        <CopyButton text={link} onCopyFailed={() => linkRef.current?.select()} />
      </div>
      {session.maxViewers !== null && <p>Até {session.maxViewers} espectadores ao mesmo tempo.</p>}

      <div className="status-row" aria-live="polite">
        {state === 'live' && <StatusPill tone="live" label="Ao vivo" />}
        {state === 'connecting' && <span>{CONNECTING_MESSAGE}</span>}
        {state === 'reconnecting' && <StatusPill tone="warning" label={RECONNECTING_MESSAGE} />}
        {inRoom && <span>{formatViewerCount(session.viewerCount)}</span>}
      </div>

      {!supported && <p className="error">{UNSUPPORTED_BROWSER_MESSAGE}</p>}
      {session.error && (
        <p className="error" aria-live="polite">
          {session.error}
        </p>
      )}
      {session.audioMissing && <p className="hint">{NO_AUDIO_SHARED_MESSAGE}</p>}

      <div className="actions">
        {state === 'live' ? (
          <button type="button" onClick={session.stopSharing}>
            Parar transmissão
          </button>
        ) : (
          <button
            type="button"
            className="primary"
            onClick={() => void session.startSharing()}
            disabled={!supported || state !== 'ready'}
          >
            {session.hasShared ? 'Compartilhar novamente' : 'Compartilhar tela'}
          </button>
        )}
        <button type="button" className="danger" onClick={session.endRoom} disabled={!inRoom}>
          Encerrar sala
        </button>
      </div>

      {session.previewStream && <LocalPreview stream={session.previewStream} />}
    </Layout>
  );
}
