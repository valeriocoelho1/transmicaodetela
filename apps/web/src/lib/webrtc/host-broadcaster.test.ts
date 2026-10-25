import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { HOST_PEER_MAX_RECOVERIES, HOST_PEER_RECOVERY_DELAY_MS } from '../../config';
import { HostBroadcaster, type HostBroadcasterCallbacks } from './host-broadcaster';

const videoCodecs = [
  { mimeType: 'video/VP8', clockRate: 90000 },
  { mimeType: 'video/rtx', clockRate: 90000 },
  { mimeType: 'video/VP9', clockRate: 90000, sdpFmtpLine: 'profile-id=0' },
  { mimeType: 'video/H264', clockRate: 90000 },
];

class FakePeerConnection {
  static created: FakePeerConnection[] = [];
  connectionState: RTCPeerConnectionState = 'new';
  signalingState: RTCSignalingState = 'stable';
  localDescription: { sdp: string } | null = null;
  onicecandidate: ((event: { candidate: null }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  closed = false;
  codecPreferences: { mimeType: string }[] | null = null;
  private readonly track = { kind: 'video' };
  private readonly sender = {
    track: this.track,
    getParameters: () => ({ encodings: [{}] }),
    setParameters: () => Promise.resolve(),
  };

  constructor() {
    FakePeerConnection.created.push(this);
  }

  addTrack() {
    return this.sender;
  }
  getSenders() {
    return [this.sender];
  }
  getTransceivers() {
    return [
      {
        sender: this.sender,
        setCodecPreferences: (codecs: { mimeType: string }[]) => {
          this.codecPreferences = codecs;
        },
      },
    ];
  }
  createOffer() {
    return Promise.resolve({ type: 'offer', sdp: 'v=0' });
  }
  setLocalDescription(description: { sdp: string }) {
    this.signalingState = 'have-local-offer';
    this.localDescription = description;
    return Promise.resolve();
  }
  close() {
    this.closed = true;
  }
  changeState(state: RTCPeerConnectionState) {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
}

const stream = { getTracks: () => [{ kind: 'video' }] } as unknown as MediaStream;
const flush = () => vi.advanceTimersByTimeAsync(0);

describe('HostBroadcaster', () => {
  let offer: Mock<HostBroadcasterCallbacks['offer']>;
  let peerFailed: Mock<HostBroadcasterCallbacks['peerFailed']>;
  let broadcaster: HostBroadcaster;

  beforeEach(() => {
    vi.useFakeTimers();
    FakePeerConnection.created = [];
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
    vi.stubGlobal('RTCRtpSender', { getCapabilities: () => ({ codecs: videoCodecs }) });
    vi.stubGlobal('RTCRtpReceiver', { getCapabilities: () => ({ codecs: videoCodecs }) });
    offer = vi.fn<HostBroadcasterCallbacks['offer']>();
    peerFailed = vi.fn<HostBroadcasterCallbacks['peerFailed']>();
    broadcaster = new HostBroadcaster({ offer, ice: vi.fn(), peerFailed });
    broadcaster.start(stream);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function addViewer(): Promise<FakePeerConnection> {
    broadcaster.addViewer('viewer-1');
    await flush();
    const pc = FakePeerConnection.created.at(-1);
    if (!pc) throw new Error('No peer created');
    return pc;
  }

  it('puts VP9 first and keeps every other codec', async () => {
    const pc = await addViewer();
    expect(pc.codecPreferences?.map((codec) => codec.mimeType)).toEqual([
      'video/VP9',
      'video/VP8',
      'video/rtx',
      'video/H264',
    ]);
  });

  it('keeps the default codec order when the browser cannot send VP9', async () => {
    vi.stubGlobal('RTCRtpSender', {
      getCapabilities: () => ({ codecs: videoCodecs.filter((c) => c.mimeType !== 'video/VP9') }),
    });
    const pc = await addViewer();
    expect(pc.codecPreferences).toBeNull();
  });

  it('sends a fresh offer right away when a peer fails', async () => {
    const pc = await addViewer();
    expect(offer).toHaveBeenCalledTimes(1);
    pc.changeState('failed');
    await flush();
    expect(pc.closed).toBe(true);
    expect(FakePeerConnection.created).toHaveLength(2);
    expect(offer).toHaveBeenCalledTimes(2);
    expect(peerFailed).not.toHaveBeenCalled();
  });

  it('waits before replacing a disconnected peer and does nothing if it comes back', async () => {
    const pc = await addViewer();
    pc.changeState('disconnected');
    await vi.advanceTimersByTimeAsync(HOST_PEER_RECOVERY_DELAY_MS - 1);
    pc.changeState('connected');
    await vi.advanceTimersByTimeAsync(HOST_PEER_RECOVERY_DELAY_MS);
    expect(FakePeerConnection.created).toHaveLength(1);
  });

  it('replaces a peer that stays disconnected', async () => {
    const pc = await addViewer();
    pc.changeState('disconnected');
    await vi.advanceTimersByTimeAsync(HOST_PEER_RECOVERY_DELAY_MS);
    expect(pc.closed).toBe(true);
    expect(FakePeerConnection.created).toHaveLength(2);
  });

  it('gives up after the maximum number of recoveries in a row', async () => {
    await addViewer();
    for (let i = 0; i <= HOST_PEER_MAX_RECOVERIES; i++) {
      FakePeerConnection.created.at(-1)?.changeState('failed');
      await flush();
    }
    expect(FakePeerConnection.created).toHaveLength(HOST_PEER_MAX_RECOVERIES + 1);
    expect(peerFailed).toHaveBeenCalledWith('viewer-1');
  });

  it('resets the recovery count once the peer connects', async () => {
    await addViewer();
    for (let i = 0; i < HOST_PEER_MAX_RECOVERIES; i++) {
      FakePeerConnection.created.at(-1)?.changeState('failed');
      await flush();
    }
    FakePeerConnection.created.at(-1)?.changeState('connected');
    FakePeerConnection.created.at(-1)?.changeState('failed');
    await flush();
    expect(peerFailed).not.toHaveBeenCalled();
  });

  it('does not recover a viewer that already left', async () => {
    const pc = await addViewer();
    pc.changeState('disconnected');
    broadcaster.removeViewer('viewer-1');
    await vi.advanceTimersByTimeAsync(HOST_PEER_RECOVERY_DELAY_MS);
    expect(FakePeerConnection.created).toHaveLength(1);
  });
});
