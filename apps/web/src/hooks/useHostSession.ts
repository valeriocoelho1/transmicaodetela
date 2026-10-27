import { useCallback, useEffect, useRef, useState } from 'react';
import type { EndReason, RoomViewer } from '@app/shared';
import { captureErrorMessage, startDisplayCapture } from '../lib/capture';
import { clearHostToken, getHostToken } from '../lib/host-token';
import { createSignalingSocket, type SignalingSocket } from '../lib/signaling';
import { HostBroadcaster } from '../lib/webrtc/host-broadcaster';

export type HostState =
  | 'connecting'
  | 'forbidden'
  | 'not_found'
  | 'ready'
  | 'starting'
  | 'live'
  | 'reconnecting'
  | 'ended';

export type HostEndedReason = EndReason | 'HOST_REPLACED';

interface Session {
  socket: SignalingSocket;
  broadcaster: HostBroadcaster;
}

export function useHostSession(roomId: string, name: string) {
  const [state, setStateValue] = useState<HostState>('connecting');
  const [viewers, setViewers] = useState<RoomViewer[]>([]);
  const [maxViewers, setMaxViewers] = useState<number | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [audioMissing, setAudioMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasShared, setHasShared] = useState(false);
  const [endedReason, setEndedReason] = useState<HostEndedReason | null>(null);

  const stateRef = useRef<HostState>('connecting');
  const sessionRef = useRef<Session | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nameRef = useRef(name);
  const joinedRef = useRef(false);

  const setState = useCallback((next: HostState) => {
    stateRef.current = next;
    setStateValue(next);
  }, []);

  const releaseStream = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
    setPreviewStream(null);
    setAudioMissing(false);
  }, []);

  const finish = useCallback(
    (reason: HostEndedReason) => {
      releaseStream();
      sessionRef.current?.broadcaster.dispose();
      setEndedReason(reason);
      setState('ended');
    },
    [releaseStream, setState],
  );

  useEffect(() => {
    const hostToken = getHostToken(roomId);
    if (!hostToken) {
      setState('forbidden');
      return;
    }
    let cancelled = false;
    setState('connecting');
    const socket = createSignalingSocket();
    const broadcaster = new HostBroadcaster({
      offer: (viewerId, sdp) => socket.emit('signal:offer', { viewerId, sdp }),
      ice: (viewerId, candidate) => socket.emit('signal:ice', { viewerId, candidate }),
      peerFailed: () => undefined,
    });
    sessionRef.current = { socket, broadcaster };

    socket.on('viewer:joined', (viewer) => {
      broadcaster.addViewer(viewer.viewerId);
      setViewers((list) => [...list.filter((v) => v.viewerId !== viewer.viewerId), viewer]);
    });
    socket.on('viewer:renamed', (viewer) => {
      setViewers((list) => list.map((v) => (v.viewerId === viewer.viewerId ? viewer : v)));
    });
    socket.on('viewer:left', ({ viewerId }) => {
      broadcaster.removeViewer(viewerId);
      setViewers((list) => list.filter((v) => v.viewerId !== viewerId));
    });
    socket.on('signal:answer', ({ viewerId, sdp }) => void broadcaster.handleAnswer(viewerId, sdp));
    socket.on('signal:ice', (payload) => {
      if ('viewerId' in payload) void broadcaster.handleIce(payload.viewerId, payload.candidate);
    });
    socket.on('room:host-replaced', () => {
      if (!cancelled) finish('HOST_REPLACED');
    });
    socket.on('room:ended', ({ reason }) => {
      if (!cancelled) finish(reason);
    });
    socket.on('disconnect', (reason) => {
      joinedRef.current = false;
      if (cancelled || stateRef.current === 'ended') return;
      if (reason === 'io server disconnect') finish('HOST_ENDED');
      else setState('reconnecting');
    });
    socket.on('connect', async () => {
      const ack = await socket.emitWithAck('host:join', {
        roomId,
        hostToken,
        name: nameRef.current,
      });
      if (cancelled || stateRef.current === 'ended') return;
      if (!ack.ok) {
        setState('not_found');
        socket.disconnect();
        return;
      }
      joinedRef.current = true;
      broadcaster.setIceServers(ack.iceServers);
      broadcaster.setViewers(ack.viewers.map((viewer) => viewer.viewerId));
      setViewers(ack.viewers);
      setMaxViewers(ack.maxViewers);
      if (streamRef.current) {
        broadcaster.rebuildAll();
        socket.emit('host:live', { live: true });
        setState('live');
      } else if (stateRef.current !== 'starting') {
        setState('ready');
      }
    });
    socket.connect();

    return () => {
      cancelled = true;
      socket.removeAllListeners();
      socket.disconnect();
      broadcaster.dispose();
      sessionRef.current = null;
      const stream = streamRef.current;
      streamRef.current = null;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [roomId, finish, setState]);

  useEffect(() => {
    if (nameRef.current === name) return;
    nameRef.current = name;
    if (joinedRef.current) sessionRef.current?.socket.emit('user:rename', { name });
  }, [name]);

  const stopSharing = useCallback(() => {
    if (!streamRef.current) return;
    releaseStream();
    const session = sessionRef.current;
    session?.broadcaster.stop();
    if (session?.socket.connected) session.socket.emit('host:live', { live: false });
    if (stateRef.current === 'live') setState('ready');
  }, [releaseStream, setState]);

  const startSharing = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || stateRef.current !== 'ready') return;
    setError(null);
    setState('starting');
    const stillStarting = () => stateRef.current === 'starting';
    let stream: MediaStream;
    try {
      stream = await startDisplayCapture();
    } catch (captureError) {
      if (stillStarting()) {
        setError(captureErrorMessage(captureError));
        setState('ready');
      }
      return;
    }
    if (!stillStarting() || sessionRef.current !== session) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    streamRef.current = stream;
    setPreviewStream(stream);
    setHasShared(true);
    setAudioMissing(stream.getAudioTracks().length === 0);
    stream.getVideoTracks()[0]?.addEventListener('ended', stopSharing);
    session.broadcaster.start(stream);
    session.socket.emit('host:live', { live: true });
    setState('live');
  }, [setState, stopSharing]);

  const endRoom = useCallback(() => {
    const session = sessionRef.current;
    session?.socket.emit('host:end');
    clearHostToken(roomId);
    finish('HOST_ENDED');
    session?.socket.disconnect();
  }, [finish, roomId]);

  return {
    state,
    viewers,
    maxViewers,
    previewStream,
    audioMissing,
    error,
    hasShared,
    endedReason,
    startSharing,
    stopSharing,
    endRoom,
  };
}
