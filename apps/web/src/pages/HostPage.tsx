import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../components/Button';
import { Callout } from '../components/Callout';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { Layout } from '../components/Layout';
import { LinkField } from '../components/LinkField';
import { RoomBar } from '../components/RoomBar';
import { StateMessage } from '../components/StateMessage';
import { StatusPill } from '../components/StatusPill';
import { ViewerList } from '../components/ViewerList';
import { useDisplayName } from '../hooks/useDisplayName';
import { useHostSession } from '../hooks/useHostSession';
import {
  CAPTURE_STUCK_MESSAGE,
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
        <h1 className="sr-only">Sua sala</h1>
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
    <Layout fill>
      <RoomBar name={name} onRename={rename}>
        {state === 'live' && <StatusPill tone="live" label="Ao vivo" />}
        {state === 'connecting' && <StatusPill tone="neutral" label={CONNECTING_MESSAGE} />}
        {state === 'reconnecting' && <StatusPill tone="warning" label={RECONNECTING_MESSAGE} />}
      </RoomBar>
      <h1 className="sr-only">Sua sala</h1>

      <div className="room-grid">
        <div className="stage">
          <div className="stage__screen">
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
          </div>
          <div className="stage__bar">
            {session.previewStream ? (
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
            {state === 'starting' && (
              <Button variant="secondary" icon="close" onClick={session.cancelStarting}>
                Cancelar
              </Button>
            )}
            {session.captureSlow && (
              <Button
                variant="secondary"
                icon="mute"
                onClick={() => {
                  session.cancelStarting();
                  void session.startSharing({ audio: false });
                }}
              >
                Compartilhar sem som
              </Button>
            )}
            <Button variant="danger" icon="close" onClick={session.endRoom} disabled={!inRoom}>
              Encerrar sala
            </Button>
          </div>
        </div>

        <aside className="room-side">
          <div className="stack" aria-live="polite">
            {!supported && <Callout tone="error">{UNSUPPORTED_BROWSER_MESSAGE}</Callout>}
            {session.error && <Callout tone="error">{session.error}</Callout>}
            {session.captureSlow && <Callout tone="info">{CAPTURE_STUCK_MESSAGE}</Callout>}
            {session.audioMissing && <Callout tone="info">{NO_AUDIO_SHARED_MESSAGE}</Callout>}
          </div>
          <Card title="Link da sala">
            <LinkField link={link} />
          </Card>
          <ViewerList
            viewers={session.viewers.map(({ viewerId, name }) => ({ id: viewerId, name }))}
            maxViewers={session.maxViewers}
            emptyText="Ninguém assistindo ainda. Envie o link da sala."
            hint={
              session.maxViewers === null
                ? undefined
                : `Até ${session.maxViewers} espectadores ao mesmo tempo.`
            }
          />
        </aside>
      </div>
    </Layout>
  );
}
