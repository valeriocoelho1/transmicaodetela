import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';
import type { RoomViewer } from '@app/shared';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Callout } from '../components/Callout';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { Layout } from '../components/Layout';
import { LinkField } from '../components/LinkField';
import { RoomBar } from '../components/RoomBar';
import { StateMessage } from '../components/StateMessage';
import { StatusPill } from '../components/StatusPill';
import { useDisplayName } from '../hooks/useDisplayName';
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

interface ViewerListProps {
  viewers: RoomViewer[];
  maxViewers: number | null;
}

function ViewerList({ viewers, maxViewers }: ViewerListProps) {
  return (
    <Card className="viewers">
      <div className="viewers__head">
        <h2 className="card__title">Espectadores</h2>
        <span className="viewers__count" aria-label={formatViewerCount(viewers.length)}>
          {viewers.length}
          {maxViewers !== null && <span className="muted">/{maxViewers}</span>}
        </span>
      </div>
      {viewers.length === 0 ? (
        <p className="viewers__empty">
          <Icon name="users" />
          Ninguém assistindo ainda. Envie o link da sala.
        </p>
      ) : (
        <ul className="viewer-list" aria-live="polite">
          {viewers.map((viewer) => (
            <li key={viewer.viewerId} className="viewer-list__item">
              <Avatar name={viewer.name} size={34} />
              <span className="viewer-list__name">{viewer.name}</span>
            </li>
          ))}
        </ul>
      )}
      {maxViewers !== null && (
        <p className="viewers__hint muted">Até {maxViewers} espectadores ao mesmo tempo.</p>
      )}
    </Card>
  );
}

export function HostPage() {
  const { roomId = '' } = useParams();
  const [name, rename] = useDisplayName();
  const session = useHostSession(roomId, name);
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
        <RoomBar name={name} onRename={rename} />
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
      <RoomBar name={name} onRename={rename} />
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
          <ViewerList viewers={inRoom ? session.viewers : []} maxViewers={session.maxViewers} />
        </aside>
      </div>
    </Layout>
  );
}
