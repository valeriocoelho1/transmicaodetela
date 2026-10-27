import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Avatar } from '../components/Avatar';
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
  HOST_AWAY_MESSAGE,
  HOST_RECONNECTING_LABEL,
  RECONNECTING_MESSAGE,
  ROOM_NOT_FOUND_MESSAGE,
  SIGNALING_LOST_LABEL,
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
  const { state, stream, endedReason, host } = session;
  const watching = state === 'watching' && stream !== null;
  const hostAway = host !== null && !host.online;

  const current = state === 'watching' ? 'waiting' : state;
  const message = {
    connecting: CONNECTING_MESSAGE,
    not_found: ROOM_NOT_FOUND_MESSAGE,
    full: 'A sala está cheia. Tente novamente mais tarde.',
    waiting: hostAway ? HOST_AWAY_MESSAGE : 'Aguardando o anfitrião iniciar a transmissão.',
    reconnecting: RECONNECTING_MESSAGE,
    failed: 'Não foi possível receber o vídeo. Verifique sua rede e tente novamente.',
    ended: endedReason ? END_REASON_MESSAGES[endedReason] : ROOM_NOT_FOUND_MESSAGE,
  }[current];
  const isFinal = current === 'not_found' || current === 'full' || current === 'ended';
  const isError = current === 'not_found' || current === 'failed' || current === 'full';
  const busy = current === 'connecting' || current === 'reconnecting' || current === 'waiting';
  const showList = !isFinal && session.selfId !== null;

  // On wide screens the list opens over the video from the top bar, so the stage keeps the full
  // width. On phones it sits below the video.
  const [listOpen, setListOpen] = useState(false);
  const listRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!listOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setListOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!listRef.current?.contains(target) && !toggleRef.current?.contains(target)) {
        setListOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [listOpen]);

  return (
    <Layout fill>
      <RoomBar name={name} onRename={rename}>
        <h1 className="room-bar__title">
          Transmissão
          {host?.name && <span className="room-bar__host"> de {host.name}</span>}
        </h1>
        {watching &&
          (session.signalingLost ? (
            <StatusPill tone="warning" label={SIGNALING_LOST_LABEL} />
          ) : hostAway ? (
            <StatusPill tone="warning" label={HOST_RECONNECTING_LABEL} />
          ) : (
            <StatusPill tone="live" label="Ao vivo" />
          ))}
        {showList && (
          <button
            ref={toggleRef}
            type="button"
            className="viewers-toggle"
            aria-expanded={listOpen}
            aria-controls="viewer-list-panel"
            onClick={() => setListOpen((open) => !open)}
          >
            <span className="viewers-toggle__avatars" aria-hidden="true">
              {session.viewers.slice(0, 3).map((viewer) => (
                <Avatar key={viewer.id} name={viewer.name} size={26} />
              ))}
            </span>
            <span>Espectadores</span>
            <span className="viewers-toggle__count">{session.viewers.length}</span>
          </button>
        )}
      </RoomBar>
      <div className={showList ? 'room-grid room-grid--viewer' : 'room-grid room-grid--single'}>
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
          <aside
            id="viewer-list-panel"
            ref={listRef}
            className={
              listOpen ? 'room-side room-side--popover is-open' : 'room-side room-side--popover'
            }
          >
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
