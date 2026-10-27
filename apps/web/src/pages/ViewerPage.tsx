import { Link, useParams } from 'react-router';
import { Button } from '../components/Button';
import { Icon, type IconName } from '../components/Icon';
import { Layout } from '../components/Layout';
import { RemoteVideo } from '../components/RemoteVideo';
import { RoomBar } from '../components/RoomBar';
import { StateMessage } from '../components/StateMessage';
import { StatusPill } from '../components/StatusPill';
import { ViewerList } from '../components/ViewerList';
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
  const session = useViewerSession(roomId, name);
  const { state, stream, endedReason, hostName } = session;
  const watching = state === 'watching' && stream !== null;

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
  const showList = !isFinal && session.selfId !== null;

  return (
    <Layout fill>
      <RoomBar name={name} onRename={rename}>
        <h1 className="room-bar__title">
          Transmissão
          {hostName && <span className="room-bar__host"> de {hostName}</span>}
        </h1>
        {watching && <StatusPill tone="live" label="Ao vivo" />}
      </RoomBar>
      <div className={showList ? 'room-grid' : 'room-grid room-grid--single'}>
        {watching ? (
          <RemoteVideo stream={stream} hasAudio={session.hasAudio} />
        ) : (
          <div className="stage">
            <div className="stage__screen">
              <div className="tv pixel-box">
                <div className="stage__frame">
                  <StateMessage
                    icon={stateIcons[current]}
                    tone={isError ? 'error' : 'neutral'}
                    busy={busy}
                    message={message}
                  >
                    {current === 'failed' && (
                      <Button variant="primary" onClick={session.retry}>
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
                <div className="tv__knobs" aria-hidden="true">
                  <span />
                  <span />
                </div>
              </div>
            </div>
          </div>
        )}
        {showList && (
          <aside className="room-side">
            <ViewerList
              viewers={session.viewers}
              maxViewers={session.maxViewers}
              selfId={session.selfId}
              emptyText="Ninguém na sala ainda."
            />
          </aside>
        )}
      </div>
    </Layout>
  );
}
