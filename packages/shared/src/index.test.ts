import { describe, expect, it } from 'vitest';
import {
  answerPayload,
  createRoomResponse,
  displayName,
  healthResponse,
  hostJoinPayload,
  hostLivePayload,
  iceFromHostPayload,
  iceFromViewerPayload,
  MAX_CANDIDATE_LENGTH,
  MAX_SDP_LENGTH,
  offerPayload,
  ROOM_ID_REGEX,
  roomSummaryResponse,
  viewerJoinPayload,
} from './index';

const roomId = 'aZ09_-aZ09_-';
const viewerId = '3b241101-e2bb-4255-8caf-4136c566a962';
const hostToken = 'x'.repeat(43);
const candidate = {
  candidate: 'candidate:1 1 udp 2122260223 192.0.2.1 54400 typ host',
  sdpMid: '0',
  sdpMLineIndex: 0,
  usernameFragment: 'abcd',
};

describe('healthResponse', () => {
  it('accepts { status: "ok" }', () => {
    expect(healthResponse.parse({ status: 'ok' })).toEqual({ status: 'ok' });
  });

  it('rejects any other payload', () => {
    expect(healthResponse.safeParse({ status: 'down' }).success).toBe(false);
    expect(healthResponse.safeParse({}).success).toBe(false);
    expect(healthResponse.safeParse(null).success).toBe(false);
  });
});

describe('ROOM_ID_REGEX', () => {
  it('accepts 12 base64url characters', () => {
    expect(ROOM_ID_REGEX.test(roomId)).toBe(true);
  });

  it('rejects wrong length or characters', () => {
    expect(ROOM_ID_REGEX.test('abc')).toBe(false);
    expect(ROOM_ID_REGEX.test('aaaaaaaaaaaaa')).toBe(false);
    expect(ROOM_ID_REGEX.test('aaaaaaaaaaa+')).toBe(false);
    expect(ROOM_ID_REGEX.test('aaaaaaaaaaa=')).toBe(false);
  });
});

describe('displayName', () => {
  it('trims and accepts names with accents and emoji', () => {
    expect(displayName.parse('  Capivara Curiosa ')).toBe('Capivara Curiosa');
    expect(displayName.parse('João 🎮')).toBe('João 🎮');
  });

  it('rejects empty, too long or control characters', () => {
    expect(displayName.safeParse('   ').success).toBe(false);
    expect(displayName.safeParse('x'.repeat(33)).success).toBe(false);
    expect(displayName.safeParse('a\nb').success).toBe(false);
  });
});

describe('signaling payloads', () => {
  it('accept valid payloads', () => {
    expect(hostJoinPayload.safeParse({ roomId, hostToken }).success).toBe(true);
    expect(hostLivePayload.safeParse({ live: true }).success).toBe(true);
    expect(viewerJoinPayload.safeParse({ roomId }).success).toBe(true);
    expect(
      offerPayload.safeParse({ viewerId, sdp: { type: 'offer', sdp: 'v=0\r\n' } }).success,
    ).toBe(true);
    expect(answerPayload.safeParse({ sdp: { type: 'answer', sdp: 'v=0\r\n' } }).success).toBe(true);
    expect(iceFromHostPayload.safeParse({ viewerId, candidate }).success).toBe(true);
    expect(iceFromViewerPayload.safeParse({ candidate }).success).toBe(true);
  });

  it('accept the shape of RTCIceCandidate.toJSON() with null fields', () => {
    const fromBrowser = {
      candidate: '',
      sdpMid: null,
      sdpMLineIndex: null,
      usernameFragment: null,
    };
    expect(iceFromViewerPayload.safeParse({ candidate: fromBrowser }).success).toBe(true);
  });

  it('reject a roomId outside the format', () => {
    expect(viewerJoinPayload.safeParse({ roomId: 'short' }).success).toBe(false);
    expect(hostJoinPayload.safeParse({ roomId: 'aaaaaaaaaaa/', hostToken }).success).toBe(false);
  });

  it('reject a host token that is too short or too long', () => {
    expect(hostJoinPayload.safeParse({ roomId, hostToken: 'x'.repeat(19) }).success).toBe(false);
    expect(hostJoinPayload.safeParse({ roomId, hostToken: 'x'.repeat(129) }).success).toBe(false);
  });

  it('reject an SDP that is too large or empty', () => {
    const big = 'a'.repeat(MAX_SDP_LENGTH + 1);
    expect(offerPayload.safeParse({ viewerId, sdp: { type: 'offer', sdp: big } }).success).toBe(
      false,
    );
    expect(answerPayload.safeParse({ sdp: { type: 'answer', sdp: '' } }).success).toBe(false);
  });

  it('reject the wrong SDP type', () => {
    expect(offerPayload.safeParse({ viewerId, sdp: { type: 'answer', sdp: 'v=0' } }).success).toBe(
      false,
    );
    expect(answerPayload.safeParse({ sdp: { type: 'offer', sdp: 'v=0' } }).success).toBe(false);
  });

  it('reject a malformed candidate', () => {
    const tooLong = { ...candidate, candidate: 'c'.repeat(MAX_CANDIDATE_LENGTH + 1) };
    expect(iceFromViewerPayload.safeParse({ candidate: tooLong }).success).toBe(false);
    expect(iceFromViewerPayload.safeParse({ candidate: { sdpMid: '0' } }).success).toBe(false);
    expect(
      iceFromViewerPayload.safeParse({ candidate: { ...candidate, sdpMLineIndex: -1 } }).success,
    ).toBe(false);
    expect(iceFromHostPayload.safeParse({ viewerId: 'not-a-uuid', candidate }).success).toBe(false);
  });

  it('strip fields the schema does not declare', () => {
    const parsed = answerPayload.parse({
      viewerId,
      sdp: { type: 'answer', sdp: 'v=0' },
    } as unknown);
    expect(parsed).toEqual({ sdp: { type: 'answer', sdp: 'v=0' } });
  });
});

describe('REST responses', () => {
  it('validate create and summary responses', () => {
    expect(createRoomResponse.safeParse({ roomId, hostToken }).success).toBe(true);
    expect(
      roomSummaryResponse.safeParse({ roomId, live: false, viewerCount: 0, maxViewers: 5 }).success,
    ).toBe(true);
    expect(
      roomSummaryResponse.safeParse({ roomId, live: false, viewerCount: -1, maxViewers: 5 })
        .success,
    ).toBe(false);
  });
});
