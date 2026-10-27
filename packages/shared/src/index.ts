import { z } from 'zod';

export const ROOM_ID_REGEX = /^[A-Za-z0-9_-]{12}$/;
export const MAX_SDP_LENGTH = 32_768;
export const MAX_CANDIDATE_LENGTH = 2_048;
export const MAX_DISPLAY_NAME_LENGTH = 32;

export const healthResponse = z.object({
  status: z.literal('ok'),
});
export type HealthResponse = z.infer<typeof healthResponse>;

export const errorCode = z.enum([
  'ROOM_NOT_FOUND',
  'INVALID_TOKEN',
  'ROOM_FULL',
  'INVALID_PAYLOAD',
]);
export type ErrorCode = z.infer<typeof errorCode>;

export const endReason = z.enum(['HOST_ENDED', 'HOST_TIMEOUT', 'EXPIRED']);
export type EndReason = z.infer<typeof endReason>;

export type Ack<T extends object = object> = ({ ok: true } & T) | { ok: false; error: ErrorCode };

const roomId = z.string().regex(ROOM_ID_REGEX);
const viewerId = z.uuid();
const hostToken = z.string().min(20).max(128);
const resumeToken = z.string().min(20).max(128);
export const displayName = z
  .string()
  .trim()
  .min(1)
  .max(MAX_DISPLAY_NAME_LENGTH)
  .regex(/^[^\p{C}]+$/u);

const offerSdp = z.object({ type: z.literal('offer'), sdp: z.string().min(1).max(MAX_SDP_LENGTH) });
const answerSdp = z.object({
  type: z.literal('answer'),
  sdp: z.string().min(1).max(MAX_SDP_LENGTH),
});

export const iceCandidate = z.object({
  candidate: z.string().max(MAX_CANDIDATE_LENGTH),
  sdpMid: z.string().nullable().optional(),
  sdpMLineIndex: z.number().int().nonnegative().nullable().optional(),
  usernameFragment: z.string().nullable().optional(),
});

export const hostJoinPayload = z.object({ roomId, hostToken, name: displayName.optional() });
export const hostLivePayload = z.object({ live: z.boolean() });
export const viewerJoinPayload = z.object({
  roomId,
  name: displayName.optional(),
  // Sent after a dropped connection to keep the same seat and video connection.
  resume: z.object({ viewerId, token: resumeToken, needsOffer: z.boolean() }).optional(),
});
export const renamePayload = z.object({ name: displayName });
export const offerPayload = z.object({ viewerId, sdp: offerSdp });
export const answerPayload = z.object({ sdp: answerSdp });
export const iceFromHostPayload = z.object({ viewerId, candidate: iceCandidate });
export const iceFromViewerPayload = z.object({ candidate: iceCandidate });

export type OfferSdp = z.infer<typeof offerSdp>;
export type AnswerSdp = z.infer<typeof answerSdp>;
export type IceCandidate = z.infer<typeof iceCandidate>;
export type HostJoinPayload = z.infer<typeof hostJoinPayload>;
export type HostLivePayload = z.infer<typeof hostLivePayload>;
export type ViewerJoinPayload = z.infer<typeof viewerJoinPayload>;
export type RenamePayload = z.infer<typeof renamePayload>;
export type OfferPayload = z.infer<typeof offerPayload>;
export type AnswerPayload = z.infer<typeof answerPayload>;
export type IceFromHostPayload = z.infer<typeof iceFromHostPayload>;
export type IceFromViewerPayload = z.infer<typeof iceFromViewerPayload>;

export interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface RoomViewer {
  viewerId: string;
  name: string;
}

// What viewers see of each other: a display id that is useless for signaling, never the viewerId.
export interface PublicViewer {
  id: string;
  name: string;
}

export type HostJoinAck = Ack<{
  iceServers: IceServer[];
  viewers: RoomViewer[];
  maxViewers: number;
}>;
export interface RoomHost {
  name: string;
  online: boolean;
}

export type ViewerJoinAck = Ack<{
  viewerId: string;
  resumeToken: string;
  resumed: boolean;
  iceServers: IceServer[];
  live: boolean;
  host: RoomHost;
  selfId: string;
  viewers: PublicViewer[];
  maxViewers: number;
}>;

export interface ClientToServerEvents {
  'host:join': (payload: HostJoinPayload, ack: (res: HostJoinAck) => void) => void;
  'host:live': (payload: HostLivePayload) => void;
  'host:end': () => void;
  'viewer:join': (payload: ViewerJoinPayload, ack: (res: ViewerJoinAck) => void) => void;
  'user:rename': (payload: RenamePayload) => void;
  'signal:offer': (payload: OfferPayload) => void;
  'signal:answer': (payload: AnswerPayload) => void;
  'signal:ice': (payload: IceFromHostPayload | IceFromViewerPayload) => void;
}

export interface ServerToClientEvents {
  'viewer:joined': (payload: RoomViewer) => void;
  'viewer:renamed': (payload: RoomViewer) => void;
  'viewer:left': (payload: { viewerId: string }) => void;
  'room:host': (payload: RoomHost) => void;
  'room:viewers': (payload: { viewers: PublicViewer[] }) => void;
  'room:host-replaced': () => void;
  'room:status': (payload: { live: boolean }) => void;
  'room:ended': (payload: { reason: EndReason }) => void;
  'signal:offer': (payload: { sdp: OfferSdp }) => void;
  'signal:answer': (payload: { viewerId: string; sdp: AnswerSdp }) => void;
  'signal:ice': (
    payload: { viewerId: string; candidate: IceCandidate } | { candidate: IceCandidate },
  ) => void;
}

export const createRoomResponse = z.object({
  roomId,
  hostToken: z.string(),
});
export type CreateRoomResponse = z.infer<typeof createRoomResponse>;

export const roomSummaryResponse = z.object({
  roomId,
  live: z.boolean(),
  viewerCount: z.number().int().nonnegative(),
  maxViewers: z.number().int().positive(),
});
export type RoomSummaryResponse = z.infer<typeof roomSummaryResponse>;
