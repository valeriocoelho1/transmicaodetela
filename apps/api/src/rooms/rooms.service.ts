import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  type EndReason,
  type ProfileEffect,
  type PublicViewer,
  ROOM_ID_REGEX,
  type RoomViewer,
} from '@app/shared';
import { APP_CONFIG, type AppConfig, CLOCK, type Clock } from '../config/app-config';

export interface Viewer {
  // null while the viewer is away; the seat is kept for VIEWER_GRACE_MS.
  socketId: string | null;
  publicId: string;
  name: string;
  effect: ProfileEffect;
  resumeTokenHash: Buffer;
  disconnectedAt: number | null;
}

export interface Room {
  id: string;
  hostTokenHash: Buffer;
  createdAt: number;
  hostEverJoined: boolean;
  hostSocketId: string | null;
  hostDisconnectedAt: number | null;
  hostName: string;
  hostEffect: ProfileEffect;
  live: boolean;
  viewers: Map<string, Viewer>;
}

export const DEFAULT_HOST_NAME = 'Anfitrião';
export const DEFAULT_VIEWER_NAME = 'Espectador';
export const DEFAULT_EFFECT: ProfileEffect = 'pulse';

export class RoomLimitReachedError extends Error {
  constructor() {
    super('Room limit reached');
  }
}

export type AddViewerResult =
  | { ok: true; viewerId: string; resumeToken: string }
  | { ok: false; error: 'ROOM_NOT_FOUND' | 'ROOM_FULL' };

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

