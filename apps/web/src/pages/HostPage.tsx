import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../components/Button';
import { Callout } from '../components/Callout';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { Layout } from '../components/Layout';
import { LinkField } from '../components/LinkField';
import { PixelSprite } from '../components/PixelSprite';
import { StateMessage } from '../components/StateMessage';
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
  return <video ref={ref} autoPlay playsInline muted />;
}

function ViewerSeats({ taken, total }: { taken: number; total: number }) {
  const seats = Array.from({ length: total }, (_, seat) => seat < taken);
  return (
    <div className="viewer-seats" role="img" aria-label={`${taken} de ${total} lugares ocupados`}>
      {seats.map((isTaken, seat) => (
        <PixelSprite
          key={seat}
          name="viewer"
          size={32}
          className={
            isTaken ? 'viewer-seats__seat viewer-seats__seat--taken' : 'viewer-seats__seat'
          }
        />
      ))}
    </div>
  );
}

export function HostPage() {
  const { roomId = '' } = useParams();
  const session = useHostSession(roomId);
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
      <Layout width="narrow">
        <h1 className="page-title">Sua sala</h1>
        <div className="card">
          <StateMessage
            icon={state === 'ended' ? 'stop' : 'alert'}
            tone={state === 'ended' ? 'neutral' : 'error'}
            message={message}
          >
            <Link className="btn btn--secondary" to="/">
              <Icon name="arrowLeft" />
              <span>Voltar ao início</span>
            </Link>
          </StateMessage>
        </div>
      </Layout>
    );
  }

  const inRoom = state === 'ready' || state === 'starting' || state === 'live';

  return (
    <Layout>
      <div className="page-head">
        <h1 className="page-title">Sua sala</h1>
        <div aria-live="polite">
          {state === 'live' && <StatusPill tone="live" label="Ao vivo" />}
          {state === 'connecting' && <StatusPill tone="neutral" label={CONNECTING_MESSAGE} />}
          {state === 'reconnecting' && <StatusPill tone="warning" label={RECONNECTING_MESSAGE} />}
        </div>
      </div>

      <div className="host-grid">
        <div className="stage">
          <div className="tv pixel-box">
            <div className="stage__frame">
              {session.previewStream ? (
                <LocalPreview stream={session.previewStream} />
              ) : (
                <div className="stage__placeholder">
                  <Icon name="screen" size={40} />
                  <p>A prévia da sua tela aparece aqui.</p>
                </div>
              )}
            </div>
            <div className="tv__knobs" aria-hidden="true">
              <span />
              <span />
            </div>
          </div>
          <div className="stage__bar">
            {state === 'live' ? (
              <Button variant="secondary" icon="stop" onClick={session.stopSharing}>
                Parar transmissão
              </Button>
            ) : (
              <Button
                variant="primary"
                icon="screen"
                busy={state === 'starting'}
                onClick={() => void session.startSharing()}
                disabled={!supported || state !== 'ready'}
              >
                {session.hasShared ? 'Compartilhar novamente' : 'Compartilhar tela'}
              </Button>
            )}
            <Button variant="danger" icon="close" onClick={session.endRoom} disabled={!inRoom}>
              Encerrar sala
            </Button>
          </div>
          <div className="stack">
            {!supported && <Callout tone="error">{UNSUPPORTED_BROWSER_MESSAGE}</Callout>}
            {session.error && (
              <div aria-live="polite">
                <Callout tone="error">{session.error}</Callout>
              </div>
            )}
            {session.audioMissing && <Callout tone="info">{NO_AUDIO_SHARED_MESSAGE}</Callout>}
          </div>
        </div>

        <aside className="host-side">
          <Card title="Link da sala">
            <LinkField link={link} />
          </Card>
          <Card title="Espectadores">
            <p className="viewer-count">{inRoom ? formatViewerCount(session.viewerCount) : '—'}</p>
            {session.maxViewers !== null && (
              <>
                <ViewerSeats taken={inRoom ? session.viewerCount : 0} total={session.maxViewers} />
                <p className="muted">Até {session.maxViewers} espectadores ao mesmo tempo.</p>
              </>
            )}
          </Card>
        </aside>
      </div>
    </Layout>
  );
}
