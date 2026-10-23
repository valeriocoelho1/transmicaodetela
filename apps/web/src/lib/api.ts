import {
  type CreateRoomResponse,
  createRoomResponse,
  type RoomSummaryResponse,
  roomSummaryResponse,
} from '@app/shared';

export type ApiErrorKind = 'rate_limited' | 'server_busy' | 'unknown';

export class ApiError extends Error {
  constructor(readonly kind: ApiErrorKind) {
    super(`API request failed: ${kind}`);
  }
}

export async function createRoom(): Promise<CreateRoomResponse> {
  let res: Response;
  try {
    res = await fetch('/api/rooms', { method: 'POST' });
  } catch {
    throw new ApiError('unknown');
  }
  if (res.status === 429) throw new ApiError('rate_limited');
  if (res.status === 503) throw new ApiError('server_busy');
  if (!res.ok) throw new ApiError('unknown');
  const parsed = createRoomResponse.safeParse(await res.json());
  if (!parsed.success) throw new ApiError('unknown');
  return parsed.data;
}

export async function getRoom(roomId: string): Promise<RoomSummaryResponse | null> {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError('unknown');
  const parsed = roomSummaryResponse.safeParse(await res.json());
  if (!parsed.success) throw new ApiError('unknown');
  return parsed.data;
}