@Injectable()
export class RoomsService {
  private readonly rooms = new Map<string, Room>();

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly now: Clock,
  ) {}

  get count(): number {
    return this.rooms.size;
  }

  create(): { roomId: string; hostToken: string } {
    if (this.rooms.size >= this.config.maxRooms) throw new RoomLimitReachedError();
    let roomId: string;
    do {
      roomId = randomBytes(9).toString('base64url');
    } while (this.rooms.has(roomId));
    const hostToken = randomBytes(32).toString('base64url');
    this.rooms.set(roomId, {
      id: roomId,
      hostTokenHash: sha256(hostToken),
      createdAt: this.now(),
      hostEverJoined: false,
      hostSocketId: null,
      hostDisconnectedAt: null,
      hostName: DEFAULT_HOST_NAME,
      hostEffect: DEFAULT_EFFECT,
      live: false,
      viewers: new Map(),
    });
    return { roomId, hostToken };
  }

  get(roomId: string): Room | undefined {
    if (!ROOM_ID_REGEX.test(roomId)) return undefined;
    return this.rooms.get(roomId);
  }

  verifyHost(roomId: string, token: string): boolean {
    const room = this.get(roomId);
    if (!room) return false;
    return timingSafeEqual(sha256(token), room.hostTokenHash);
  }

  attachHost(
    roomId: string,
    socketId: string,
    name?: string,
    effect?: ProfileEffect,
  ): { previousSocketId: string | null } {
    const room = this.get(roomId);
    if (!room) return { previousSocketId: null };
    const previous = room.hostSocketId;
    room.hostEverJoined = true;
    room.hostSocketId = socketId;
    if (name) room.hostName = name;
    if (effect) room.hostEffect = effect;
    room.hostDisconnectedAt = null;
    return { previousSocketId: previous !== socketId ? previous : null };
  }

  // A host that left on purpose stops the broadcast; one that lost the connection may still be
  // streaming to viewers directly, so the room stays live until it comes back or times out.
  detachHost(roomId: string, socketId: string, onPurpose: boolean): boolean {
    const room = this.get(roomId);
    if (!room || room.hostSocketId !== socketId) return false;
    room.hostSocketId = null;
    room.hostDisconnectedAt = this.now();
    if (onPurpose) room.live = false;
    return true;
  }

  setLive(roomId: string, live: boolean): boolean {
    const room = this.get(roomId);
    if (!room) return false;
    room.live = live;
    return true;
  }

  addViewer(
    roomId: string,
    socketId: string,
    name = DEFAULT_VIEWER_NAME,
    effect: ProfileEffect = DEFAULT_EFFECT,
  ): AddViewerResult {
    const room = this.get(roomId);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    if (room.viewers.size >= this.config.maxViewersPerRoom)
      return { ok: false, error: 'ROOM_FULL' };
    const viewerId = randomUUID();
    const resumeToken = randomBytes(32).toString('base64url');
    room.viewers.set(viewerId, {
      socketId,
      publicId: randomBytes(6).toString('base64url'),
      name,
      effect,
      resumeTokenHash: sha256(resumeToken),
      disconnectedAt: null,
    });
    return { ok: true, viewerId, resumeToken };
  }

  // Gives the seat back to a viewer that proves it holds the resume token, even in a full room.
  // The token is rotated on every resume.
  resumeViewer(
    roomId: string,
    viewerId: string,
    token: string,
    socketId: string,
  ): { previousSocketId: string | null; resumeToken: string } | null {
    const viewer = this.get(roomId)?.viewers.get(viewerId);
    if (!viewer || !timingSafeEqual(sha256(token), viewer.resumeTokenHash)) return null;
    const previousSocketId = viewer.socketId !== socketId ? viewer.socketId : null;
    const resumeToken = randomBytes(32).toString('base64url');
    viewer.socketId = socketId;
    viewer.disconnectedAt = null;
    viewer.resumeTokenHash = sha256(resumeToken);
    return { previousSocketId, resumeToken };
  }

  detachViewer(roomId: string, viewerId: string, socketId: string): number | null {
    const viewer = this.get(roomId)?.viewers.get(viewerId);
    if (!viewer || viewer.socketId !== socketId) return null;
    viewer.socketId = null;
    viewer.disconnectedAt = this.now();
    return viewer.disconnectedAt;
  }

  // Removes a viewer that is still away since `disconnectedAt`; false if it came back.
  expireViewer(roomId: string, viewerId: string, disconnectedAt: number): boolean {
    const room = this.get(roomId);
    const viewer = room?.viewers.get(viewerId);
    if (!room || !viewer || viewer.disconnectedAt !== disconnectedAt) return false;
    return room.viewers.delete(viewerId);
  }

  updateHost(roomId: string, name: string, effect: ProfileEffect): void {
    const room = this.get(roomId);
    if (!room) return;
    room.hostName = name;
    room.hostEffect = effect;
  }

  updateViewer(roomId: string, viewerId: string, name: string, effect: ProfileEffect): boolean {
    const viewer = this.get(roomId)?.viewers.get(viewerId);
    if (!viewer) return false;
    viewer.name = name;
    viewer.effect = effect;
    return true;
  }

  viewerList(roomId: string): RoomViewer[] {
    return [...(this.get(roomId)?.viewers ?? [])].map(([viewerId, { name, effect }]) => ({
      viewerId,
      name,
      effect,
    }));
  }

  publicViewerList(roomId: string): PublicViewer[] {
    return [...(this.get(roomId)?.viewers.values() ?? [])].map(({ publicId, name, effect }) => ({
      id: publicId,
      name,
      effect,
    }));
  }

  removeViewer(roomId: string, viewerId: string): boolean {
    return this.get(roomId)?.viewers.delete(viewerId) ?? false;
  }

  viewerSocketId(roomId: string, viewerId: string): string | undefined {
    return this.get(roomId)?.viewers.get(viewerId)?.socketId ?? undefined;
  }

  viewerSocketIds(roomId: string): string[] {
    const ids: string[] = [];
    for (const { socketId } of this.get(roomId)?.viewers.values() ?? []) {
      if (socketId) ids.push(socketId);
    }
    return ids;
  }

  end(roomId: string): string[] {
    if (!this.get(roomId)) return [];
    const socketIds = this.viewerSocketIds(roomId);
    this.rooms.delete(roomId);
    return socketIds;
  }

  findExpired(now: number = this.now()): { roomId: string; reason: EndReason }[] {
    const expired: { roomId: string; reason: EndReason }[] = [];
    for (const room of this.rooms.values()) {
      if (now - room.createdAt >= this.config.roomMaxAgeMs) {
        expired.push({ roomId: room.id, reason: 'EXPIRED' });
      } else if (
        room.hostSocketId === null &&
        room.hostDisconnectedAt !== null &&
        now - room.hostDisconnectedAt >= this.config.roomHostGraceMs
      ) {
        expired.push({ roomId: room.id, reason: 'HOST_TIMEOUT' });
      } else if (!room.hostEverJoined && now - room.createdAt >= this.config.roomUnusedTtlMs) {
        expired.push({ roomId: room.id, reason: 'EXPIRED' });
      }
    }
    return expired;
  }

  summary(roomId: string): { live: boolean; viewerCount: number; maxViewers: number } | undefined {
    const room = this.get(roomId);
    if (!room) return undefined;
    return {
      live: room.live,
      viewerCount: room.viewers.size,
      maxViewers: this.config.maxViewersPerRoom,
    };
  }
}
