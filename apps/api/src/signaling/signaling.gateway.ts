import { Inject, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  answerPayload,
  type ClientToServerEvents,
  type EndReason,
  hostJoinPayload,
  type HostJoinAck,
  hostLivePayload,
  iceFromHostPayload,
  iceFromViewerPayload,
  offerPayload,
  renamePayload,
  type ServerToClientEvents,
  viewerJoinPayload,
  type ViewerJoinAck,
} from '@app/shared';
import type { Server, Socket } from 'socket.io';
import { APP_CONFIG, type AppConfig, CLOCK, type Clock } from '../config/app-config';
import { RoomsService } from '../rooms/rooms.service';
import { ConnectionLimiter } from './connection-limiter';
import { IceService } from './ice.service';

interface SocketData {
  role?: 'host' | 'viewer';
  roomId?: string;
  viewerId?: string;
  // Set when the client itself closed the connection (left the page) instead of losing it.
  leftOnPurpose?: boolean;
}

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>;

const shortId = (roomId: string) => `${roomId.slice(0, 4)}…`;

@WebSocketGateway()
export class SignalingGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SignalingGateway.name);
  private sweepTimer: NodeJS.Timeout | undefined;

  @WebSocketServer()
  private readonly server!: AppServer;

  constructor(
    private readonly rooms: RoomsService,
    private readonly ice: IceService,
    private readonly limiter: ConnectionLimiter,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  onModuleInit(): void {
    this.sweepTimer = setInterval(() => this.sweep(), this.config.sweepIntervalMs);
    this.sweepTimer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.sweepTimer);
  }

  handleConnection(socket: AppSocket): void {
    if (!this.limiter.acquire(socket.id, this.limiter.ipOf(socket.request))) {
      this.logger.warn('Too many sockets from one address; disconnecting');
      socket.disconnect(true);
      return;
    }
    socket.on('disconnecting', (reason) => {
      if (reason === 'client namespace disconnect') socket.data.leftOnPurpose = true;
    });
    let windowStart = this.now();
    let count = 0;
    socket.use((_packet, next) => {
      const now = this.now();
      if (now - windowStart >= this.config.socketRateLimitWindowMs) {
        windowStart = now;
        count = 0;
      }
      count += 1;
      if (count > this.config.socketRateLimitEvents) {
        this.logger.warn('Socket exceeded the event rate limit; disconnecting');
        socket.disconnect(true);
        return;
      }
      next();
    });
  }

  handleDisconnect(socket: AppSocket): void {
    this.limiter.release(socket.id);
    this.leave(socket);
  }

  @SubscribeMessage('host:join')
  hostJoin(@ConnectedSocket() socket: AppSocket, @MessageBody() body: unknown): HostJoinAck {
    const parsed = hostJoinPayload.safeParse(body);
    if (!parsed.success) return { ok: false, error: 'INVALID_PAYLOAD' };
    const { roomId, hostToken, name } = parsed.data;
    if (!this.rooms.get(roomId)) return { ok: false, error: 'ROOM_NOT_FOUND' };
    if (!this.rooms.verifyHost(roomId, hostToken)) return { ok: false, error: 'INVALID_TOKEN' };

    if (socket.data.roomId) this.leave(socket, true);
    const { previousSocketId } = this.rooms.attachHost(roomId, socket.id, name);
    socket.data = { role: 'host', roomId };
    if (previousSocketId) {
      const previous = this.socket(previousSocketId);
      if (previous) {
        previous.data = {};
        previous.emit('room:host-replaced');
        previous.disconnect(true);
      }
      this.logger.log(`Room ${shortId(roomId)} host replaced`);
    }
    this.logger.log(`Room ${shortId(roomId)} host joined`);
    this.emitHost(roomId);
    return {
      ok: true,
      iceServers: this.ice.iceServers(),
      viewers: this.rooms.viewerList(roomId),
      maxViewers: this.config.maxViewersPerRoom,
    };
  }

  @SubscribeMessage('host:live')
  hostLive(@ConnectedSocket() socket: AppSocket, @MessageBody() body: unknown): void {
    const roomId = this.hostRoom(socket);
    if (!roomId) return;
    const parsed = hostLivePayload.safeParse(body);
    if (!parsed.success) return this.dropInvalid('host:live');
    this.rooms.setLive(roomId, parsed.data.live);
    this.emitToViewers(roomId, 'room:status', { live: parsed.data.live });
  }

  @SubscribeMessage('host:end')
  hostEnd(@ConnectedSocket() socket: AppSocket): void {
    const roomId = this.hostRoom(socket);
    if (!roomId) return;
    socket.data = {};
    this.endRoom(roomId, 'HOST_ENDED');
  }

  @SubscribeMessage('viewer:join')
  viewerJoin(@ConnectedSocket() socket: AppSocket, @MessageBody() body: unknown): ViewerJoinAck {
    const parsed = viewerJoinPayload.safeParse(body);
    if (!parsed.success) return { ok: false, error: 'INVALID_PAYLOAD' };
    const { roomId, name } = parsed.data;
    if (!this.rooms.get(roomId)) return { ok: false, error: 'ROOM_NOT_FOUND' };

    if (socket.data.roomId) this.leave(socket, true);
    const { resume } = parsed.data;
    const resumed = resume
      ? this.rooms.resumeViewer(roomId, resume.viewerId, resume.token, socket.id)
      : null;
    let viewerId: string;
    let resumeToken: string;
    if (resume && resumed) {
      viewerId = resume.viewerId;
      resumeToken = resumed.resumeToken;
      const previous = resumed.previousSocketId ? this.socket(resumed.previousSocketId) : undefined;
      if (previous) {
        previous.data = {};
        previous.disconnect(true);
      }
    } else {
      const added = this.rooms.addViewer(roomId, socket.id, name);
      if (!added.ok) return added;
      viewerId = added.viewerId;
      resumeToken = added.resumeToken;
    }
    socket.data = { role: 'viewer', roomId, viewerId };

    const room = this.rooms.get(roomId);
    const self = room?.viewers.get(viewerId);
    // A resumed viewer whose video connection survived needs nothing from the host.
    if (room?.hostSocketId && (!resumed || resume?.needsOffer)) {
      this.server.to(room.hostSocketId).emit('viewer:joined', { viewerId, name: self?.name ?? '' });
    }
    if (!resumed) {
      this.emitViewerList(roomId, socket.id);
      this.logger.log(
        `Room ${shortId(roomId)} viewer joined (viewers: ${room?.viewers.size ?? 0})`,
      );
    } else {
      this.logger.log(`Room ${shortId(roomId)} viewer resumed`);
    }
    return {
      ok: true,
      viewerId,
      resumeToken,
      resumed: resumed !== null,
      iceServers: this.ice.iceServers(),
      live: room?.live ?? false,
      host: { name: room?.hostName ?? '', online: Boolean(room?.hostSocketId) },
      selfId: self?.publicId ?? '',
      viewers: this.rooms.publicViewerList(roomId),
      maxViewers: this.config.maxViewersPerRoom,
    };
  }

  @SubscribeMessage('user:rename')
  rename(@ConnectedSocket() socket: AppSocket, @MessageBody() body: unknown): void {
    const parsed = renamePayload.safeParse(body);
    const hostRoomId = this.hostRoom(socket);
    const viewer = this.viewerRoom(socket);
    if (!hostRoomId && !viewer) return;
    if (!parsed.success) return this.dropInvalid('user:rename');
    const { name } = parsed.data;
    if (hostRoomId) {
      this.rooms.renameHost(hostRoomId, name);
      this.emitHost(hostRoomId);
      return;
    }
    if (viewer && this.rooms.renameViewer(viewer.roomId, viewer.viewerId, name)) {
      const hostSocketId = this.rooms.get(viewer.roomId)?.hostSocketId;
      if (hostSocketId) {
        this.server.to(hostSocketId).emit('viewer:renamed', { viewerId: viewer.viewerId, name });
      }
      this.emitViewerList(viewer.roomId);
    }
  }

  @SubscribeMessage('signal:offer')
  offer(@ConnectedSocket() socket: AppSocket, @MessageBody() body: unknown): void {
    const roomId = this.hostRoom(socket);
    if (!roomId) return;
    const parsed = offerPayload.safeParse(body);
    if (!parsed.success) return this.dropInvalid('signal:offer');
    const target = this.rooms.viewerSocketId(roomId, parsed.data.viewerId);
    if (target) this.server.to(target).emit('signal:offer', { sdp: parsed.data.sdp });
  }

  @SubscribeMessage('signal:answer')
  answer(@ConnectedSocket() socket: AppSocket, @MessageBody() body: unknown): void {
    const viewer = this.viewerRoom(socket);
    if (!viewer) return;
    const parsed = answerPayload.safeParse(body);
    if (!parsed.success) return this.dropInvalid('signal:answer');
    const hostSocketId = this.rooms.get(viewer.roomId)?.hostSocketId;
    if (hostSocketId) {
      this.server
        .to(hostSocketId)
        .emit('signal:answer', { viewerId: viewer.viewerId, sdp: parsed.data.sdp });
    }
  }

  @SubscribeMessage('signal:ice')
  iceCandidate(@ConnectedSocket() socket: AppSocket, @MessageBody() body: unknown): void {
    const hostRoomId = this.hostRoom(socket);
    if (hostRoomId) {
      const parsed = iceFromHostPayload.safeParse(body);
      if (!parsed.success) return this.dropInvalid('signal:ice');
      const target = this.rooms.viewerSocketId(hostRoomId, parsed.data.viewerId);
      if (target) this.server.to(target).emit('signal:ice', { candidate: parsed.data.candidate });
      return;
    }
    const viewer = this.viewerRoom(socket);
    if (!viewer) return;
    const parsed = iceFromViewerPayload.safeParse(body);
    if (!parsed.success) return this.dropInvalid('signal:ice');
    const hostSocketId = this.rooms.get(viewer.roomId)?.hostSocketId;
    if (hostSocketId) {
      this.server
        .to(hostSocketId)
        .emit('signal:ice', { viewerId: viewer.viewerId, candidate: parsed.data.candidate });
    }
  }

  sweep(): void {
    for (const { roomId, reason } of this.rooms.findExpired(this.now())) {
      const hostSocketId = this.rooms.get(roomId)?.hostSocketId;
      const host = hostSocketId ? this.socket(hostSocketId) : undefined;
      if (host) {
        host.data = {};
        host.emit('room:ended', { reason });
        host.disconnect(true);
      }
      this.endRoom(roomId, reason);
    }
  }

  private endRoom(roomId: string, reason: EndReason): void {
    for (const socketId of this.rooms.end(roomId)) {
      const viewer = this.socket(socketId);
      if (!viewer) continue;
      viewer.data = {};
      viewer.emit('room:ended', { reason });
      viewer.disconnect(true);
    }
    this.logger.log(`Room ${shortId(roomId)} ended (${reason}, ${this.rooms.count} active)`);
  }

  // A lost connection keeps the seat and the video connection, which runs between the browsers,
  // so the client can come back without the video stopping. Leaving on purpose ends it now.
  private leave(socket: AppSocket, onPurpose = socket.data.leftOnPurpose ?? false): void {
    const { role, roomId, viewerId } = socket.data;
    socket.data = {};
    if (!roomId) return;
    if (role === 'host') {
      if (this.rooms.detachHost(roomId, socket.id, onPurpose)) {
        if (onPurpose) this.emitToViewers(roomId, 'room:status', { live: false });
        this.emitHost(roomId);
        this.logger.log(`Room ${shortId(roomId)} host disconnected`);
      }
      return;
    }
    if (role !== 'viewer' || !viewerId) return;
    if (onPurpose) {
      if (this.rooms.removeViewer(roomId, viewerId)) this.viewerLeft(roomId, viewerId);
      return;
    }
    const disconnectedAt = this.rooms.detachViewer(roomId, viewerId, socket.id);
    if (disconnectedAt === null) return;
    this.logger.log(`Room ${shortId(roomId)} viewer away`);
    setTimeout(() => {
      if (this.rooms.expireViewer(roomId, viewerId, disconnectedAt)) {
        this.viewerLeft(roomId, viewerId);
      }
    }, this.config.viewerGraceMs).unref();
  }

  private viewerLeft(roomId: string, viewerId: string): void {
    const room = this.rooms.get(roomId);
    if (room?.hostSocketId) this.server.to(room.hostSocketId).emit('viewer:left', { viewerId });
    this.emitViewerList(roomId);
    this.logger.log(`Room ${shortId(roomId)} viewer left (viewers: ${room?.viewers.size ?? 0})`);
  }

  private hostRoom(socket: AppSocket): string | undefined {
    const { role, roomId } = socket.data;
    if (role !== 'host' || !roomId) return undefined;
    return this.rooms.get(roomId)?.hostSocketId === socket.id ? roomId : undefined;
  }

  private viewerRoom(socket: AppSocket): { roomId: string; viewerId: string } | undefined {
    const { role, roomId, viewerId } = socket.data;
    if (role !== 'viewer' || !roomId || !viewerId) return undefined;
    return this.rooms.viewerSocketId(roomId, viewerId) === socket.id
      ? { roomId, viewerId }
      : undefined;
  }

  private emitToViewers(roomId: string, event: 'room:status', payload: { live: boolean }): void {
    for (const socketId of this.rooms.viewerSocketIds(roomId)) {
      this.server.to(socketId).emit(event, payload);
    }
  }

  private emitViewerList(roomId: string, exceptSocketId?: string): void {
    const viewers = this.rooms.publicViewerList(roomId);
    for (const socketId of this.rooms.viewerSocketIds(roomId)) {
      if (socketId !== exceptSocketId) this.server.to(socketId).emit('room:viewers', { viewers });
    }
  }

  private emitHost(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const host = { name: room.hostName, online: room.hostSocketId !== null };
    for (const socketId of this.rooms.viewerSocketIds(roomId)) {
      this.server.to(socketId).emit('room:host', host);
    }
  }

  private socket(socketId: string): AppSocket | undefined {
    return this.server.sockets.sockets.get(socketId);
  }

  private dropInvalid(event: string): void {
    this.logger.debug(`Dropped invalid ${event} payload`);
  }
}
