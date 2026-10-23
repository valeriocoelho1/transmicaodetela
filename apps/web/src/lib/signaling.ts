import type { ClientToServerEvents, ServerToClientEvents } from '@app/shared';
import { io, type Socket } from 'socket.io-client';

export type SignalingSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createSignalingSocket(): SignalingSocket {
  return io({ autoConnect: false });
}
