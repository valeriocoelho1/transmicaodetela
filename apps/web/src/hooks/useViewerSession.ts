import { useCallback, useEffect, useRef, useState } from 'react';
import { type EndReason, type PublicViewer, ROOM_ID_REGEX, type RoomHost } from '@app/shared';
import { SERVER_DROP_RETRY_MS } from '../config';
import { createSignalingSocket, type SignalingSocket } from '../lib/signaling';
import { ViewerReceiver } from '../lib/webrtc/viewer-receiver';
import type { Profile } from './useProfile';

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

export function useViewerSession(roomId: string, profile: Profile) {
  const validRoomId = ROOM_ID_REGEX.test(roomId);
  const [state, setStateValue] = useState<ViewerState>(validRoomId ? 'connecting' : 'not_found');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [endedReason, setEndedReason] = useState<EndReason | null>(null);
  const [host, setHost] = useState<RoomHost | null>(null);
  // True while the connection to the server is down but the video keeps playing.
  const [signalingLost, setSignalingLost] = useState(false);
  const [viewers, setViewers] = useState<PublicViewer[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [maxViewers, setMaxViewers] = useState<number | null>(null);
  const stateRef = useRef<ViewerState>(state);
  const sessionRef = useRef<Session | null>(null);
  const profileRef = useRef(profile);
  const joinedRef = useRef(false);
  const hostOnlineRef = useRef(true);
  // Kept only in memory: it lets this page take its seat back after a dropped connection.
  const resumeRef = useRef<{ viewerId: string; token: string } | null>(null);

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
        if (isFinal()) return;
        // Without the host there is nobody to send a new offer; wait for it to come back.
        if (hostOnlineRef.current) {
          setState('failed');
        } else {
          receiver.close();
          setState('waiting');
        }
      },
    });
    sessionRef.current = { socket, receiver };

    const updateHost = (next: RoomHost) => {
      hostOnlineRef.current = next.online;
      setHost(next);
    };

    socket.on('room:host', updateHost);
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
      if (isFinal() || reason === 'io client disconnect') return;
      // The video runs between the browsers, so it keeps playing while the server is away.
      if (stateRef.current === 'watching') {
        setSignalingLost(true);
      } else {
        receiver.close();
        setState('reconnecting');
      }
      // The server ends a room with room:ended first; a bare server disconnect means a limit
      // was hit, and Socket.IO does not retry those on its own.
      if (reason === 'io server disconnect') {
        setTimeout(() => {
          if (!isFinal()) socket.connect();
        }, SERVER_DROP_RETRY_MS);
      }
    });
    socket.on('connect', async () => {
      const resume = resumeRef.current;
      const ack = await socket.emitWithAck('viewer:join', {
        roomId,
        ...profileRef.current,
        resume: resume ? { ...resume, needsOffer: !receiver.connected } : undefined,
      });
      if (isFinal()) return;
      if (!ack.ok) {
        setState(ack.error === 'ROOM_FULL' ? 'full' : 'not_found');
        socket.disconnect();
        return;
      }
      joinedRef.current = true;
      resumeRef.current = { viewerId: ack.viewerId, token: ack.resumeToken };
      setSignalingLost(false);
      receiver.setIceServers(ack.iceServers);
      updateHost(ack.host);
      setViewers(ack.viewers);
      setSelfId(ack.selfId);
      setMaxViewers(ack.maxViewers);
      // A profile change made while the connection was down never reached the server.
      const self = ack.viewers.find((viewer) => viewer.id === ack.selfId);
      const mine = profileRef.current;
      if (self && (self.name !== mine.name || self.effect !== mine.effect)) {
        socket.emit('user:profile', mine);
      }
      if (ack.resumed && ack.live && receiver.connected) return;
      // Otherwise a new offer is on its way (or will be once the host shares).
      receiver.close();
      setState('waiting');
    });
    socket.connect();

    // Closing or leaving the page frees the seat now instead of after the grace period.
    const leave = () => socket.disconnect();
    window.addEventListener('pagehide', leave);

    return () => {
      cancelled = true;
      window.removeEventListener('pagehide', leave);
      socket.removeAllListeners();
      socket.disconnect();
      receiver.close();
      sessionRef.current = null;
    };
  }, [roomId, validRoomId, setState]);

  useEffect(() => {
    const current = profileRef.current;
    if (current.name === profile.name && current.effect === profile.effect) return;
    profileRef.current = profile;
    if (joinedRef.current) sessionRef.current?.socket.emit('user:profile', profile);
  }, [profile]);

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
    host,
    signalingLost,
    viewers,
    selfId,
    maxViewers,
    retry,
  };
}
