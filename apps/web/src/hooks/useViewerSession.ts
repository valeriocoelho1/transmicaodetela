import { useCallback, useEffect, useRef, useState } from 'react';
import { type EndReason, type PublicViewer, ROOM_ID_REGEX } from '@app/shared';
import { SERVER_DROP_RETRY_MS } from '../config';
import { createSignalingSocket, type SignalingSocket } from '../lib/signaling';
import { ViewerReceiver } from '../lib/webrtc/viewer-receiver';

export type ViewerState =
  | 'connecting'
  | 'not_found'
  | 'full'
  | 'waiting'
  | 'watching'
  | 'reconnecting'
  | 'failed'
  | 'ended';

interface Session {
  socket: SignalingSocket;
  receiver: ViewerReceiver;
}

export function useViewerSession(roomId: string, name: string) {
  const validRoomId = ROOM_ID_REGEX.test(roomId);
  const [state, setStateValue] = useState<ViewerState>(validRoomId ? 'connecting' : 'not_found');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [endedReason, setEndedReason] = useState<EndReason | null>(null);
  const [hostName, setHostName] = useState<string | null>(null);
  const [viewers, setViewers] = useState<PublicViewer[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [maxViewers, setMaxViewers] = useState<number | null>(null);
  const stateRef = useRef<ViewerState>(state);
  const sessionRef = useRef<Session | null>(null);
  const nameRef = useRef(name);
  const joinedRef = useRef(false);

  const setState = useCallback((next: ViewerState) => {
    stateRef.current = next;
    setStateValue(next);
  }, []);

  useEffect(() => {
    if (!validRoomId) {
      setState('not_found');
      return;
    }
    let cancelled = false;
    const isFinal = () => ['ended', 'not_found', 'full'].includes(stateRef.current) || cancelled;
    setState('connecting');
    const socket = createSignalingSocket();
    const receiver = new ViewerReceiver({
      answer: (sdp) => socket.emit('signal:answer', { sdp }),
      ice: (candidate) => socket.emit('signal:ice', { candidate }),
      stream: (next) => {
        if (cancelled) return;
        setStream(next);
        setHasAudio(Boolean(next && next.getAudioTracks().length > 0));
      },
      connected: () => {
        if (!isFinal()) setState('watching');
      },
      failed: () => {
        if (!isFinal()) setState('failed');
      },
    });
    sessionRef.current = { socket, receiver };

    socket.on('room:host-name', ({ name: next }) => setHostName(next));
    socket.on('room:viewers', ({ viewers: next }) => setViewers(next));
    socket.on('room:status', ({ live }) => {
      if (isFinal() || live) return;
      receiver.close();
      setState('waiting');
    });
    socket.on('signal:offer', ({ sdp }) => {
      if (!isFinal()) void receiver.handleOffer(sdp);
    });
    socket.on('signal:ice', (payload) => {
      if (!('viewerId' in payload)) void receiver.handleIce(payload.candidate);
    });
    socket.on('room:ended', ({ reason }) => {
      if (cancelled) return;
      receiver.close();
      setEndedReason(reason);
      setState('ended');
    });
    socket.on('disconnect', (reason) => {
      joinedRef.current = false;
      if (isFinal()) return;
      receiver.close();
      if (reason === 'io client disconnect') return;
      setState('reconnecting');
      // The server ends a room with room:ended first; a bare server disconnect means a limit
      // was hit, and Socket.IO does not retry those on its own.
      if (reason === 'io server disconnect') {
        setTimeout(() => {
          if (!isFinal()) socket.connect();
        }, SERVER_DROP_RETRY_MS);
      }
    });
    socket.on('connect', async () => {
      const ack = await socket.emitWithAck('viewer:join', { roomId, name: nameRef.current });
      if (isFinal()) return;
      if (!ack.ok) {
        setState(ack.error === 'ROOM_FULL' ? 'full' : 'not_found');
        socket.disconnect();
        return;
      }
      joinedRef.current = true;
      receiver.setIceServers(ack.iceServers);
      setHostName(ack.hostName);
      setViewers(ack.viewers);
      setSelfId(ack.selfId);
      setMaxViewers(ack.maxViewers);
      setState('waiting');
    });
    socket.connect();

    return () => {
      cancelled = true;
      socket.removeAllListeners();
      socket.disconnect();
      receiver.close();
      sessionRef.current = null;
    };
  }, [roomId, validRoomId, setState]);

  useEffect(() => {
    if (nameRef.current === name) return;
    nameRef.current = name;
    if (joinedRef.current) sessionRef.current?.socket.emit('user:rename', { name });
  }, [name]);

  const retry = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    session.receiver.close();
    session.socket.disconnect();
    setState('connecting');
    session.socket.connect();
  }, [setState]);

  return {
    state,
    stream,
    hasAudio,
    endedReason,
    hostName,
    viewers,
    selfId,
    maxViewers,
    retry,
  };
}
