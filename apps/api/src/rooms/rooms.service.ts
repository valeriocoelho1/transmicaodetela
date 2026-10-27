import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { type EndReason, ROOM_ID_REGEX } from '@app/shared';
import { APP_CONFIG, type AppConfig, CLOCK, type Clock } from '../config/app-config';

export interface Viewer {
  socketId: string;
  publicId: string;
  name: string;
}

export interface Room {
  id: string;
  hostTokenHash: Buffer;
  createdAt: number;
  hostEverJoined: boolean;
  hostSocketId: string | null;
  hostDisconnectedAt: number | null;
  hostName: string;
  live: boolean;
  viewers: Map<string, Viewer>;
}

export const DEFAULT_HOST_NAME = 'Anfitrião';
export const DEFAULT_VIEWER_NAME = 'Espectador';

export class RoomLimitReachedError extends Error {
  constructor() {
    super('Room limit reached');
  }
}

export type AddViewerResult =
  { ok: true; viewerId: string } | { ok: false; error: 'ROOM_NOT_FOUND' | 'ROOM_FULL' };

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

  attachHost(roomId: string, socketId: string, name?: string): { previousSocketId: string | null } {
    const room = this.get(roomId);
    if (!room) return { previousSocketId: null };
    const previous = room.hostSocketId;
    room.hostEverJoined = true;
    room.hostSocketId = socketId;
    if (name) room.hostName = name;
    room.hostDisconnectedAt = null;
    return { previousSocketId: previous !== socketId ? previous : null };
  }

  detachHost(roomId: string, socketId: string): boolean {
    const room = this.get(roomId);
    if (!room || room.hostSocketId !== socketId) return false;
    room.hostSocketId = null;
    room.hostDisconnectedAt = this.now();
    room.live = false;
    return true;
  }

  setLive(roomId: string, live: boolean): boolean {
    const room = this.get(roomId);
    if (!room) return false;
    room.live = live;
    return true;
  }

  addViewer(roomId: string, socketId: string, name = DEFAULT_VIEWER_NAME): AddViewerResult {
    const room = this.get(roomId);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    if (room.viewers.size >= this.config.maxViewersPerRoom)
      return { ok: false, error: 'ROOM_FULL' };
    const viewerId = randomUUID();
    room.viewers.set(viewerId, { socketId, publicId: randomBytes(6).toString('base64url'), name });
    return { ok: true, viewerId };
  }

  renameHost(roomId: string, name: string): void {
    const room = this.get(roomId);
    if (room) room.hostName = name;
  }

  renameViewer(roomId: string, viewerId: string, name: string): boolean {
    const viewer = this.get(roomId)?.viewers.get(viewerId);
    if (!viewer) return false;
    viewer.name = name;
    return true;
  }

  viewerList(roomId: string): { viewerId: string; name: string }[] {
    return [...(this.get(roomId)?.viewers ?? [])].map(([viewerId, { name }]) => ({
      viewerId,
      name,
    }));
  }

  publicViewerList(roomId: string): { id: string; name: string }[] {
    return [...(this.get(roomId)?.viewers.values() ?? [])].map(({ publicId, name }) => ({
      id: publicId,
      name,
    }));
  }

  removeViewer(roomId: string, viewerId: string): boolean {
    return this.get(roomId)?.viewers.delete(viewerId) ?? false;
  }

  viewerSocketId(roomId: string, viewerId: string): string | undefined {
    return this.get(roomId)?.viewers.get(viewerId)?.socketId;
  }

  end(roomId: string): string[] {
    const room = this.get(roomId);
    if (!room) return [];
    this.rooms.delete(roomId);
    return [...room.viewers.values()].map((viewer) => viewer.socketId);
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
