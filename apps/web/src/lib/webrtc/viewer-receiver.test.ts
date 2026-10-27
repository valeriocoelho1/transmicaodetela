import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewerReceiver, type ViewerReceiverCallbacks } from './viewer-receiver';

class FakePeerConnection {
  static created: FakePeerConnection[] = [];
  connectionState: RTCPeerConnectionState = 'new';
  signalingState: RTCSignalingState = 'stable';
  remoteDescription: { sdp: string } | null = null;
  localDescription: { sdp: string } | null = null;
  ontrack = null;
  onicecandidate = null;
  onconnectionstatechange = null;
  closed = false;

  constructor() {
    FakePeerConnection.created.push(this);
  }

  setRemoteDescription(description: { sdp: string }) {
    this.remoteDescription = description;
    return Promise.resolve();
  }
  createAnswer() {
    return Promise.resolve({ type: 'answer', sdp: 'answer' });
  }
  setLocalDescription(description: { sdp: string }) {
    this.localDescription = description;
    return Promise.resolve();
  }
  addIceCandidate() {
    return Promise.resolve();
  }
  close() {
    this.closed = true;
  }
}

const offer = (session: string, version: number) => ({
  type: 'offer' as const,
  sdp: `v=0\r\no=- ${session} ${version} IN IP4 127.0.0.1\r\ns=-\r\n`,
});

describe('ViewerReceiver', () => {
  let callbacks: ViewerReceiverCallbacks;
  let receiver: ViewerReceiver;

  beforeEach(() => {
    FakePeerConnection.created = [];
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
    callbacks = {
      answer: vi.fn(),
      ice: vi.fn(),
      stream: vi.fn(),
      connected: vi.fn(),
      failed: vi.fn(),
    };
    receiver = new ViewerReceiver(callbacks);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('answers an ICE restart on the same connection', async () => {
    await receiver.handleOffer(offer('1234', 2));
    await receiver.handleOffer(offer('1234', 3));
    expect(FakePeerConnection.created).toHaveLength(1);
    expect(FakePeerConnection.created[0]?.remoteDescription?.sdp).toContain('1234 3');
    expect(callbacks.answer).toHaveBeenCalledTimes(2);
  });

  it('replaces the connection when the offer comes from a new host connection', async () => {
    await receiver.handleOffer(offer('1234', 2));
    await receiver.handleOffer(offer('9876', 2));
    expect(FakePeerConnection.created).toHaveLength(2);
    expect(FakePeerConnection.created[0]?.closed).toBe(true);
  });
});
