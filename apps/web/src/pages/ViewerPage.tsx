import { useParams } from 'react-router';
import { Layout } from '../components/Layout';
import { RemoteVideo } from '../components/RemoteVideo';
import { StatusPill } from '../components/StatusPill';
import { useViewerSession } from '../hooks/useViewerSession';
import {
  CONNECTING_MESSAGE,
  END_REASON_MESSAGES,
  RECONNECTING_MESSAGE,
  ROOM_NOT_FOUND_MESSAGE,
} from '../lib/end-reason';

export function ViewerPage() {
  const { roomId = '' } = useParams();
  const { state, stream, hasAudio, endedReason, retry } = useViewerSession(roomId);

  const message = {
    connecting: CONNECTING_MESSAGE,
    not_found: ROOM_NOT_FOUND_MESSAGE,
    full: 'A sala está cheia. Tente novamente mais tarde.',
    waiting: 'Aguardando o anfitrião iniciar a transmissão.',
    watching: null,
    reconnecting: RECONNECTING_MESSAGE,
    failed: 'Não foi possível receber o vídeo. Verifique sua rede e tente novamente.',
    ended: endedReason ? END_REASON_MESSAGES[endedReason] : ROOM_NOT_FOUND_MESSAGE,
  }[state];

  return (
    <Layout>
      <h1>Compartilhar tela</h1>
      {state === 'watching' && <StatusPill tone="live" label="Ao vivo" />}
      <p aria-live="polite">{message}</p>
      {state === 'failed' && (
        <button type="button" onClick={retry}>
          Tentar novamente
        </button>
      )}
      {state === 'watching' && stream && <RemoteVideo stream={stream} hasAudio={hasAudio} />}
    </Layout>
  );
}
