import { Link, useParams } from 'react-router';
import { Button } from '../components/Button';
import { Icon, type IconName } from '../components/Icon';
import { Layout } from '../components/Layout';
import { RemoteVideo } from '../components/RemoteVideo';
import { RoomBar } from '../components/RoomBar';
import { StateMessage } from '../components/StateMessage';
import { StatusPill } from '../components/StatusPill';
import { useDisplayName } from '../hooks/useDisplayName';
import { useViewerSession, type ViewerState } from '../hooks/useViewerSession';
import {
  CONNECTING_MESSAGE,
  END_REASON_MESSAGES,
  RECONNECTING_MESSAGE,
  ROOM_NOT_FOUND_MESSAGE,
} from '../lib/end-reason';

const stateIcons: Record<Exclude<ViewerState, 'watching'>, IconName> = {
  connecting: 'link',
  not_found: 'alert',
  full: 'users',
  waiting: 'clock',
  reconnecting: 'link',
  failed: 'alert',
  ended: 'stop',
};

export function ViewerPage() {
  const { roomId = '' } = useParams();
  const [name, rename] = useDisplayName();
  const { state, stream, hasAudio, endedReason, hostName, retry } = useViewerSession(roomId, name);
  const head = (
    <>
      <RoomBar name={name} onRename={rename} />
      <div className="page-head">
        <div className="page-head__title">
          <h1 className="page-title">Transmissão</h1>
          {hostName && <p className="page-subtitle">de {hostName}</p>}
        </div>
        {state === 'watching' && stream && <StatusPill tone="live" label="Ao vivo" />}
      </div>
    </>
  );

  if (state === 'watching' && stream) {
    return (
      <Layout>
        {head}
        <RemoteVideo stream={stream} hasAudio={hasAudio} />
      </Layout>
    );
  }

  const current = state === 'watching' ? 'waiting' : state;
  const message = {
    connecting: CONNECTING_MESSAGE,
    not_found: ROOM_NOT_FOUND_MESSAGE,
    full: 'A sala está cheia. Tente novamente mais tarde.',
    waiting: 'Aguardando o anfitrião iniciar a transmissão.',
    reconnecting: RECONNECTING_MESSAGE,
    failed: 'Não foi possível receber o vídeo. Verifique sua rede e tente novamente.',
    ended: endedReason ? END_REASON_MESSAGES[endedReason] : ROOM_NOT_FOUND_MESSAGE,
  }[current];
  const isFinal = current === 'not_found' || current === 'full' || current === 'ended';
  const isError = current === 'not_found' || current === 'failed' || current === 'full';
  const busy = current === 'connecting' || current === 'reconnecting' || current === 'waiting';

  return (
    <Layout>
      {head}
      <div className="stage">
        <div className="tv pixel-box">
          <div className="stage__frame">
            <StateMessage
              icon={stateIcons[current]}
              tone={isError ? 'error' : 'neutral'}
              busy={busy}
              message={message}
            >
              {current === 'failed' && (
                <Button variant="primary" onClick={retry}>
                  Tentar novamente
                </Button>
              )}
              {isFinal && (
                <Link className="btn btn--secondary" to="/">
                  <Icon name="arrowLeft" />
                  <span>Voltar ao início</span>
                </Link>
              )}
            </StateMessage>
          </div>
        </div>
      </div>
    </Layout>
  );
}
